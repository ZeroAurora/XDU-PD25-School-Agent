import { Button, Card, Progress, Space, Typography } from "antd";
import { Play, RotateCw } from "lucide-react";
import type { ImportState } from "./useBatchImport";

const { Text } = Typography;

interface ImportProgressProps {
  status: ImportState["status"];
  progress: number;
  total: number;
  imported: number;
  skipped: number;
  error?: string | null;
  onStart?: () => void;
  onRetry?: () => void;
  disabled?: boolean;
  dryRun?: boolean;
}

export function ImportProgress({
  status,
  progress,
  total,
  imported,
  skipped,
  error,
  onStart,
  onRetry,
  disabled = false,
  dryRun = false,
}: ImportProgressProps) {
  const percent = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <Card
      size="small"
      title={
        <Text strong className="text-sm">
          {dryRun ? "预览结果" : "执行导入"}
        </Text>
      }
      className="shadow-sm"
    >
      {status === "idle" && (
        <Button
          type="primary"
          icon={<Play size={16} />}
          onClick={onStart}
          disabled={disabled}
          block
          size="large"
        >
          {dryRun ? "开始预览" : "开始导入"}
        </Button>
      )}

      {status === "importing" && (
        <div className="space-y-3">
          <Progress
            percent={percent}
            status="active"
            strokeColor={{ "0%": "#108ee9", "100%": "#87d068" }}
            format={() => (
              <Text className="text-sm">
                {progress} / {total} 篇
              </Text>
            )}
          />
          <div className="flex justify-between text-xs">
            <Text type="secondary">正在处理文档...</Text>
            <Space>
              <Text type="success">成功: {imported}</Text>
              <Text type="warning">跳过: {skipped}</Text>
            </Space>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-3">
          <Progress
            percent={100}
            status="success"
            format={() => (
              <Text strong className="text-green-600">
                ✅ 完成
              </Text>
            )}
          />
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <Text strong className="text-green-700 block mb-1">
              {dryRun ? "预览完成" : "导入完成"}
            </Text>
            <div className="space-y-1">
              <Text className="text-sm block">📄 总数: {total} 篇</Text>
              <Text className="text-sm block text-green-600">
                ✅ 成功: {imported} 篇
              </Text>
              {skipped > 0 && (
                <Text className="text-sm block text-orange-600">
                  ⏭️ 跳过: {skipped} 篇
                </Text>
              )}
            </div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-3">
          <Progress percent={percent} status="exception" />
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <Text strong type="danger" className="block mb-1">
              ❌ 导入失败
            </Text>
            <Text type="secondary" className="text-xs block">
              {error || "发生未知错误，请重试"}
            </Text>
          </div>
          <Button icon={<RotateCw size={14} />} onClick={onRetry} block>
            重试
          </Button>
        </div>
      )}
    </Card>
  );
}
