import { Button, Card, Empty, Input, Table, Tooltip, Typography } from "antd";
import { History, Search } from "lucide-react";

const { Paragraph, Text } = Typography;

export interface RAGDocument {
  id: string;
  text: string;
  metadata: Record<string, string>;
  distance?: number;
}

export interface SearchHistoryItem {
  query: string;
  timestamp: string;
  resultCount: number;
}

interface SmartSearchProps {
  loading: boolean;
  searchQuery: string;
  searchResults: RAGDocument[];
  searchHistory: SearchHistoryItem[];
  showHistory: boolean;
  onSearchQueryChange: (query: string) => void;
  onSearch: () => void;
  onSearchFromHistory: (query: string) => void;
  onClearHistory: () => void;
  onToggleHistory: () => void;
}

export const SmartSearch = ({
  loading,
  searchQuery,
  searchResults,
  searchHistory,
  showHistory,
  onSearchQueryChange,
  onSearch,
  onSearchFromHistory,
  onClearHistory,
  onToggleHistory,
}: SmartSearchProps) => {
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
            <span className="text-blue-600 text-xs font-medium">
              {record.metadata.title}
            </span>
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

  return (
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
                onClick={onToggleHistory}
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
              onClick={onClearHistory}
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
                onClick={() => onSearchFromHistory(item.query)}
              >
                <span className="text-sm text-gray-700 truncate">
                  {item.query}
                </span>
                <Text type="secondary" className="text-xs whitespace-nowrap">
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
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onPressEnter={onSearch}
          allowClear
          className="flex-1"
        />
        <Button
          type="primary"
          icon={<Search size={16} />}
          onClick={onSearch}
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
  );
};
