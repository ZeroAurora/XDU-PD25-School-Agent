import { createFileRoute } from "@tanstack/react-router";
import { Button, Modal, message, Typography } from "antd";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityLog,
  type ActivityLogEntry,
} from "@/components/admin/ActivityLog";
import { APIReference } from "@/components/admin/APIReference";
import { BatchImportCard } from "@/components/admin/BatchImportCard";
import { DangerZone } from "@/components/admin/DangerZone";
import { DocumentManagement } from "@/components/admin/DocumentManagement";
import { DocumentPreviewModal } from "@/components/admin/DocumentPreviewModal";
import {
  type RAGDocument,
  type SearchHistoryItem,
  SmartSearch,
} from "@/components/admin/SmartSearch";
import { StatsDashboard } from "@/components/admin/StatsDashboard";
import {
  useCollectionStats,
  useDeleteAllDocuments,
  useDeleteDocument,
  useDocuments,
  useExportCollection,
  useRagSearch,
  useResetCollection,
  useSeedSchedule,
} from "@/hooks/useApi";

const { Title, Text } = Typography;

// Constants
const SEARCH_HISTORY_KEY = "rag_admin_search_history";
const MAX_HISTORY_ITEMS = 10;
const ACTIVITY_LOG_MAX = 50;

export const Route = createFileRoute("/admin")({
  component: RouteComponent,
});

function RouteComponent() {
  // Data states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RAGDocument[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // UI states
  const [previewDocument, setPreviewDocument] = useState<RAGDocument | null>(
    null,
  );

  // Pagination
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  // React Query hooks
  const {
    data: statsData,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useCollectionStats();
  const {
    data: documentsData,
    isLoading: documentsLoading,
    refetch: refetchDocuments,
  } = useDocuments({
    limit: pagination.pageSize,
    offset: (pagination.current - 1) * pagination.pageSize,
  });
  const searchMutation = useRagSearch();
  const deleteDocumentMutation = useDeleteDocument();
  const deleteAllDocumentsMutation = useDeleteAllDocuments();
  const resetCollectionMutation = useResetCollection();
  const exportCollectionMutation = useExportCollection();
  const seedScheduleMutation = useSeedSchedule();

  // Initialize search history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch {
        setSearchHistory([]);
      }
    }
  }, []);

  // Activity logging helper
  const addActivityLog = useCallback(
    (entry: Omit<ActivityLogEntry, "id" | "timestamp">) => {
      const newEntry: ActivityLogEntry = {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      setActivityLog((prev) => [newEntry, ...prev].slice(0, ACTIVITY_LOG_MAX));
    },
    [],
  );

  // Initial data fetch
  useEffect(() => {
    addActivityLog({
      type: "info",
      action: "打开管理后台",
      details: "用户进入RAG管理页面",
    });
  }, [addActivityLog]);

  // Save search to history
  const saveToHistory = useCallback((query: string, resultCount: number) => {
    const newItem: SearchHistoryItem = {
      query,
      timestamp: new Date().toISOString(),
      resultCount,
    };
    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h.query !== query);
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await searchMutation.mutateAsync({
        query: searchQuery,
        k: 10,
      });
      setSearchResults(results);
      saveToHistory(searchQuery, results.length);
      addActivityLog({
        type: results.length > 0 ? "success" : "warning",
        action: "执行搜索",
        details: `查询: "${searchQuery}", 结果: ${results.length}条`,
      });
    } catch {
      message.error("搜索失败");
      addActivityLog({
        type: "error",
        action: "搜索失败",
        details: searchQuery,
      });
    }
  }, [searchQuery, saveToHistory, addActivityLog, searchMutation]);

  // Handle search from history
  const handleSearchFromHistory = useCallback((query: string) => {
    setSearchQuery(query);
    setShowHistory(false);
  }, []);

  // Clear search history
  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    message.success("搜索历史已清除");
  }, []);

  // Handle reset collection with confirmation
  const handleReset = useCallback(() => {
    Modal.confirm({
      title: "确认重置集合",
      content:
        "⚠️ 此操作将删除所有向量数据且不可恢复！集合将被清空，但ChromaDB连接保持。确定继续？",
      okText: "确认重置",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          await resetCollectionMutation.mutateAsync();
          message.success("集合已重置");
          addActivityLog({
            type: "warning",
            action: "重置集合",
            details: "所有文档已删除",
          });
          refetchStats();
          refetchDocuments();
        } catch {
          message.error("重置失败");
        }
      },
    });
  }, [resetCollectionMutation, addActivityLog, refetchStats, refetchDocuments]);

  // Handle delete all documents
  const handleDeleteAll = useCallback(() => {
    Modal.confirm({
      title: "确认删除所有文档",
      content:
        "⚠️ 此操作将删除集合中的所有文档，但保留集合结构。此操作不可撤销。",
      okText: "确认删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          const data = await deleteAllDocumentsMutation.mutateAsync();
          message.success(`已删除 ${data.deleted_count} 篇文档`);
          addActivityLog({
            type: "warning",
            action: "删除所有文档",
            details: `删除数量: ${data.deleted_count}`,
          });
          refetchStats();
          refetchDocuments();
        } catch {
          message.error("删除失败");
        }
      },
    });
  }, [
    deleteAllDocumentsMutation,
    addActivityLog,
    refetchStats,
    refetchDocuments,
  ]);

  // Handle delete single document
  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      try {
        await deleteDocumentMutation.mutateAsync(docId);
        message.success("文档已删除");
        addActivityLog({
          type: "success",
          action: "删除文档",
          details: `ID: ${docId}`,
        });
        refetchDocuments();
      } catch {
        message.error("删除失败");
      }
    },
    [deleteDocumentMutation, addActivityLog, refetchDocuments],
  );

  // Handle export collection
  const handleExport = useCallback(async () => {
    try {
      const data = await exportCollectionMutation.mutateAsync();

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rag-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      message.success(`已导出 ${data.count} 篇文档`);
      addActivityLog({
        type: "success",
        action: "导出文档",
        details: `导出数量: ${data.count}`,
      });
    } catch {
      message.error("导出失败");
    }
  }, [exportCollectionMutation, addActivityLog]);

  // Seed data
  const handleSeed = useCallback(() => {
    Modal.confirm({
      title: "确认填充默认数据",
      content: "此操作将添加示例文档到集合中。",
      okText: "确认",
      cancelText: "取消",
      onOk: async () => {
        try {
          const data = await seedScheduleMutation.mutateAsync();
          if (data.ok) {
            message.success(`已添加 ${data.count} 篇示例文档`);
            addActivityLog({
              type: "success",
              action: "添加示例文档",
              details: `添加数量: ${data.count}`,
            });
            refetchStats();
            refetchDocuments();
          } else {
            message.error("添加示例文档失败");
          }
        } catch {
          message.error("添加示例文档失败");
        }
      },
    });
  }, [seedScheduleMutation, addActivityLog, refetchStats, refetchDocuments]);

  return (
    <div className="min-h-full p-4 lg:p-6 xl:p-8">
      <div className="max-w-7xl mx-auto space-y-8 lg:space-y-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-xl p-5 lg:p-6 shadow-sm ">
          <div className="flex items-center gap-3">
            <div>
              <Title level={3} className="my-0! text-gray-900">
                RAG 管理后台
              </Title>
              <Text type="secondary" className="text-sm">
                向量数据库管理与文档检索系统
              </Text>
            </div>
          </div>
          <Button
            icon={<RefreshCw size={16} />}
            onClick={() => {
              refetchStats();
              refetchDocuments();
            }}
            loading={statsLoading}
            className="self-start sm:self-auto"
          >
            刷新数据
          </Button>
        </div>

        {/* Stats Dashboard */}
        <StatsDashboard stats={statsData || null} loading={statsLoading} />

        {/* Main Content Grid */}
        <div>
          {/* Smart Search */}
          <SmartSearch
            loading={searchMutation.isPending}
            searchQuery={searchQuery}
            searchResults={searchResults}
            searchHistory={searchHistory}
            showHistory={showHistory}
            onSearchQueryChange={setSearchQuery}
            onSearch={handleSearch}
            onSearchFromHistory={handleSearchFromHistory}
            onClearHistory={clearSearchHistory}
            onToggleHistory={() => setShowHistory(!showHistory)}
          />
        </div>

        {/* Batch Import */}
        <div className="my-6">
          <BatchImportCard
            onImportComplete={() => {
              refetchStats();
              refetchDocuments();
            }}
          />
        </div>

        {/* Document Management */}
        <DocumentManagement
          documents={documentsData?.documents || []}
          total={documentsData?.total || 0}
          loading={documentsLoading}
          pagination={pagination}
          onExport={handleExport}
          onDeleteAll={handleDeleteAll}
          onDeleteDocument={handleDeleteDocument}
          onPreview={setPreviewDocument}
          onPageChange={(page, pageSize) => {
            setPagination({ current: page, pageSize });
            refetchDocuments();
          }}
        />

        {/* Danger Zone & Activity Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 my-6">
          <DangerZone
            onReset={handleReset}
            onDeleteAll={handleDeleteAll}
            onSeed={handleSeed}
            loading={
              deleteAllDocumentsMutation.isPending ||
              resetCollectionMutation.isPending ||
              seedScheduleMutation.isPending
            }
          />
          <ActivityLog logs={activityLog} onClear={() => setActivityLog([])} />
        </div>

        {/* API Reference */}
        <APIReference />
      </div>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
        onDelete={handleDeleteDocument}
      />
    </div>
  );
}
