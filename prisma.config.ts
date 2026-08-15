import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// 加载 API 工作区的环境变量（DATABASE_URL 等），供 Prisma CLI 使用。
loadEnv({ path: 'apps/api/.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
});
