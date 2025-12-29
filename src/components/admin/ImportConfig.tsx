import { Card, Checkbox, Tooltip, Typography } from "antd";
import { Info } from "lucide-react";
import type { ImportConfig } from "./useBatchImport";

const { Text } = Typography;

interface ImportConfigPanelProps {
  value?: Partial<ImportConfig>;
  onChange?: (config: ImportConfig) => void;
  disabled?: boolean;
}

export function ImportConfigPanel({
  value,
  onChange,
  disabled = false,
}: ImportConfigPanelProps) {
  const config: ImportConfig = {
    skipDuplicates: value?.skipDuplicates ?? true,
    validateFormat: value?.validateFormat ?? true,
    dryRun: value?.dryRun ?? false,
  };

  const handleChange = (key: keyof ImportConfig, checked: boolean) => {
    const newConfig = { ...config, [key]: checked };
    onChange?.(newConfig);
  };

  return (
    <Card
      size="small"
      title={
        <Text strong className="text-sm">
          导入配置
        </Text>
      }
      className="shadow-sm"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={config.skipDuplicates}
              onChange={(e) => handleChange("skipDuplicates", e.target.checked)}
              disabled={disabled}
            >
              <Text className="text-sm">跳过重复文档</Text>
            </Checkbox>
            <Tooltip title="根据文档 ID 检测并跳过已存在的文档">
              <Info size={14} className="text-gray-400 cursor-help" />
            </Tooltip>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={config.validateFormat}
              onChange={(e) => handleChange("validateFormat", e.target.checked)}
              disabled={disabled}
            >
              <Text className="text-sm">验证 JSON 格式</Text>
            </Checkbox>
            <Tooltip title="导入前检查 JSON 结构是否符合要求">
              <Info size={14} className="text-gray-400 cursor-help" />
            </Tooltip>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={config.dryRun}
              onChange={(e) => handleChange("dryRun", e.target.checked)}
              disabled={disabled}
            />
            <div>
              <Text className="text-sm block">试运行模式</Text>
              <Text type="secondary" className="text-xs">
                预览结果但不实际导入
              </Text>
            </div>
          </div>
          <Tooltip title="启用后只会显示预估结果，不会写入数据库">
            <Info size={14} className="text-gray-400 cursor-help" />
          </Tooltip>
        </div>
      </div>
    </Card>
  );
}
