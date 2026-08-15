import { Layout, Button } from "antd";
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
    <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Layout.Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: 600,
            cursor: "pointer",
          }}
          onClick={() => navigate("/")}
        >
          酒局管家
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAdmin && (
            <Button
              size="small"
              type="text"
              style={{ color: "#fff" }}
              onClick={() => navigate("/admin")}
            >
              管理后台
            </Button>
          )}
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
            {user?.nickname || user?.username}
          </span>
          <Button
            size="small"
            type="text"
            style={{ color: "#fff" }}
            onClick={handleLogout}
          >
            退出
          </Button>
        </div>
      </Layout.Header>
      <Layout.Content
        style={{
          padding: 16,
          maxWidth: 560,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {children ?? <Outlet />}
      </Layout.Content>
    </Layout>
  );
}
