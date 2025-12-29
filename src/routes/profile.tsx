import { createFileRoute } from "@tanstack/react-router";
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  message,
  Select,
  Switch,
  Typography,
} from "antd";
import { useEffect, useState } from "react";

const { Title } = Typography;

export const Route = createFileRoute("/profile")({
  component: RouteComponent,
});

interface UserProfile {
  studentId: string;
  name: string;
  major: string;
  grade: string;
}

interface UserSettings {
  theme: "light" | "dark";
  defaultCalendarView: "month" | "week" | "day";
  showNotifications: boolean;
  autoRefresh: boolean;
}

const PROFILE_KEY = "user_profile";
const SETTINGS_KEY = "user_settings";

function RouteComponent() {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    studentId: "2021XXXXXX",
    name: "示例用户",
    major: "计算机科学与技术",
    grade: "2021级",
  });
  const [settings, setSettings] = useState<UserSettings>({
    theme: "light",
    defaultCalendarView: "month",
    showNotifications: true,
    autoRefresh: false,
  });

  const [profileForm] = Form.useForm();
  const [settingsForm] = Form.useForm();

  // Load from localStorage
  useEffect(() => {
    const savedProfile = localStorage.getItem(PROFILE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_KEY);

    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setProfile(parsed);
      profileForm.setFieldsValue(parsed);
    }

    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      settingsForm.setFieldsValue(parsed);
    }
  }, [profileForm, settingsForm]);

  // Save profile
  const handleSaveProfile = async (values: UserProfile) => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(values));
      setProfile(values);
      setEditing(false);
      message.success("个人信息已保存");
    } catch (_error) {
      message.error("保存失败");
    }
  };

  // Save settings
  const handleSaveSettings = async (values: UserSettings) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(values));
      setSettings(values);
      message.success("设置已保存");
    } catch (_error) {
      message.error("保存失败");
    }
  };

  return (
    <div className="p-6 max-w-300 mx-auto space-y-6">
      <Title level={2}>个人设置</Title>

      {/* Profile Section */}
      <Card
        title="个人信息"
        extra={
          editing ? (
            <div className="flex gap-2">
              <Button onClick={() => setEditing(false)}>取消</Button>
              <Button type="primary" onClick={profileForm.submit}>
                保存
              </Button>
            </div>
          ) : (
            <Button onClick={() => setEditing(true)}>编辑</Button>
          )
        }
      >
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleSaveProfile}
          initialValues={profile}
        >
          <Form.Item
            name="studentId"
            label="学号"
            rules={[{ required: true, message: "请输入学号" }]}
          >
            <Input disabled={!editing} placeholder="请输入学号" />
          </Form.Item>

          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input disabled={!editing} placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item
            name="major"
            label="专业"
            rules={[{ required: true, message: "请输入专业" }]}
          >
            <Input disabled={!editing} placeholder="请输入专业" />
          </Form.Item>

          <Form.Item
            name="grade"
            label="年级"
            rules={[{ required: true, message: "请输入年级" }]}
          >
            <Input disabled={!editing} placeholder="如: 2021级" />
          </Form.Item>
        </Form>
      </Card>

      {/* Preferences Section */}
      <Card title="偏好设置">
        <Form
          form={settingsForm}
          layout="vertical"
          onFinish={handleSaveSettings}
          initialValues={settings}
        >
          <Form.Item name="theme" label="主题" tooltip="选择应用的主题颜色">
            <Select>
              <Select.Option value="light">浅色模式</Select.Option>
              <Select.Option value="dark">深色模式</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="defaultCalendarView"
            label="默认日历视图"
            tooltip="选择日历页面的默认显示方式"
          >
            <Select>
              <Select.Option value="month">月视图</Select.Option>
              <Select.Option value="week">周视图</Select.Option>
              <Select.Option value="day">日视图</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="showNotifications"
            label="显示通知"
            valuePropName="checked"
          >
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>

          <Form.Item
            name="autoRefresh"
            label="自动刷新"
            tooltip="自动刷新日历和活动数据"
            valuePropName="checked"
          >
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* About Section */}
      <Card title="关于">
        <Descriptions column={1}>
          <Descriptions.Item label="应用名称">校园活动助手</Descriptions.Item>
          <Descriptions.Item label="版本">1.0.0</Descriptions.Item>
          <Descriptions.Item label="技术栈">
            React + TypeScript + FastAPI + ChromaDB
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
