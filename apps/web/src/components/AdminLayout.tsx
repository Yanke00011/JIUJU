import { useState } from "react";
import { Layout, Menu, Button, Drawer } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  UserOutlined,
  HomeOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  MenuOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";

const MENU_ITEMS: MenuProps["items"] = [
  { key: "/admin/dashboard", icon: <DashboardOutlined />, label: "仪表盘" },
  { key: "/admin/users", icon: <UserOutlined />, label: "用户管理" },
  { key: "/admin/rooms", icon: <HomeOutlined />, label: "房间管理" },
  { key: "/admin/products", icon: <ShoppingOutlined />, label: "商品管理" },
  { key: "/admin/logs", icon: <FileTextOutlined />, label: "操作日志" },
];

function SiderContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedKey =
    MENU_ITEMS?.find(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "key" in item &&
        location.pathname.startsWith(String(item.key)),
    )?.key || "/admin/dashboard";

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[String(selectedKey)]}
      items={MENU_ITEMS}
      onClick={({ key }) => {
        navigate(key);
        onNavigate?.();
      }}
    />
  );
}

/**
 * 管理后台布局：桌面端侧边栏，移动端抽屉菜单。
 */
export default function AdminLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider
        breakpoint="lg"
        collapsedWidth={0}
        style={{ position: "sticky", top: 0, height: "100vh" }}
      >
        <div
          style={{
            color: "#fff",
            textAlign: "center",
            padding: "16px 0",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          酒局管家 · 后台
        </div>
        <SiderContent />
      </Layout.Sider>

      <Layout>
        <Layout.Header
          style={{
            background: "#fff",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              style={{ display: "inline-flex" }}
            />
            <span style={{ fontWeight: 500 }}>管理后台</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#666" }}>
              {user?.nickname || user?.username}
            </span>
            <Button type="text" size="small" onClick={() => navigate("/")}>
              返回用户端
            </Button>
            <Button
              type="text"
              size="small"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
            >
              退出
            </Button>
          </div>
        </Layout.Header>
        <Layout.Content style={{ padding: 16 }}>
          <Outlet />
        </Layout.Content>
      </Layout>

      <Drawer
        title="酒局管家 · 后台"
        placement="left"
        width={240}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        <SiderContent onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </Layout>
  );
}
