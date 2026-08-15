/** 后端统一响应格式 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";
export type UserStatus = "ACTIVE" | "DISABLED";
export type RoomStatus = "ACTIVE" | "ENDING" | "ENDED";
export type RoomMemberRole = "OWNER" | "MEMBER";

export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface LoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: User;
}

export interface Room {
  id: string;
  name: string;
  inviteCode: string;
  status: RoomStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
}

export interface RoomMember {
  userId: string;
  nickname: string;
  avatar: string | null;
  role: RoomMemberRole;
  joinedAt: string;
}

export interface JoinRoomResult {
  room: Pick<Room, "id" | "name" | "inviteCode" | "status">;
  member: { userId: string; role: RoomMemberRole; joinedAt: string };
}

export type ProductCategory =
  | "BAIJIU"
  | "BEER"
  | "RED_WINE"
  | "WHITE_WINE"
  | "SPIRITS"
  | "COCKTAIL"
  | "OTHER";

export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  category: ProductCategory;
  volumeMl: number;
  alcoholPercent: number | null;
}

export interface DrinkRecord {
  id: string;
  roomId: string;
  productId: string;
  userId: string;
  barcode: string;
  volumeMlSnapshot: number;
  alcoholPercentSnapshot: number | null;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  user: { id: string; nickname: string; avatar: string | null };
  product: { id: string; name: string; brand: string | null };
}

export interface RoomTotals {
  records: number;
  totalQuantity: number;
  totalVolumeMl: number;
  totalAlcoholMl: number;
}

export interface UserStatItem {
  userId: string;
  nickname: string;
  avatar: string | null;
  quantity: number;
  volumeMl: number;
  alcoholMl: number;
}

export interface ProductStatItem {
  productId: string;
  name: string;
  barcode: string;
  quantity: number;
  volumeMl: number;
}

export interface RoomStatistics {
  total: RoomTotals;
  users: UserStatItem[];
  products: ProductStatItem[];
}
