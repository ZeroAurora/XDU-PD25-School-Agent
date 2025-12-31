import { Card, Typography } from "antd";
import { Info } from "lucide-react";

const { Paragraph, Text } = Typography;

interface APIEndpoint {
  label: string;
  endpoint: string;
}

const API_ENDPOINTS: APIEndpoint[] = [
  { label: "集合统计", endpoint: "GET /api/debug/stats" },
  { label: "文档列表", endpoint: "GET /api/debug/documents" },
  { label: "批量导入", endpoint: "POST /api/debug/batch_ingest" },
  { label: "导出数据", endpoint: "GET /api/debug/export" },
];

export const APIReference = () => {
  return (
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
        {API_ENDPOINTS.map((item) => (
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
  );
};