import type { UserStatus } from "../types/api";
import { get, patch } from "./request";

export interface AdminUser {
  id: string;
  username: string;
  nickname: string;
  avatar: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
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

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const adminApi = {
  users: {
    list: (page = 1, pageSize = 20) =>
      get<PageResult<AdminUser>>("/admin/users", { params: { page, pageSize } }),
    get: (id: string) => get<{ user: AdminUser }>(`/admin/users/${id}`).then((r) => r.user),
    updateStatus: (id: string, status: UserStatus) =>
      patch<{ user: AdminUser }>(`/admin/users/${id}/status`, { status }).then((r) => r.user),
  },
  rooms: {
    list: (page = 1, pageSize = 20) =>
      get<PageResult<AdminRoomItem>>("/admin/rooms", { params: { page, pageSize } }),
    get: (id: string) => get<{ room: AdminRoomDetail }>(`/admin/rooms/${id}`).then((r) => r.room),
  },
  products: {
    list: (page = 1, pageSize = 20) =>
      get<PageResult<AdminProduct>>("/admin/products", { params: { page, pageSize } }),
    update: (id: string, data: Partial<AdminProduct>) =>
      patch<{ product: AdminProduct }>(`/admin/products/${id}`, data).then((r) => r.product),
  },
  logs: {
    list: (params: {
      page?: number;
      pageSize?: number;
      action?: string;
      targetType?: string;
      adminUserId?: string;
    }) => get<PageResult<AdminLogItem>>("/admin/logs", { params }),
    get: (id: string) => get<{ log: AdminLogItem }>(`/admin/logs/${id}`).then((r) => r.log),
  },
};
