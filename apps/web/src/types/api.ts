/** 后端统一响应格式 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type RoomStatus = 'ACTIVE' | 'ENDED';
export type RoomMemberRole = 'OWNER' | 'MEMBER';

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
  tokenType: 'Bearer';
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
  room: Pick<Room, 'id' | 'name' | 'inviteCode' | 'status'>;
  member: { userId: string; role: RoomMemberRole; joinedAt: string };
}
