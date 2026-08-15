import type { User } from '@prisma/client';

/**
 * 对外返回的公开用户信息。
 * 任何 API 都不得返回 passwordHash，也不得返回服务端内部字段。
 */
export interface PublicUser {
  id: string;
  username: string;
  nickname: string;
  avatar: string | null;
  role: User['role'];
  status: User['status'];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}
