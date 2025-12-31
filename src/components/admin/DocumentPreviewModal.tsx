import { Modal, Descriptions, Divider, Typography, Button, Popconfirm } from "antd";

const { Title, Paragraph } = Typography;

export interface RAGDocument {
  id: string;
  text: string;
  metadata: Record<string, string>;
  distance?: number;
}

interface DocumentPreviewModalProps {
  document: RAGDocument | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export const DocumentPreviewModal = ({ document, onClose, onDelete }: DocumentPreviewModalProps) => {
  const handleDelete = () => {
    if (document) {
      onDelete(document.id);
      onClose();
    }
  };

  return (
    <Modal
      title="文档详情"
      open={!!document}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除"
          description="确定要删除这篇文档吗？"
          onConfirm={handleDelete}
          okText="确认"
          cancelText="取消"
        >
          <Button key="delete" danger>
            删除
          </Button>
        </Popconfirm>,
      ]}
      width={650}
    >
      {document && (
        <>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">
              <code>{document.id}</code>
            </Descriptions.Item>
            <Descriptions.Item label="标题">
              {document.metadata?.title || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="日期">
              {document.metadata?.date || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="地点">
              {document.metadata?.place || "-"}
            </Descriptions.Item>
            {document.distance !== undefined && (
              <Descriptions.Item label="相似度">
                {((1 - document.distance) * 100).toFixed(1)}%
              </Descriptions.Item>
            )}
          </Descriptions>
          <Divider className="my-4" />
          <Title level={5} className="mb-3">
            文档内容
          </Title>
          <Paragraph className="leading-relaxed">
            {document.text}
          </Paragraph>
        </>
      )}
    </Modal>
  );
};