import { createFileRoute } from '@tanstack/react-router'
import { Badge, Calendar, type CalendarProps, Card, List, Tag, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react'
import { useMemo, useState } from 'react'

const { Title, Text } = Typography

interface ScheduleEvent {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  location?: string
  type: 'course' | 'activity' | 'exam' | 'meeting'
  description?: string
}

// 示例数据
const sampleEvents: ScheduleEvent[] = [
  {
    id: '1',
    title: '高等数学',
    date: '2025-11-07',
    startTime: '08:00',
    endTime: '09:40',
    location: '教学楼A101',
    type: 'course',
    description: '第三章：微分学应用',
  },
  {
    id: '2',
    title: '数据结构',
    date: '2025-11-07',
    startTime: '10:00',
    endTime: '11:40',
    location: '教学楼B203',
    type: 'course',
  },
  {
    id: '3',
    title: '篮球社团活动',
    date: '2025-11-08',
    startTime: '16:00',
    endTime: '18:00',
    location: '体育馆',
    type: 'activity',
    description: '社团友谊赛',
  },
  {
    id: '4',
    title: '英语四级模拟考试',
    date: '2025-11-10',
    startTime: '14:00',
    endTime: '16:00',
    location: '教学楼C401',
    type: 'exam',
  },
  {
    id: '5',
    title: '项目组会议',
    date: '2025-11-12',
    startTime: '15:00',
    endTime: '16:30',
    location: '实验室208',
    type: 'meeting',
    description: '讨论项目进度与下周计划',
  },
  {
    id: '6',
    title: '计算机网络',
    date: '2025-11-12',
    startTime: '08:00',
    endTime: '09:40',
    location: '教学楼D302',
    type: 'course',
  },
]

const eventTypeConfig = {
  course: { color: 'blue', label: '课程' },
  activity: { color: 'green', label: '活动' },
  exam: { color: 'red', label: '考试' },
  meeting: { color: 'purple', label: '会议' },
}

export const Route = createFileRoute('/schedule')({
  component: RouteComponent,
})

function RouteComponent() {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())

  // 按日期分组事件
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, ScheduleEvent[]> = {}
    for (const event of sampleEvents) {
      if (!grouped[event.date]) {
        grouped[event.date] = []
      }
      grouped[event.date].push(event)
    }
    return grouped
  }, [])

  // 获取当前选中日期的事件
  const selectedDateEvents = useMemo(() => {
    const dateKey = selectedDate.format('YYYY-MM-DD')
    return (eventsByDate[dateKey] || []).slice().sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    )
  }, [selectedDate, eventsByDate])

  // 日历单元格渲染
  const dateCellRender = (value: Dayjs) => {
    const dateKey = value.format('YYYY-MM-DD')
    const events = eventsByDate[dateKey] || []

    if (events.length === 0) return null

    // 最多显示2个事件，避免溢出
    const maxDisplay = 2
    const displayEvents = events.slice(0, maxDisplay)
    const remainingCount = events.length - maxDisplay

    return (
      <ul className="m-0 list-none overflow-hidden p-0">
        {displayEvents.map((event) => (
          <li key={event.id} className="overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-tight">
            <Badge
              color={eventTypeConfig[event.type].color}
              text={
                <span className="inline-block max-w-[90px] overflow-hidden text-ellipsis whitespace-nowrap align-middle">
                  {event.title}
                </span>
              }
            />
          </li>
        ))}
        {remainingCount > 0 && (
          <li className="text-xs text-gray-400">
            +{remainingCount} 更多
          </li>
        )}
      </ul>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <CalendarIcon className="h-8 w-8 text-blue-500" />
        <Title level={2} className="m-0!">
          我的日程
        </Title>
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
              <span>{selectedDate.format('YYYY年MM月DD日')}</span>
            </div>
          }
          className="lg:col-span-1"
        >
          {selectedDateEvents.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <CalendarIcon className="mx-auto mb-2 h-12 w-12 opacity-50" />
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
                          <Tag color={eventTypeConfig[event.type].color}>
                            {eventTypeConfig[event.type].label}
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
    </div>
  )
}
