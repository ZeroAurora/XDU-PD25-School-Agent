import { Alert, Button, Card, Popconfirm } from "antd";
import { AlertTriangle, Delete, Import, Trash2 } from "lucide-react";

interface DangerZoneProps {
  onReset: () => void;
  onDeleteAll: () => void;
  onSeed: () => void;
  loading: boolean;
}

export const DangerZone = ({
  onReset,
  onDeleteAll,
  onSeed,
  loading,
}: DangerZoneProps) => {
  return (
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
        title="警告"
        description="以下操作具有不可逆性，请谨慎操作。"
        type="warning"
        showIcon
        className="mb-4"
      />
      <div className="flex flex-wrap gap-3 mt-4">
        <Popconfirm
          title="确认重置集合"
          description="此操作将删除所有数据并重建集合。"
          onConfirm={onReset}
          okText="确认"
          cancelText="取消"
        >
          <Button
            danger
            icon={<Trash2 size={14} />}
            size="small"
            loading={loading}
          >
            重置集合
          </Button>
        </Popconfirm>
        <Popconfirm
          title="确认清空"
          description="此操作将删除所有文档。"
          onConfirm={onDeleteAll}
          okText="确认"
          cancelText="取消"
        >
          <Button
            danger
            icon={<Delete size={14} />}
            size="small"
            loading={loading}
          >
            删除所有文档
          </Button>
        </Popconfirm>
        <Popconfirm
          title="确认填充默认数据"
          description="此操作将填充默认数据。"
          onConfirm={onSeed}
          okText="确认"
          cancelText="取消"
        >
          <Button
            danger
            icon={<Import size={14} />}
            size="small"
            loading={loading}
          >
            填充默认数据
          </Button>
        </Popconfirm>
      </div>
    </Card>
  );
};
