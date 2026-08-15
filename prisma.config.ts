import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// 加载 API 工作区的环境变量（DATABASE_URL 等），供 Prisma CLI 使用。
loadEnv({ path: 'apps/api/.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    // 使用 tsx 执行 seed（ts-node 在生产 Node ESM 环境下会报 Unknown file extension .ts）
    seed: 'tsx prisma/seed.ts',
  },
});
