import { RobotOutlined, UserOutlined } from "@ant-design/icons";
import { Bubble, Sender, useXAgent, useXChat, Welcome } from "@ant-design/x";
import { createFileRoute } from "@tanstack/react-router";
import type { GetProp } from "antd";
import React from "react";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

const roles: GetProp<typeof Bubble.List, "roles"> = {
  ai: {
    placement: "start",
    avatar: { icon: <RobotOutlined />, className: "bg-[#fde3cf]" },
    typing: { step: 5, interval: 20 },
  },
  local: {
    placement: "end",
    avatar: { icon: <UserOutlined />, className: "bg-[#87d068]" },
  },
};

function RouteComponent() {
  const [content, setContent] = React.useState("");

  // Create agent for handling campus activity requests
  const [agent] = useXAgent<string, { message: string }, string>({
    request: async ({ message }, { onSuccess, onError }) => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        // Mock response - will be replaced with actual RAG-based retrieval
        const response = `我已收到您的请求："${message}"。这里是一些推荐的校园活动：\n\n1. 计算机学院学术讲座 - 今天下午3点\n2. 校园音乐节 - 本周六\n3. 创新创业大赛宣讲 - 下周二`;
        onSuccess([response]);
      } catch (error) {
        onError(new Error("请求失败，请重试"));
      }
    },
  });

  // Manage chat messages with useXChat
  const { onRequest, messages } = useXChat({
    agent,
    requestPlaceholder: "正在思考...",
    requestFallback: "抱歉，出现了一些问题。请重试。",
  });

  return (
    <div className="h-full flex flex-col px-6 max-w-[1200px] mx-auto w-full">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden pt-6">
        <Welcome
          className="flex-initial"
          icon={<RobotOutlined className="text-4xl text-[#fa8c16]" />}
          title="校园活动助手"
          description="欢迎使用校园活动助手！您可以询问我关于校园内的各种活动推荐、日程安排等信息。我会根据您的需求，提供个性化的建议和帮助。试试看吧！"
        />
        <Bubble.List
          className="flex-1 pt-4 h-full overflow-y-scroll"
          roles={roles}
          items={messages.map(({ id, message, status }) => ({
            key: id,
            loading: status === "loading",
            role: status === "local" ? "local" : "ai",
            content: message,
          }))}
        />
      </div>

      <div className="flex-none pt-4 pb-6">
        <Sender
          loading={agent.isRequesting()}
          value={content}
          onChange={setContent}
          onSubmit={(nextContent) => {
            onRequest(nextContent);
            setContent("");
          }}
          placeholder="询问校园活动、日程安排、推荐等..."
          autoSize={{ minRows: 2, maxRows: 6 }}
        />
      </div>
    </div>
  );
}
