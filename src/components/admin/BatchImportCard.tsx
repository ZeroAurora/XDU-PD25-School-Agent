import { Button, Card, message, Space, Tag, Tooltip, Typography } from "antd";
import { Eye, FileJson, RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { FileUploadArea } from "./FileUploadArea";
import { ImportConfigPanel } from "./ImportConfig";
import { ImportProgress } from "./ImportProgress";
import { useBatchImport } from "./useBatchImport";

const { Text } = Typography;

interface BatchImportCardProps {
  onImportComplete?: () => void;
}

export function BatchImportCard({ onImportComplete }: BatchImportCardProps) {
  const {
    fileInfo,
    config,
    importState,
    setFile,
    setFileInfo,
    updateConfig,
    startImport,
    reset,
    retry,
    canImport,
    isImporting,
  } = useBatchImport();

  const handleStartImport = useCallback(async () => {
    await startImport();
    onImportComplete?.();
  }, [startImport, onImportComplete]);

  const handleReset = useCallback(() => {
    reset();
    message.info("已重置导入配置");
  }, [reset]);

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <FileJson size={18} className="text-orange-500" />
          <Text strong>批量导入</Text>
          {fileInfo && (
            <Tag color="blue" className="ml-2">
              {fileInfo.documentCount} 篇文档
            </Tag>
          )}
        </div>
      }
      className="shadow-sm"
      extra={
        <Space>
          {importState.status !== "idle" && (
            <Tooltip title="重置导入">
              <Button
                type="text"
                size="small"
                icon={<RefreshCw size={14} />}
                onClick={handleReset}
              />
            </Tooltip>
          )}
        </Space>
      }
    >
      <div className="space-y-4">
        <FileUploadArea
          value={fileInfo}
          onChange={(f, info) => {
            setFile(f);
            setFileInfo(info ?? null);
          }}
          disabled={isImporting}
        />

        <ImportConfigPanel
          value={config}
          onChange={updateConfig}
          disabled={isImporting}
        />

        <ImportProgress
          status={importState.status}
          progress={importState.progress}
          total={importState.total}
          imported={importState.imported}
          skipped={importState.skipped}
          error={importState.error}
          onStart={handleStartImport}
          onRetry={retry}
          disabled={!canImport}
          dryRun={config.dryRun}
        />

        {importState.status === "success" && (
          <div className="flex justify-end gap-2">
            <Button
              icon={<Eye size={14} />}
              onClick={() => {
                const element = document.querySelector('[class*="Document"]');
                element?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              查看导入的文档
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
