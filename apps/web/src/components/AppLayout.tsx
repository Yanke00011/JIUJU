import { Layout, Button } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { Outlet, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../store/auth";

/**
 * 移动端友好的基础布局：顶部栏 + 内容区。
 * 支持两种用法：
 * 1. 作为路由布局组件，通过 <Outlet /> 渲染子路由；
 * 2. 直接传入 children 渲染内容。
 */
export default function AppLayout({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <div className="brand-lockup" onClick={() => navigate("/")}>
          <span className="brand-mark">酒</span>
          <span><strong>酒局管家</strong><small>JIUJU SOCIAL CLUB</small></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAdmin && (
            <Button
              size="small"
              type="text"
              onClick={() => navigate("/admin")}
            >
              管理后台
            </Button>
          )}
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            {user?.nickname || user?.username}
          </span>
          <Button
            size="small"
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
          >
            退出
          </Button>
        </div>
      </Layout.Header>
      <Layout.Content className="app-content">
        {children ?? <Outlet />}
      </Layout.Content>
    </Layout>
  );
}
