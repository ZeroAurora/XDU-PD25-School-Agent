import { Card, Statistic, Tag } from "antd";
import { Database, FileText } from "lucide-react";
import { useMemo } from "react";

export interface CollectionStats {
  document_count: number;
  storage_size_bytes: number;
  storage_size_formatted: string;
  embedding_dimension: number;
  collection_name: string;
  chroma_status: string;
  health: string;
  last_updated: string;
}

interface StatsDashboardProps {
  stats: CollectionStats | null;
  loading: boolean;
}

export const StatsDashboard = ({ stats, loading }: StatsDashboardProps) => {
  const statCards = useMemo(
    () => [
      {
        title: "文档数量",
        value: stats?.document_count || 0,
        prefix: <FileText size={18} className="text-blue-500" />,
        color: "#1890ff",
      },
      {
        title: "存储大小",
        value: stats?.storage_size_formatted || "0 B",
        prefix: <Database size={18} className="text-green-500" />,
        color: "#52c41a",
      },
      {
        title: "向量维度",
        value: stats?.embedding_dimension || 1024,
        suffix: "维",
        color: "#722ed1",
      },
      {
        title: "集合名称",
        value: stats?.collection_name || "campus_acts",
        isTag: true,
        color: "purple",
      },
    ],
    [stats],
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 my-6">
      {statCards.map((card) => (
        <Card
          key={card.title}
          loading={loading}
          className="shadow-sm"
          size="small"
          styles={{ body: { padding: 20 } }}
        >
          {card.isTag ? (
            <div className="flex items-center justify-between h-full">
              <div>
                <span className="text-xs text-gray-500 block mb-1">
                  {card.title}
                </span>
                <Tag color={card.color}>{card.value}</Tag>
              </div>
            </div>
          ) : (
            <Statistic
              title={<span className="text-gray-500">{card.title}</span>}
              value={card.value}
              prefix={card.prefix}
              suffix={card.suffix}
              styles={{ content: { color: card.color, fontSize: 24 } }}
            />
          )}
        </Card>
      ))}
    </div>
  );
};
