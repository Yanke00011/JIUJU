import type { User } from '@prisma/client';

/**
 * Argon2id 参数（与 prisma/seed.ts 保持一致）。
 * algorithm 缺省即为 Argon2id。
 */
export const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * JWT Payload（最小化）。
 * 禁止放入 password、passwordHash、username、nickname 等敏感信息。
 */
export interface JwtPayload {
  sub: string;
  role: User['role'];
}
