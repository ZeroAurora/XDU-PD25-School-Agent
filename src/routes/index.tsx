import {
  ExpandOutlined,
  NodeCollapseOutlined,
  RobotOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Bubble, type BubbleListProps, Sender, Welcome } from "@ant-design/x";
import { XMarkdown } from "@ant-design/x-markdown";
import { createFileRoute } from "@tanstack/react-router";
import { Avatar, Button, Card, Collapse, Flex, Tag, Typography } from "antd";
import { useCallback, useState } from "react";
import { useChat } from "@/hooks/useApi";

const { Text } = Typography;

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

interface ChatContext {
  text: string;
  metadata: Record<string, string>;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  contexts?: ChatContext[];
}

function RouteComponent() {
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const chatMutation = useChat();

  // Toggle expanded state for contexts
  const toggleExpanded = useCallback((messageId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  // Handle chat request
  const handleRequest = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || chatMutation.isPending) return;

      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now()}`;

      // Add user message
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, content: userMessage, role: "user" },
      ]);

      // Add placeholder for assistant
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, content: "", role: "assistant" },
      ]);

      try {
        const data = await chatMutation.mutateAsync({ message: userMessage });

        // Update assistant message with response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: data.reply || "抱歉，无法获取回复。",
                  contexts: data.contexts || [],
                }
              : msg,
          ),
        );
      } catch {
        // Update assistant message with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: "抱歉，出现了一些问题。请重试。" }
              : msg,
          ),
        );
      }
    },
    [chatMutation],
  );

  // Render message content with expandable sources
  const renderMessageContent = useCallback(
    (msg: Message) => {
      const contexts = msg.contexts || [];
      const hasContexts = contexts.length > 0;
      const isExpanded = expandedItems.has(msg.id);

      return (
        <div>
          <XMarkdown content={msg.content} />

          {hasContexts && (
            <div className="mt-3">
              <Button
                type="link"
                size="small"
                icon={
                  isExpanded ? <NodeCollapseOutlined /> : <ExpandOutlined />
                }
                onClick={() => toggleExpanded(msg.id)}
                className="p-0 h-auto text-gray-500"
              >
                {isExpanded ? "收起来源" : `查看来源 (${contexts.length})`}
              </Button>

              {isExpanded && (
                <Collapse
                  size="small"
                  className="mt-2"
                  bordered={false}
                  items={[
                    {
                      key: "sources",
                      label: "信息来源",
                      children: (
                        <div className="space-y-2">
                          {contexts.map((ctx, idx) => (
                            <Card
                              key={`${msg.id}-ctx-${idx}`}
                              size="small"
                              className="bg-gray-50"
                            >
                              <div className="text-sm">
                                <div className="flex items-center gap-2 mb-1">
                                  <Text strong>{idx + 1}.</Text>
                                  {ctx.metadata.title && (
                                    <Tag color="blue">{ctx.metadata.title}</Tag>
                                  )}
                                  {ctx.metadata.date && (
                                    <Text type="secondary">
                                      {ctx.metadata.date}
                                    </Text>
                                  )}
                                </div>
                                <Text type="secondary" className="text-xs">
                                  {ctx.text}
                                </Text>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          )}
        </div>
      );
    },
    [expandedItems, toggleExpanded],
  );

  // Role configuration for Bubble.List
  const roles: BubbleListProps["role"] = {
    user: {
      placement: "end",
      avatar: (
        <Avatar icon={<UserOutlined />} style={{ background: "#1677ff" }} />
      ),
    },
    assistant: {
      placement: "start",
      avatar: (
        <Avatar icon={<RobotOutlined />} style={{ background: "#fa8c16" }} />
      ),
      typing: { effect: "typing", step: 5, interval: 20 },
    },
  };

  // Convert messages to Bubble.List items
  const bubbleItems = messages.map((msg) => ({
    key: msg.id,
    role: msg.role === "user" ? "user" : "assistant",
    content: msg.role === "user" ? msg.content : renderMessageContent(msg),
    loading:
      msg.role === "assistant" && msg.content === "" && chatMutation.isPending,
  }));

  return (
    <Flex
      vertical
      className="h-full px-6 max-w-300 mx-auto w-full"
      style={{ height: "100%" }}
    >
      <Flex
        vertical
        flex={1}
        style={{ minHeight: 0, overflow: "hidden", paddingTop: 24 }}
      >
        {messages.length === 0 && (
          <Welcome
            icon={<RobotOutlined style={{ fontSize: 40, color: "#fa8c16" }} />}
            title="校园活动助手"
            description="欢迎使用校园活动助手！您可以询问我关于校园内的各种活动推荐、日程安排等信息。我会根据您的需求，提供个性化的建议和帮助。试试看吧！"
            variant="borderless"
          />
        )}

        <Bubble.List
          style={{ flex: 1, paddingTop: 16, overflow: "auto" }}
          role={roles}
          items={bubbleItems}
        />
      </Flex>

      <div style={{ paddingTop: 16, paddingBottom: 24 }}>
        <Sender
          loading={chatMutation.isPending}
          value={content}
          onChange={setContent}
          onSubmit={(nextContent) => {
            handleRequest(nextContent);
            setContent("");
          }}
          placeholder="询问校园活动、日程安排、推荐等..."
        />
      </div>
    </Flex>
  );
}
