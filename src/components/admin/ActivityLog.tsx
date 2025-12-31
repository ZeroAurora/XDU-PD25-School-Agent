import { Button, Card, Empty, List, Tag, Typography } from "antd";
import {
  AlertTriangle,
  CheckCircle,
  History,
  Info,
  XCircle,
} from "lucide-react";

const { Text } = Typography;

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error";
  action: string;
  details?: string;
}

interface ActivityLogProps {
  logs: ActivityLogEntry[];
  onClear: () => void;
}

export const ActivityLog = ({ logs, onClear }: ActivityLogProps) => {
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
          onClick={onClear}
          disabled={logs.length === 0}
          className="text-gray-500 hover:text-gray-700"
        >
          清除
        </Button>
      }
    >
      <List
        dataSource={logs}
        renderItem={(item) => (
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
                  <Text type="secondary" className="text-xs truncate block">
                    {item.details}
                  </Text>
                )}
              </div>
            </div>
          </List.Item>
        )}
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
  );
};
