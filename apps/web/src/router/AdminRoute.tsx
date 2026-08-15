import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../store/auth";

/**
 * 管理员路由：需要登录且角色为 ADMIN / SUPER_ADMIN。
 * 未登录跳转 /login；已登录但非管理员跳转 /（无权限）。
 */
export default function AdminRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.user?.role);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
