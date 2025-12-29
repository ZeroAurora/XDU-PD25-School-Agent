import {
  CalendarOutlined,
  HomeOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Layout, Menu } from "antd";

const { Header, Content } = Layout;

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <Layout className="h-screen flex flex-col">
      <Header className="flex items-center flex-none">
        <div className="text-white text-lg font-bold mr-10">校园活动助手</div>
        <Menu
          theme="dark"  
          mode="horizontal"
          defaultSelectedKeys={["home"]}
          className="flex-1 min-w-0"
          items={[
            {
              key: "home",
              icon: <HomeOutlined />,
              label: <Link to="/">首页</Link>,
            },
            {
              key: "schedule",
              icon: <CalendarOutlined />,
              label: <Link to="/schedule">我的日程</Link>,
            },
            {
              key: "profile",
              icon: <UserOutlined />,
              label: <Link to="/profile">个人信息</Link>,
            },
          ]}
        />
      </Header>
      <Content className="flex-1 flex flex-col overflow-y-auto bg-gray-50">
        <Outlet />
      </Content>
      <TanStackDevtools
        config={{
          position: "bottom-left",
        }}
        plugins={[
          {
            name: "Tanstack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
          {
            name: "React Query",
            render: <ReactQueryDevtoolsPanel />,
          },
        ]}
      />
    </Layout>
  );
}
