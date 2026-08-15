import type { UserStatus } from "../types/api";
import { get, patch, post, del } from "./request";

export interface AdminUser {
  id: string;
  username: string;
  nickname: string;
  avatar: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  deletedAt: string | null;
}

export interface AdminUserDetail extends AdminUser {
  roomCount: number;
  drinkRecordCount: number;
}

export interface AdminRoomItem {
  id: string;
  name: string;
  owner: { id: string; username: string; nickname: string } | null;
  memberCount: number;
  status: "ACTIVE" | "ENDED";
  createdAt: string;
  endedAt: string | null;
}

export interface AdminRoomDetail extends AdminRoomItem {
  drinkRecordCount: number;
  stats: {
    totalQuantity: number;
    totalVolumeMl: number;
    totalAlcoholMl: number;
  };
}

export interface AdminRoomMember {
  userId: string;
  nickname: string;
  avatar: string | null;
  role: "OWNER" | "MEMBER";
  joinedAt: string;
}

export interface AdminDrinkItem {
  id: string;
  roomId: string;
  productId: string;
  userId: string;
  barcode: string;
  volumeMlSnapshot: number;
  alcoholPercentSnapshot: number | null;
  quantity: number;
  createdAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  deleteReason: string | null;
  user: { id: string; nickname?: string; username?: string } | null;
  createdByUser: { id: string; nickname?: string; username?: string } | null;
  deletedByUser: { id: string; username: string; nickname: string } | null;
  product: { id: string; name: string; barcode?: string } | null;
  room: { id: string; name: string; inviteCode?: string } | null;
}

export interface AdminProduct {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  category: string;
  volumeMl: number;
  alcoholPercent: number | null;
}

export interface AdminLogItem {
  id: string;
  admin: { id: string; username: string } | null;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AdminDashboard {
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalRooms: number;
    activeRooms: number;
    totalDrinkRecords: number;
    totalProducts: number;
  };
  recentRooms: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: string;
    owner: { id: string; username: string; nickname: string } | null;
  }>;
  recentLogs: Array<{
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    createdAt: string;
    admin: { id: string; username: string } | null;
  }>;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const adminApi = {
  dashboard: () => get<AdminDashboard>("/admin/dashboard"),

  users: {
    list: (params: { page?: number; pageSize?: number; keyword?: string }) =>
      get<PageResult<AdminUser>>("/admin/users", { params }),
    get: (id: string) =>
      get<{ user: AdminUserDetail }>(`/admin/users/${id}`).then((r) => r.user),
    updateStatus: (id: string, status: UserStatus) =>
      patch<{ user: AdminUser }>(`/admin/users/${id}/status`, { status }).then(
        (r) => r.user,
      ),
    remove: (id: string) =>
      del<{ deleted: boolean; softDeleted: boolean }>(`/admin/users/${id}`),
  },

  rooms: {
    list: (params: { page?: number; pageSize?: number; keyword?: string }) =>
      get<PageResult<AdminRoomItem>>("/admin/rooms", { params }),
    get: (id: string) =>
      get<{ room: AdminRoomDetail }>(`/admin/rooms/${id}`).then((r) => r.room),
    members: (id: string) =>
      get<{ items: AdminRoomMember[] }>(`/admin/rooms/${id}/members`).then(
        (r) => r.items,
      ),
    drinks: (id: string, params: { page?: number; pageSize?: number }) =>
      get<PageResult<AdminDrinkItem>>(`/admin/rooms/${id}/drinks`, { params }),
    end: (id: string) =>
      post<{ room: AdminRoomItem }>(`/admin/rooms/${id}/end`).then(
        (r) => r.room,
      ),
    exportUrl: (id: string) => `/admin/rooms/${id}/export`,
  },

  products: {
    list: (params: { page?: number; pageSize?: number; keyword?: string }) =>
      get<PageResult<AdminProduct>>("/admin/products", { params }),
    create: (data: {
      barcode: string;
      name: string;
      brand?: string;
      category: string;
      volumeMl: number;
      alcoholPercent?: number;
    }) =>
      post<{ product: AdminProduct }>("/admin/products", data).then(
        (r) => r.product,
      ),
    update: (id: string, data: Partial<AdminProduct>) =>
      patch<{ product: AdminProduct }>(`/admin/products/${id}`, data).then(
        (r) => r.product,
      ),
    remove: (id: string) => del<{ success: boolean }>(`/admin/products/${id}`),
  },

  drinks: {
    list: (params: {
      page?: number;
      pageSize?: number;
      roomId?: string;
      userId?: string;
      productId?: string;
      startDate?: string;
      endDate?: string;
    }) => get<PageResult<AdminDrinkItem>>("/admin/drinks", { params }),
    restore: (id: string) =>
      post<{ record: AdminDrinkItem }>(`/admin/drinks/${id}/restore`).then(
        (r) => r.record,
      ),
  },

  logs: {
    list: (params: {
      page?: number;
      pageSize?: number;
      action?: string;
      targetType?: string;
      adminUserId?: string;
    }) => get<PageResult<AdminLogItem>>("/admin/logs", { params }),
    get: (id: string) =>
      get<{ log: AdminLogItem }>(`/admin/logs/${id}`).then((r) => r.log),
  },
};
