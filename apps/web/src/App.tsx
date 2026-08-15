import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Spin } from "antd";
import AppLayout from "./components/AppLayout";
import AdminLayout from "./components/AdminLayout";
import PrivateRoute from "./router/PrivateRoute";
import AdminRoute from "./router/AdminRoute";
const Login = lazy(() => import("./pages/Login"));
const Home = lazy(() => import("./pages/Home"));
const CreateRoom = lazy(() => import("./pages/CreateRoom"));
const JoinRoom = lazy(() => import("./pages/JoinRoom"));
const RoomDetail = lazy(() => import("./pages/RoomDetail"));
const DrinkRecord = lazy(() => import("./pages/DrinkRecord"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminRooms = lazy(() => import("./pages/admin/AdminRooms"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminDrinks = lazy(() => import("./pages/admin/AdminDrinks"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Spin size="large" tip="正在加载酒局…" /></div>}>
      <Routes>
        {/* 公开路由 */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />

        {/* 需要登录的用户端 */}
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route path="/rooms/create" element={<CreateRoom />} />
          <Route path="/rooms/join" element={<JoinRoom />} />
          <Route path="/rooms/:id" element={<RoomDetail />} />
          <Route path="/rooms/:id/drink" element={<DrinkRecord />} />
        </Route>

        {/* 需要 ADMIN / SUPER_ADMIN */}
        <Route
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route
            path="/admin"
            element={<Navigate to="/admin/dashboard" replace />}
          />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/rooms" element={<AdminRooms />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/drinks" element={<AdminDrinks />} />
          <Route path="/admin/logs" element={<AdminLogs />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
