import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import AdminLayout from "./components/AdminLayout";
import PrivateRoute from "./router/PrivateRoute";
import AdminRoute from "./router/AdminRoute";
import Login from "./pages/Login";
import Home from "./pages/Home";
import CreateRoom from "./pages/CreateRoom";
import JoinRoom from "./pages/JoinRoom";
import RoomDetail from "./pages/RoomDetail";
import DrinkRecord from "./pages/DrinkRecord";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminRooms from "./pages/admin/AdminRooms";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminLogs from "./pages/admin/AdminLogs";

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/rooms" element={<AdminRooms />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/logs" element={<AdminLogs />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
