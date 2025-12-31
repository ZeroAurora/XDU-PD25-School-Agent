import { Button, Card, Popconfirm, Space, Table, Tooltip } from "antd";
import { Delete, Download, Eye, FileText } from "lucide-react";

export interface RAGDocument {
  id: string;
  text: string;
  metadata: Record<string, string>;
  distance?: number;
}

interface DocumentManagementProps {
  documents: RAGDocument[];
  total: number;
  loading: boolean;
  pagination: { current: number; pageSize: number };
  onExport: () => void;
  onDeleteAll: () => void;
  onDeleteDocument: (id: string) => void;
  onPreview: (doc: RAGDocument) => void;
  onPageChange: (page: number, pageSize: number) => void;
}

export const DocumentManagement = ({
  documents,
  total,
  loading,
  pagination,
  onExport,
  onDeleteAll,
  onDeleteDocument,
  onPreview,
  onPageChange,
}: DocumentManagementProps) => {
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 120,
      render: (id: string) => (
        <Tooltip title={id}>
          <code className="text-xs">{id}</code>
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
              onClick={() => onPreview(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="确定要删除这篇文档吗？"
            onConfirm={() => onDeleteDocument(record.id)}
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
          <Button icon={<Download size={14} />} onClick={onExport} size="small">
            导出
          </Button>
          <Popconfirm
            title="确认删除所有"
            description="确定要删除所有文档吗？"
            onConfirm={onDeleteAll}
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
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 篇文档`,
          onChange: onPageChange,
        }}
        size="small"
        scroll={{ x: 800 }}
        className="rounded-lg"
      />
    </Card>
  );
};
