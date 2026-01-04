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
import { useCallback, useEffect, useRef, useState } from "react";

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
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );

  const charQueueRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const pendingContextsRef = useRef<ChatContext[] | null>(null);
  const streamEndedRef = useRef(false);

  const stopFlusher = useCallback(() => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const startFlusher = useCallback(() => {
    if (flushTimerRef.current) return;

    // 逐字刷新间隔（越小越快）
    const intervalMs = 30;

    flushTimerRef.current = setInterval(() => {
      const assistantId = activeAssistantIdRef.current;
      if (!assistantId) {
        stopFlusher();
        return;
      }

      if (charQueueRef.current.length > 0) {
        const ch = charQueueRef.current.shift();
        if (!ch) return;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: `${msg.content}${ch}` }
              : msg,
          ),
        );
        return;
      }

      // 队列已刷空，且服务端已结束：收尾（flush markdown cache + 绑定来源 + 解除 loading）
      if (streamEndedRef.current) {
        const contexts = pendingContextsRef.current;
        pendingContextsRef.current = null;
        streamEndedRef.current = false;

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== assistantId) return msg;
            const nextContexts = contexts ?? msg.contexts;
            const nextContent = msg.content.trim()
              ? msg.content
              : "抱歉，无法获取回复。";
            return { ...msg, content: nextContent, contexts: nextContexts };
          }),
        );

        activeAssistantIdRef.current = null;
        setStreamingMessageId(null);
        setIsStreaming(false);
        stopFlusher();
      }
    }, intervalMs);
  }, [stopFlusher]);

  useEffect(() => {
    return () => {
      stopFlusher();
    };
  }, [stopFlusher]);

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
      if (!userMessage.trim() || isStreaming) return;

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
        setIsStreaming(true);
        setStreamingMessageId(assistantMsgId);
        activeAssistantIdRef.current = assistantMsgId;
        pendingContextsRef.current = null;
        streamEndedRef.current = false;
        charQueueRef.current = [];
        startFlusher();

        const response = await fetch("/api/agent/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ message: userMessage, k: 5, stream: true }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        if (!response.body) {
          throw new Error("浏览器不支持流式响应");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        const applyDelta = (delta: string) => {
          if (!delta) return;
          // 将 chunk 拆成字符队列，客户端逐字输出
          charQueueRef.current.push(...Array.from(delta));
          startFlusher();
        };

        const applyContexts = (contexts: ChatContext[]) => {
          pendingContextsRef.current = contexts;
        };

        const handleEventText = (eventText: string) => {
          const lines = eventText
            .split("\n")
            .map((l) => l.trimEnd())
            .filter(Boolean);
          const dataLines = lines
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice("data:".length).trimStart());
          if (dataLines.length === 0) return;

          const dataStr = dataLines.join("\n");
          const evt = JSON.parse(dataStr) as
            | { type: "meta"; k: number; hits: number }
            | { type: "delta"; delta: string }
            | { type: "done"; contexts: ChatContext[] }
            | { type: "error"; message: string };

          if (evt.type === "delta") {
            applyDelta(evt.delta);
          } else if (evt.type === "done") {
            applyContexts(evt.contexts || []);
            streamEndedRef.current = true;
            startFlusher();
          } else if (evt.type === "error") {
            throw new Error(evt.message || "流式响应错误");
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          for (const part of parts) {
            if (part.trim()) handleEventText(part);
          }
        }

        // Flush any remaining buffered event
        if (buffer.trim()) {
          handleEventText(buffer);
        }

        // 如果服务端没发送 done，也至少触发一次收尾
        streamEndedRef.current = true;
        startFlusher();
      } catch {
        // Update assistant message with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: "抱歉，出现了一些问题。请重试。" }
              : msg,
          ),
        );

        // 终止逐字刷新状态
        charQueueRef.current = [];
        pendingContextsRef.current = null;
        streamEndedRef.current = false;
        activeAssistantIdRef.current = null;
        stopFlusher();
        setStreamingMessageId(null);
        setIsStreaming(false);
      } finally {
        // 正常结束由 flusher 在队列刷空后关闭 isStreaming + streamingMessageId
      }
    },
    [isStreaming, startFlusher, stopFlusher],
  );

  // Render message content with expandable sources
  const renderMessageContent = useCallback(
    (msg: Message) => {
      const contexts = msg.contexts || [];
      const hasContexts = contexts.length > 0;
      const isExpanded = expandedItems.has(msg.id);
      const hasNextChunk = streamingMessageId === msg.id;

      return (
        <div>
          <XMarkdown
            content={msg.content}
            streaming={{ hasNextChunk, enableAnimation: true }}
          />

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
    [expandedItems, streamingMessageId, toggleExpanded],
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
    loading: msg.role === "assistant" && msg.content === "" && isStreaming,
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
          loading={isStreaming}
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
