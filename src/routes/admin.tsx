import { createFileRoute } from "@tanstack/react-router";
import { Button, message, Typography, Modal } from "antd";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BatchImportCard } from "@/components/admin/BatchImportCard";
import { StatsDashboard, type CollectionStats } from "@/components/admin/StatsDashboard";
import { SmartSearch, type RAGDocument, type SearchHistoryItem } from "@/components/admin/SmartSearch";
import { DocumentManagement } from "@/components/admin/DocumentManagement";
import { DangerZone } from "@/components/admin/DangerZone";
import { ActivityLog, type ActivityLogEntry } from "@/components/admin/ActivityLog";
import { APIReference } from "@/components/admin/APIReference";
import { DocumentPreviewModal } from "@/components/admin/DocumentPreviewModal";

const { Title, Text } = Typography;

// Types
interface DocumentListResponse {
  total: number;
  limit: number;
  offset: number;
  documents: RAGDocument[];
}

// Constants
const SEARCH_HISTORY_KEY = "rag_admin_search_history";
const MAX_HISTORY_ITEMS = 10;
const ACTIVITY_LOG_MAX = 50;

export const Route = createFileRoute("/admin")({
  component: RouteComponent,
});

function RouteComponent() {
  // Loading states
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  // Data states
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [documentTotal, setDocumentTotal] = useState(0);
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

  // Fetch collection stats
  const fetchStats = useCallback(
    async (showLoading = true) => {
      if (showLoading) setStatsLoading(true);
      try {
        const response = await fetch("/api/debug/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          const pingResponse = await fetch("/api/debug/ping_chroma");
          if (pingResponse.ok) {
            const pingData = await pingResponse.json();
            setStats({
              document_count: pingData.result_count || 0,
              storage_size_bytes: pingData.storage_size || 0,
              storage_size_formatted: pingData.storage_size_formatted || "0 B",
              embedding_dimension: pingData.model_dim || 1024,
              collection_name: pingData.collection_name || "campus_acts",
              chroma_status: pingData.status === "ok" ? "ok" : "error",
              health: pingData.health || "degraded",
              last_updated: new Date().toISOString(),
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
        addActivityLog({
          type: "error",
          action: "获取统计信息失败",
          details: String(error),
        });
      } finally {
        if (showLoading) setStatsLoading(false);
      }
    },
    [addActivityLog],
  );

  // Fetch documents list
  const fetchDocuments = useCallback(async (page = 1, pageSize = 10) => {
    setDocumentsLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const response = await fetch(
        `/api/debug/documents?limit=${pageSize}&offset=${offset}`,
      );
      if (response.ok) {
        const data: DocumentListResponse = await response.json();
        setDocuments(data.documents);
        setDocumentTotal(data.total);
        setPagination({ current: page, pageSize });
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      message.error("获取文档列表失败");
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchStats();
    fetchDocuments();
    addActivityLog({
      type: "info",
      action: "打开管理后台",
      details: "用户进入RAG管理页面",
    });
  }, [fetchStats, fetchDocuments, addActivityLog]);

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
    setLoading(true);
    try {
      const response = await fetch(
        `/api/debug/rag/search?q=${encodeURIComponent(searchQuery)}&k=10`,
      );
      const data = await response.json();
      const results = Array.isArray(data) ? data : data.results || [];
      setSearchResults(results);
      saveToHistory(searchQuery, results.length);
      addActivityLog({
        type: results.length > 0 ? "success" : "warning",
        action: "执行搜索",
        details: `查询: "${searchQuery}", 结果: ${results.length}条`,
      });
    } catch (error) {
      console.error("Search failed:", error);
      message.error("搜索失败");
      addActivityLog({
        type: "error",
        action: "搜索失败",
        details: String(error),
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, saveToHistory, addActivityLog]);

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
        setLoading(true);
        try {
          const response = await fetch("/api/debug/reset", {
            method: "DELETE",
          });
          const data = await response.json();
          if (data.ok) {
            message.success("集合已重置");
            addActivityLog({
              type: "warning",
              action: "重置集合",
              details: "所有文档已删除",
            });
            fetchStats();
            fetchDocuments();
          } else {
            message.error("重置失败");
          }
        } catch (error) {
          console.error("Reset failed:", error);
          message.error("重置失败");
        } finally {
          setLoading(false);
        }
      },
    });
  }, [fetchStats, fetchDocuments, addActivityLog]);

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
        setLoading(true);
        try {
          const response = await fetch("/api/debug/documents", {
            method: "DELETE",
          });
          const data = await response.json();
          if (data.ok) {
            message.success(`已删除 ${data.deleted_count} 篇文档`);
            addActivityLog({
              type: "warning",
              action: "删除所有文档",
              details: `删除数量: ${data.deleted_count}`,
            });
            fetchStats();
            fetchDocuments();
          } else {
            message.error("删除失败");
          }
        } catch (error) {
          console.error("Delete all failed:", error);
          message.error("删除失败");
        } finally {
          setLoading(false);
        }
      },
    });
  }, [fetchStats, fetchDocuments, addActivityLog]);

  // Handle delete single document
  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      try {
        const response = await fetch(`/api/debug/documents/${docId}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (data.ok) {
          message.success("文档已删除");
          addActivityLog({
            type: "success",
            action: "删除文档",
            details: `ID: ${docId}`,
          });
          fetchDocuments(pagination.current, pagination.pageSize);
        } else {
          message.error("删除失败");
        }
      } catch (error) {
        console.error("Delete failed:", error);
        message.error("删除失败");
      }
    },
    [fetchDocuments, pagination, addActivityLog],
  );

  // Handle export collection
  const handleExport = useCallback(async () => {
    try {
      const response = await fetch("/api/debug/export");
      const data = await response.json();

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
    } catch (error) {
      console.error("Export failed:", error);
      message.error("导出失败");
    }
  }, [addActivityLog]);

  // Seed data
  const handleSeed = useCallback(() => {
    try {
      fetch("/api/debug/schedule/seed", { method: "POST" }).then(async (response) => {
        const data = await response.json();
        if (data.ok) {
          message.success(`已添加 ${data.count} 篇示例文档`);
          addActivityLog({
            type: "success",
            action: "添加示例文档",
            details: `添加数量: ${data.count}`,
          });
          fetchStats();
          fetchDocuments();
        } else {
          message.error("添加示例文档失败");
        }
      });
    } catch (error) {
      console.error("Seed failed:", error);
      message.error("添加示例文档失败");
    }
  }, [addActivityLog, fetchStats, fetchDocuments]);

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
            onClick={() => fetchStats(true)}
            loading={statsLoading}
            className="self-start sm:self-auto"
          >
            刷新数据
          </Button>
        </div>

        {/* Stats Dashboard */}
        <StatsDashboard
          stats={stats}
          loading={statsLoading}
        />

        {/* Main Content Grid */}
        <div>
          {/* Smart Search */}
          <SmartSearch
            loading={loading}
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
              fetchStats();
              fetchDocuments();
            }}
          />
        </div>

        {/* Document Management */}
        <DocumentManagement
          documents={documents}
          total={documentTotal}
          loading={documentsLoading}
          pagination={pagination}
          onExport={handleExport}
          onDeleteAll={handleDeleteAll}
          onDeleteDocument={handleDeleteDocument}
          onPreview={setPreviewDocument}
          onPageChange={(page, pageSize) => fetchDocuments(page, pageSize)}
        />

        {/* Danger Zone & Activity Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 my-6">
          <DangerZone
            onReset={handleReset}
            onDeleteAll={handleDeleteAll}
            onSeed={handleSeed}
            loading={loading}
          />
          <ActivityLog
            logs={activityLog}
            onClear={() => setActivityLog([])}
          />
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
