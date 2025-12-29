import { createFileRoute } from "@tanstack/react-router";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  List,
  Modal,
  message,
  Popconfirm,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  AlertTriangle,
  CheckCircle,
  Database,
  Delete,
  Download,
  Eye,
  FileText,
  History,
  Info,
  RefreshCw,
  Search,
  Trash2,
  Upload as UploadIcon,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BatchImportCard } from "@/components/admin/BatchImportCard";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// Types
interface CollectionStats {
  document_count: number;
  storage_size_bytes: number;
  storage_size_formatted: string;
  embedding_dimension: number;
  collection_name: string;
  chroma_status: string;
  health: string;
  last_updated: string;
}

interface RAGDocument {
  id: string;
  text: string;
  metadata: Record<string, string>;
  distance?: number;
}

interface SearchHistoryItem {
  query: string;
  timestamp: string;
  resultCount: number;
}

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error";
  action: string;
  details?: string;
}

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
  const [ingestForm] = Form.useForm();

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

  // Handle single document ingest
  const handleIngest = async (values: {
    text: string;
    id: string;
    title: string;
    date: string;
    place: string;
  }) => {
    setLoading(true);
    try {
      const response = await fetch("/api/debug/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            text: values.text,
            id: values.id || `doc-${Date.now()}`,
            metadata: {
              title: values.title,
              date: values.date,
              place: values.place,
            },
          },
        ]),
      });

      if (!response.ok) throw new Error("Ingest failed");

      message.success("文档已成功导入向量库");
      addActivityLog({
        type: "success",
        action: "导入文档",
        details: `标题: ${values.title}`,
      });
      ingestForm.resetFields();
      fetchStats();
      fetchDocuments();
    } catch (error) {
      console.error("Ingest failed:", error);
      message.error("导入失败");
      addActivityLog({
        type: "error",
        action: "导入文档失败",
        details: String(error),
      });
    } finally {
      setLoading(false);
    }
  };

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

  // Search result columns
  const searchColumns = [
    {
      title: "文档内容",
      dataIndex: "text",
      key: "text",
      render: (text: string) => (
        <Paragraph
          ellipsis={{ rows: 2, expandable: true }}
          className="text-xs mb-0"
          style={{ maxWidth: 300 }}
        >
          {text}
        </Paragraph>
      ),
    },
    {
      title: "元数据",
      key: "metadata",
      width: 180,
      render: (_: unknown, record: RAGDocument) => (
        <div className="space-y-1">
          {record.metadata?.title && (
            <Tag color="blue">{record.metadata.title}</Tag>
          )}
          {record.metadata?.date && (
            <Text type="secondary" className="text-xs block">
              {record.metadata.date}
            </Text>
          )}
          {record.metadata?.place && (
            <Text type="secondary" className="text-xs block">
              {record.metadata.place}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "相似度",
      dataIndex: "distance",
      key: "distance",
      width: 80,
      render: (dist: number) => {
        const score = dist ? (1 - dist) * 100 : 0;
        const color =
          score > 80 ? "success" : score > 50 ? "warning" : "danger";
        return (
          <Text type={color as "success" | "warning" | "danger"}>
            {score.toFixed(0)}%
          </Text>
        );
      },
    },
  ];

  // Document table columns
  const documentColumns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 120,
      render: (id: string) => (
        <Tooltip title={id}>
          <code className="text-xs">{id.slice(0, 16)}...</code>
        </Tooltip>
      ),
    },
    {
      title: "标题",
      dataIndex: ["metadata", "title"],
      key: "title",
      ellipsis: true,
    },
    {
      title: "日期",
      dataIndex: ["metadata", "date"],
      key: "date",
      width: 120,
    },
    {
      title: "地点",
      dataIndex: ["metadata", "place"],
      key: "place",
      width: 120,
      ellipsis: true,
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      render: (_: unknown, record: RAGDocument) => (
        <Space size="small">
          <Tooltip title="预览">
            <Button
              type="text"
              size="small"
              icon={<Eye size={14} />}
              onClick={() => setPreviewDocument(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="确定要删除这篇文档吗？"
            onConfirm={() => handleDeleteDocument(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                danger
                icon={<Delete size={14} />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 my-6">
          <Card
            loading={statsLoading}
            className="shadow-sm"
            size="small"
            styles={{ body: { padding: 20 } }}
          >
            <Statistic
              title={<span className="text-gray-500">文档数量</span>}
              value={stats?.document_count || 0}
              prefix={<FileText size={18} className="text-blue-500" />}
              valueStyle={{ color: "#1890ff", fontSize: 24 }}
            />
          </Card>
          <Card
            loading={statsLoading}
            className="shadow-sm"
            size="small"
            styles={{ body: { padding: 20 } }}
          >
            <Statistic
              title={<span className="text-gray-500">存储大小</span>}
              value={stats?.storage_size_formatted || "0 B"}
              prefix={<Database size={18} className="text-green-500" />}
              valueStyle={{ color: "#52c41a", fontSize: 24 }}
            />
          </Card>
          <Card
            loading={statsLoading}
            className="shadow-sm"
            size="small"
            styles={{ body: { padding: 20 } }}
          >
            <Statistic
              title={<span className="text-gray-500">向量维度</span>}
              value={stats?.embedding_dimension || 1024}
              suffix="维"
              valueStyle={{ color: "#722ed1", fontSize: 24 }}
            />
          </Card>
          <Card
            loading={statsLoading}
            className="shadow-sm"
            size="small"
            styles={{ body: { padding: 20 } }}
          >
            <div className="flex items-center justify-between h-full">
              <div>
                <Text type="secondary" className="text-xs block mb-1">
                  集合名称
                </Text>
                <Tag color="purple">
                  {stats?.collection_name || "campus_acts"}
                </Tag>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-10">
          {/* Smart Search */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <Search size={18} className="text-blue-500" />
                <span>智能搜索</span>
                {searchHistory.length > 0 && (
                  <Tooltip title="查看搜索历史">
                    <Button
                      type="text"
                      size="small"
                      icon={<History size={14} />}
                      onClick={() => setShowHistory(!showHistory)}
                    />
                  </Tooltip>
                )}
              </span>
            }
            className="shadow-sm hover:shadow-md transition-all my-2"
            size="small"
            extra={
              searchResults.length > 0 && (
                <Text type="secondary" className="text-sm">
                  {searchResults.length} 条结果
                </Text>
              )
            }
          >
            {/* Search History */}
            {showHistory && searchHistory.length > 0 && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg ">
                <div className="flex items-center justify-between mb-3">
                  <Text strong className="flex items-center gap-2 text-sm">
                    <History size={14} />
                    搜索历史
                  </Text>
                  <Button
                    size="small"
                    type="link"
                    onClick={clearSearchHistory}
                    className="text-red-500"
                  >
                    清除
                  </Button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {searchHistory.map((item) => (
                    <Button
                      key={item.query}
                      type="link"
                      size="small"
                      className="flex items-center justify-between w-full px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                      onClick={() => handleSearchFromHistory(item.query)}
                    >
                      <span className="text-sm text-gray-700 truncate">
                        {item.query}
                      </span>
                      <Text
                        type="secondary"
                        className="text-xs whitespace-nowrap"
                      >
                        {item.resultCount} 结果
                      </Text>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Input */}
            <div className="flex gap-3 mb-4">
              <Input
                placeholder="输入搜索关键词，在文档中查找..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onPressEnter={handleSearch}
                allowClear
                className="flex-1"
              />
              <Button
                type="primary"
                icon={<Search size={16} />}
                onClick={handleSearch}
                loading={loading}
              >
                搜索
              </Button>
            </div>

            <Table
              dataSource={searchResults}
              columns={searchColumns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
              loading={loading}
              locale={{
                emptyText: (
                  <Empty
                    description="输入关键词搜索文档"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
              className="rounded-lg mt-4"
            />
          </Card>

          {/* Document Ingest */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <UploadIcon size={18} className="text-green-500" />
                <span>单文档导入</span>
              </span>
            }
            className="shadow-sm hover:shadow-md transition-all my-2"
            size="small"
          >
            <Alert
              message="导入说明"
              description="填写文档信息并导入到向量数据库，支持语义检索"
              type="info"
              showIcon
              className="mb-4"
            />
            <Form
              form={ingestForm}
              layout="vertical"
              onFinish={handleIngest}
              size="small"
            >
              <Form.Item
                name="text"
                label="文档内容"
                rules={[{ required: true, message: "请输入文档内容" }]}
                className="mb-4"
              >
                <TextArea
                  rows={3}
                  placeholder="输入要导入的文档内容..."
                  className="font-mono text-sm"
                />
              </Form.Item>

              <div className="grid grid-cols-2 gap-4">
                <Form.Item
                  name="title"
                  label="标题"
                  rules={[{ required: true, message: "请输入标题" }]}
                  className="mb-4"
                >
                  <Input placeholder="文档标题" />
                </Form.Item>
                <Form.Item name="id" label="文档ID (可选)" className="mb-4">
                  <Input placeholder="自动生成" />
                </Form.Item>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Form.Item name="date" label="日期" className="mb-4">
                  <Input placeholder="如: 2025-11-08" />
                </Form.Item>
                <Form.Item name="place" label="地点" className="mb-4">
                  <Input placeholder="如: 图书馆报告厅" />
                </Form.Item>
              </div>

              <Form.Item className="mb-0 mt-2">
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<UploadIcon size={16} />}
                  loading={loading}
                  block
                >
                  导入向量库
                </Button>
              </Form.Item>
            </Form>
          </Card>
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
        <Card
          title={
            <span className="flex items-center gap-2">
              <FileText size={18} className="text-purple-500" />
              <span>文档管理</span>
            </span>
          }
          className="shadow-sm my-6"
          size="small"
          extra={
            <Space size="small">
              <Button
                icon={<Download size={14} />}
                onClick={handleExport}
                size="small"
              >
                导出
              </Button>
              <Popconfirm
                title="确认删除所有"
                description="确定要删除所有文档吗？"
                onConfirm={handleDeleteAll}
                okText="确认"
                cancelText="取消"
              >
                <Button danger icon={<Delete size={14} />} size="small">
                  清空
                </Button>
              </Popconfirm>
            </Space>
          }
        >
          <Table
            dataSource={documents}
            columns={documentColumns}
            rowKey="id"
            loading={documentsLoading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: documentTotal,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 篇文档`,
              onChange: (page, pageSize) => fetchDocuments(page, pageSize),
            }}
            size="small"
            scroll={{ x: 800 }}
            className="rounded-lg"
          />
        </Card>

        {/* Danger Zone & Activity Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 my-6">
          {/* Danger Zone */}
          <Card
            title={
              <span className="flex items-center gap-2 text-red-600">
                <AlertTriangle size={18} />
                <span>危险操作区</span>
              </span>
            }
            className="border-red-200 shadow-sm hover:shadow-md transition-all"
            size="small"
            variant="outlined"
          >
            <Alert
              message="警告"
              description="以下操作具有不可逆性，请谨慎操作。"
              type="warning"
              showIcon
              className="mb-4"
            />
            <div className="flex flex-wrap gap-3 mt-4">
              <Popconfirm
                title="确认重置集合"
                description="此操作将删除所有数据并重建集合。"
                onConfirm={handleReset}
                okText="确认"
                cancelText="取消"
              >
                <Button danger icon={<Trash2 size={14} />} size="small">
                  重置集合
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认清空"
                description="此操作将删除所有文档。"
                onConfirm={handleDeleteAll}
                okText="确认"
                cancelText="取消"
              >
                <Button danger icon={<Delete size={14} />} size="small">
                  删除所有文档
                </Button>
              </Popconfirm>
            </div>
          </Card>

          {/* Activity Log */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <History size={18} className="text-gray-500" />
                <span>操作日志</span>
              </span>
            }
            className="shadow-sm hover:shadow-md transition-all"
            size="small"
            extra={
              <Button
                size="small"
                onClick={() => setActivityLog([])}
                disabled={activityLog.length === 0}
                className="text-gray-500 hover:text-gray-700"
              >
                清除
              </Button>
            }
          >
            <List
              dataSource={activityLog}
              renderItem={(item) => {
                const colors: Record<string, string> = {
                  info: "blue",
                  success: "green",
                  warning: "orange",
                  error: "red",
                };
                const icons: Record<string, React.ReactNode> = {
                  info: <Info size={12} />,
                  success: <CheckCircle size={12} />,
                  warning: <AlertTriangle size={12} />,
                  error: <XCircle size={12} />,
                };
                return (
                  <List.Item className="py-2! px-1">
                    <div className="flex items-start gap-2 w-full">
                      <Tag
                        color={colors[item.type]}
                        icon={icons[item.type]}
                        className="text-xs shrink-0"
                      >
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </Tag>
                      <div className="flex-1 min-w-0">
                        <Text strong className="text-sm block truncate">
                          {item.action}
                        </Text>
                        {item.details && (
                          <Text
                            type="secondary"
                            className="text-xs truncate block"
                          >
                            {item.details}
                          </Text>
                        )}
                      </div>
                    </div>
                  </List.Item>
                );
              }}
              locale={{
                emptyText: (
                  <Empty
                    description="暂无操作记录"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
              size="small"
              className="max-h-56 overflow-y-auto rounded-lg"
            />
          </Card>
        </div>

        {/* API Reference */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <Info size={18} className="text-cyan-500" />
              <span>API 端点参考</span>
            </span>
          }
          className="shadow-sm my-6"
          size="small"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "集合统计", endpoint: "GET /api/debug/stats" },
              { label: "文档列表", endpoint: "GET /api/debug/documents" },
              { label: "批量导入", endpoint: "POST /api/debug/batch_ingest" },
              { label: "导出数据", endpoint: "GET /api/debug/export" },
            ].map((item) => (
              <div key={item.endpoint} className="p-4 bg-gray-50 rounded-lg">
                <Text strong className="text-xs block mb-2">
                  {item.label}:
                </Text>
                <Paragraph
                  copyable
                  code
                  className="text-xs! mb-0! bg-white px-2 py-1 rounded border"
                >
                  {item.endpoint}
                </Paragraph>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Document Preview Modal */}
      <Modal
        title="文档详情"
        open={!!previewDocument}
        onCancel={() => setPreviewDocument(null)}
        footer={[
          <Button key="close" onClick={() => setPreviewDocument(null)}>
            关闭
          </Button>,
          <Popconfirm
            key="delete"
            title="确认删除"
            description="确定要删除这篇文档吗？"
            onConfirm={() => {
              if (previewDocument) {
                handleDeleteDocument(previewDocument.id);
                setPreviewDocument(null);
              }
            }}
            okText="确认"
            cancelText="取消"
          >
            <Button key="delete" danger>
              删除
            </Button>
          </Popconfirm>,
        ]}
        width={650}
      >
        {previewDocument && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="ID">
                <code>{previewDocument.id}</code>
              </Descriptions.Item>
              <Descriptions.Item label="标题">
                {previewDocument.metadata?.title || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="日期">
                {previewDocument.metadata?.date || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="地点">
                {previewDocument.metadata?.place || "-"}
              </Descriptions.Item>
              {previewDocument.distance !== undefined && (
                <Descriptions.Item label="相似度">
                  {((1 - previewDocument.distance) * 100).toFixed(1)}%
                </Descriptions.Item>
              )}
            </Descriptions>
            <Divider className="my-4" />
            <Title level={5} className="mb-3">
              文档内容
            </Title>
            <Paragraph className="leading-relaxed">
              {previewDocument.text}
            </Paragraph>
          </>
        )}
      </Modal>
    </div>
  );
}
