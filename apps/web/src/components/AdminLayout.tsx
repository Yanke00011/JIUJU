import { useState } from "react";
import { Layout, Menu, Button, Drawer } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  UserOutlined,
  HomeOutlined,
  ShoppingOutlined,
  EditOutlined,
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
  { key: "/admin/drinks", icon: <EditOutlined />, label: "饮酒记录" },
  { key: "/admin/logs", icon: <FileTextOutlined />, label: "操作日志" },
];

function buildMenu(onNavigate?: () => void) {
  return function MenuContent() {
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
  };
}

/**
 * 管理后台布局：
 * 桌面端：左侧固定 Sider（唯一导航）；
 * 移动端：顶部汉堡按钮打开唯一 Drawer（仅移动端显示汉堡按钮，避免双导航）。
 */
export default function AdminLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [siderCollapsed, setSiderCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const SiderMenu = buildMenu();
  const DrawerMenu = buildMenu(() => setDrawerOpen(false));

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* 桌面端侧边栏（唯一导航）；移动端自动折叠 */}
      <Layout.Sider
        breakpoint="lg"
        collapsedWidth={0}
        trigger={null}
        collapsible
        collapsed={siderCollapsed}
        onBreakpoint={(broken) => setSiderCollapsed(broken)}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "auto",
        }}
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
        <SiderMenu />
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
            {/* 仅移动端显示汉堡按钮（侧边栏折叠时） */}
            {siderCollapsed && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setDrawerOpen(true)}
                style={{ display: "inline-flex" }}
              />
            )}
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

      {/* 移动端唯一导航抽屉 */}
      <Drawer
        title="酒局管家 · 后台"
        placement="left"
        width={240}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        <DrawerMenu />
      </Drawer>
    </Layout>
  );
}
