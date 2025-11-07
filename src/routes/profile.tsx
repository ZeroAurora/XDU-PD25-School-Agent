import { createFileRoute } from "@tanstack/react-router";
import { Card, Descriptions } from "antd";

export const Route = createFileRoute("/profile")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <Card title="个人信息">
        <Descriptions column={1}>
          <Descriptions.Item label="学号">2021XXXXXX</Descriptions.Item>
          <Descriptions.Item label="姓名">示例用户</Descriptions.Item>
          <Descriptions.Item label="专业">计算机科学与技术</Descriptions.Item>
          <Descriptions.Item label="年级">2021级</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
