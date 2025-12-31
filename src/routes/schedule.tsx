import { createFileRoute } from "@tanstack/react-router";
import {
  Badge,
  Button,
  Calendar,
  Card,
  DatePicker,
  Form,
  Input,
  List,
  Modal,
  message,
  Popconfirm,
  Select,
  Tag,
  TimePicker,
  Typography,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  Calendar as CalendarIcon,
  Clock,
  Edit2,
  MapPin,
  Plus,
  Search,
  Calendar as TodayIcon,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  useCreateEvent,
  useDeleteEvent,
  useEvents,
  useSearchSchedule,
  useUpdateEvent,
} from "@/hooks/useApi";

const { Title, Text } = Typography;

interface ScheduleFormValues {
  title: string;
  date: Dayjs;
  startTime: Dayjs;
  endTime: Dayjs;
  location?: string;
  type: string;
  description?: string;
}

const eventTypeConfig = {
  course: { color: "blue", label: "课程" },
  activity: { color: "green", label: "活动" },
  exam: { color: "red", label: "考试" },
  meeting: { color: "purple", label: "会议" },
  announcement: { color: "orange", label: "公告" },
} as const;

type EventType = keyof typeof eventTypeConfig;

function getEventTypeConfig(type: string): (typeof eventTypeConfig)[EventType] {
  return (
    eventTypeConfig[type as EventType] || { color: "default", label: type }
  );
}

export const Route = createFileRoute("/schedule")({
  component: RouteComponent,
});

function RouteComponent() {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEvent, setEditingEvent] = useState<{ id: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      title: string;
      date: string;
      startTime: string;
      endTime: string;
      location?: string | null;
      type: string;
      description?: string | null;
    }>
  >([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [form] = Form.useForm<ScheduleFormValues>();

  // React Query hooks
  const { data: events = [] } = useEvents();
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();
  const deleteEventMutation = useDeleteEvent();
  const searchMutation = useSearchSchedule();

  // 按日期分组事件
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, typeof events> = {};
    for (const event of events) {
      if (!grouped[event.date]) {
        grouped[event.date] = [];
      }
      grouped[event.date].push(event);
    }
    return grouped;
  }, [events]);

  // 获取当前选中日期的事件
  const selectedDateEvents = useMemo(() => {
    const dateKey = selectedDate.format("YYYY-MM-DD");
    return (eventsByDate[dateKey] || [])
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [selectedDate, eventsByDate]);

  // 日历单元格渲染
  const dateCellRender = (value: Dayjs) => {
    const dateKey = value.format("YYYY-MM-DD");
    const dateEvents = eventsByDate[dateKey] || [];

    if (dateEvents.length === 0) return null;

    // 最多显示2个事件，避免溢出
    const maxDisplay = 2;
    const displayEvents = dateEvents.slice(0, maxDisplay);
    const remainingCount = dateEvents.length - maxDisplay;

    return (
      <ul className="m-0 list-none overflow-hidden p-0">
        {displayEvents.map((event) => (
          <li
            key={event.id}
            className="overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-tight"
          >
            <Badge
              color={getEventTypeConfig(event.type).color}
              text={
                <span className="inline-block max-w-22.5 overflow-hidden text-ellipsis whitespace-nowrap align-middle">
                  {event.title}
                </span>
              }
            />
          </li>
        ))}
        {remainingCount > 0 && (
          <li className="text-xs text-gray-400">+{remainingCount} 更多</li>
        )}
      </ul>
    );
  };

  // 打开新建日程弹窗
  const openModal = () => {
    setIsEditMode(false);
    setEditingEvent(null);
    form.resetFields();
    // 默认设置为当前选中日期
    form.setFieldsValue({
      date: selectedDate,
      startTime: selectedDate.hour(9).minute(0),
      endTime: selectedDate.hour(10).minute(30),
    });
    setIsModalOpen(true);
  };

  // 打开编辑日程弹窗
  const openEditModal = (event: (typeof events)[0]) => {
    setIsEditMode(true);
    setEditingEvent(event);
    form.setFieldsValue({
      title: event.title,
      type: event.type,
      date: dayjs(event.date, "YYYY-MM-DD"),
      startTime: dayjs(event.startTime, "HH:mm"),
      endTime: dayjs(event.endTime, "HH:mm"),
      location: event.location || undefined,
      description: event.description || undefined,
    });
    setIsModalOpen(true);
  };

  // 跳转到今天
  const goToToday = () => {
    setSelectedDate(dayjs());
  };

  // 关闭弹窗
  const closeModal = () => {
    setIsModalOpen(false);
  };

  // 处理表单提交
  const handleSubmitSchedule = async (values: ScheduleFormValues) => {
    const eventData = {
      title: values.title,
      date: values.date.format("YYYY-MM-DD"),
      startTime: values.startTime.format("HH:mm"),
      endTime: values.endTime.format("HH:mm"),
      location: values.location,
      type: values.type,
      description: values.description,
    };

    try {
      if (isEditMode && editingEvent) {
        await updateEventMutation.mutateAsync({
          id: editingEvent.id,
          data: eventData,
        });
        message.success("日程更新成功");
      } else {
        await createEventMutation.mutateAsync(eventData);
        message.success("日程创建成功");
      }

      setIsModalOpen(false);

      // 如果新日程在当前选中日期，自动选中该日期
      if (values.date.isSame(selectedDate, "day")) {
        setSelectedDate(values.date);
      }
    } catch {
      message.error(isEditMode ? "更新日程失败" : "创建日程失败");
    }
  };

  // 处理搜索
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await searchMutation.mutateAsync(searchQuery);
      setSearchResults(results);
    } catch {
      message.error("搜索失败");
    }
  };

  // 从搜索结果添加到日程
  const handleAddFromSearch = async (event: (typeof searchResults)[0]) => {
    try {
      await createEventMutation.mutateAsync({
        title: event.title,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        type: event.type,
        description: event.description,
      });

      setIsSearchModalOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      message.success("已添加到日程");
    } catch {
      message.error("添加失败");
    }
  };

  // 处理删除事件
  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEventMutation.mutateAsync(eventId);
      message.success("日程已删除");
    } catch {
      message.error("删除日程失败");
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-8 w-8 text-blue-500" />
          <Title level={2} className="m-0!">
            我的日程
          </Title>
        </div>
        <div className="flex gap-2">
          <Button
            icon={<Search className="h-4 w-4" />}
            onClick={() => setIsSearchModalOpen(true)}
            size="large"
          >
            搜索日程
          </Button>
          <Button
            icon={<TodayIcon className="h-4 w-4" />}
            onClick={goToToday}
            size="large"
          >
            回到今天
          </Button>
          <Button
            type="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={openModal}
            size="large"
          >
            新建日程
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 日历视图 */}
        <Card className="lg:col-span-2">
          <Calendar
            cellRender={dateCellRender}
            onSelect={setSelectedDate}
            mode="month"
          />
        </Card>

        {/* 当日详情 */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <span>{selectedDate.format("YYYY年MM月DD日")}</span>
            </div>
          }
          className="lg:col-span-1"
        >
          {selectedDateEvents.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <Text type="secondary">暂无日程安排</Text>
            </div>
          ) : (
            <List
              dataSource={selectedDateEvents}
              renderItem={(event) => (
                <List.Item key={event.id} className="border-b-0! px-0!">
                  <div className="w-full">
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Text strong className="text-base">
                            {event.title}
                          </Text>
                          <Tag color={getEventTypeConfig(event.type).color}>
                            {getEventTypeConfig(event.type).label}
                          </Tag>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {event.startTime} - {event.endTime}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {event.location}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <Text type="secondary" className="mt-1 block text-sm">
                            {event.description}
                          </Text>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="text"
                          size="small"
                          icon={<Edit2 className="h-4 w-4" />}
                          onClick={() => openEditModal(event)}
                        >
                          编辑
                        </Button>
                        <Popconfirm
                          title="确定要删除这个日程吗？"
                          onConfirm={() => handleDeleteEvent(event.id)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<Trash2 className="h-4 w-4" />}
                          >
                            删除
                          </Button>
                        </Popconfirm>
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>

      {/* 图例 */}
      <div className="mt-4">
        <Card size="small">
          <div className="flex items-center gap-6">
            <Text strong>图例：</Text>
            {Object.entries(eventTypeConfig).map(([type, config]) => (
              <Tag key={type} color={config.color}>
                {config.label}
              </Tag>
            ))}
          </div>
        </Card>
      </div>

      {/* 新建/编辑日程弹窗 */}
      <Modal
        title={isEditMode ? "编辑日程" : "新建日程"}
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={closeModal}
        okText={isEditMode ? "保存" : "创建"}
        cancelText="取消"
        width={600}
        confirmLoading={
          createEventMutation.isPending || updateEventMutation.isPending
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitSchedule}
          autoComplete="off"
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: "请输入日程标题" }]}
          >
            <Input placeholder="例如：高等数学课、社团活动" />
          </Form.Item>

          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: "请选择日程类型" }]}
          >
            <Select placeholder="选择日程类型">
              <Select.Option value="course">课程</Select.Option>
              <Select.Option value="activity">活动</Select.Option>
              <Select.Option value="exam">考试</Select.Option>
              <Select.Option value="meeting">会议</Select.Option>
              <Select.Option value="announcement">公告</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="date"
            label="日期"
            rules={[{ required: true, message: "请选择日期" }]}
          >
            <DatePicker className="w-full" placeholder="选择日期" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="startTime"
              label="开始时间"
              rules={[{ required: true, message: "请选择开始时间" }]}
            >
              <TimePicker
                className="w-full"
                format="HH:mm"
                placeholder="开始时间"
              />
            </Form.Item>

            <Form.Item
              name="endTime"
              label="结束时间"
              rules={[{ required: true, message: "请选择结束时间" }]}
            >
              <TimePicker
                className="w-full"
                format="HH:mm"
                placeholder="结束时间"
              />
            </Form.Item>
          </div>

          <Form.Item name="location" label="地点">
            <Input placeholder="例如：教学楼A101、体育馆" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="添加详细描述（可选）" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 搜索日程弹窗 */}
      <Modal
        title="搜索日程"
        open={isSearchModalOpen}
        onCancel={() => {
          setIsSearchModalOpen(false);
          setSearchQuery("");
          setSearchResults([]);
        }}
        footer={null}
        width={600}
      >
        <div className="mb-4 flex gap-2">
          <Input
            placeholder="输入关键词搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
          <Button
            type="primary"
            icon={<Search className="h-4 w-4" />}
            onClick={handleSearch}
            loading={searchMutation.isPending}
          >
            搜索
          </Button>
        </div>

        {searchResults.length > 0 && (
          <List
            dataSource={searchResults}
            renderItem={(event) => (
              <List.Item
                key={event.id}
                actions={[
                  <Button
                    key="add"
                    type="primary"
                    size="small"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => handleAddFromSearch(event)}
                    loading={createEventMutation.isPending}
                  >
                    添加
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <div className="flex items-center gap-2">
                      <Text strong>{event.title}</Text>
                      <Tag color={getEventTypeConfig(event.type).color}>
                        {getEventTypeConfig(event.type).label}
                      </Tag>
                    </div>
                  }
                  description={`${event.date} ${event.startTime} - ${event.endTime}${event.location ? ` | ${event.location}` : ""}`}
                />
              </List.Item>
            )}
          />
        )}
        {searchQuery &&
          searchResults.length === 0 &&
          !searchMutation.isPending && (
            <div className="py-8 text-center text-gray-400">未找到相关日程</div>
          )}
      </Modal>
    </div>
  );
}
