import { Button, Progress, Typography, Upload } from "antd";
import { CheckCircle, FileJson, UploadCloud, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { BatchFileInfo } from "./useBatchImport";

const { Text } = Typography;

interface FileUploadAreaProps {
  value?: BatchFileInfo | null;
  onChange?: (file: File | null, info?: BatchFileInfo) => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SAMPLE_TEMPLATE = [
  {
    id: "doc-001",
    text: "校园马拉松活动将于本周六上午8点在体育场举行，欢迎同学们踊跃参加。",
    metadata: {
      title: "校园马拉松活动通知",
      date: "2025-12-08",
      place: "体育场",
    },
  },
  {
    id: "doc-002",
    text: "图书馆将于本周日下午进行设备维护，届时将临时闭馆2小时。",
    metadata: { title: "图书馆闭馆通知", date: "2025-12-09", place: "图书馆" },
  },
];

export function FileUploadArea({
  value,
  onChange,
  disabled = false,
}: FileUploadAreaProps) {
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const analyzeFile = useCallback(
    async (file: File): Promise<BatchFileInfo> => {
      const content = await file.text();
      try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) {
          throw new Error("JSON文件必须包含文档数组");
        }
        const documentCount = parsed.length;
        const preview =
          documentCount > 0 ? JSON.stringify(parsed[0], null, 2) : undefined;
        setJsonError(null);
        return { name: file.name, size: file.size, documentCount, preview };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "JSON解析失败";
        setJsonError(msg);
        throw new Error(msg);
      }
    },
    [],
  );

  const handleFileChange = useCallback(
    async (file: File) => {
      try {
        const info = await analyzeFile(file);
        onChange?.(file, info);
      } catch {
        onChange?.(null);
      }
      return false;
    },
    [analyzeFile, onChange],
  );

  const handleRemove = useCallback(() => {
    setJsonError(null);
    onChange?.(null);
  }, [onChange]);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([JSON.stringify(SAMPLE_TEMPLATE, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "batch-import-template.json";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const progress = useMemo(() => {
    if (!value) return 0;
    return Math.min(100, (value.documentCount / 100) * 100);
  }, [value]);

  const uploadProps = {
    accept: ".json",
    maxCount: 1,
    disabled,
    beforeUpload: handleFileChange,
    onRemove: handleRemove,
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
    },
    fileList: value
      ? [
          {
            uid: `selected-${Date.now()}`,
            name: value.name,
            status: "done" as const,
            size: value.size,
          },
        ]
      : [],
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Text strong className="text-sm">
          选择文件
        </Text>
        <Button
          type="link"
          size="small"
          icon={<FileJson size={14} />}
          onClick={handleDownloadTemplate}
        >
          下载模板
        </Button>
      </div>

      <Upload.Dragger
        {...uploadProps}
        className={`transition-all duration-200 ${
          jsonError
            ? "bg-red-50!"
            : value
              ? "bg-green-50!"
              : dragOver
                ? "bg-blue-50!"
                : ""
        }`}
      >
        <div
          className={`py-6 px-4 transition-all duration-200 ${dragOver ? "scale-105" : ""}`}
        >
          <div className="flex justify-center mb-3">
            {jsonError ? (
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <X size={28} className="text-red-500" />
              </div>
            ) : value ? (
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle size={28} className="text-green-500" />
              </div>
            ) : (
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  dragOver ? "bg-blue-100" : "bg-gray-100"
                }`}
              >
                <UploadCloud
                  size={28}
                  className={dragOver ? "text-blue-500" : "text-gray-400"}
                />
              </div>
            )}
          </div>

          {value ? (
            <>
              <Text strong className="text-base block">
                {value.name}
              </Text>
              <Text type="secondary" className="text-xs">
                {formatFileSize(value.size)} · {value.documentCount} 篇文档
              </Text>
            </>
          ) : (
            <>
              <p className="ant-upload-text font-medium text-gray-700">
                点击或拖拽 JSON 文件到此区域
              </p>
              <p className="ant-upload-hint text-gray-400 text-xs mt-1">
                支持批量导入文档数组，单个文件不超过 10MB
              </p>
            </>
          )}

          {value && value.documentCount > 0 && (
            <div className="mt-4 w-48 mx-auto">
              <Progress
                percent={progress}
                size="small"
                strokeColor={
                  jsonError
                    ? "#ef4444"
                    : value.documentCount >= 50
                      ? "#22c55e"
                      : "#3b82f6"
                }
                format={() => (
                  <span className="text-xs">{value.documentCount} 篇</span>
                )}
              />
            </div>
          )}

          {value && value.documentCount > 0 && (
            <div
              className={`mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs ${
                jsonError
                  ? "bg-red-100 text-red-700"
                  : value.documentCount >= 50
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
              }`}
            >
              <FileJson size={12} />
              <span>{value.documentCount} 篇文档已加载</span>
            </div>
          )}
        </div>
      </Upload.Dragger>

      {jsonError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <Text type="danger" className="text-sm">
            ❌ {jsonError}
          </Text>
        </div>
      )}
    </div>
  );
}
