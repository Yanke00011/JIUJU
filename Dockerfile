# 酒局管家 JIUJU 多阶段构建
# 阶段 1：安装依赖
# 阶段 2：构建（Prisma generate + Nest build）
# 阶段 3：生产运行时（仅包含运行所需文件）

# ---------- Stage 1: base + install ----------
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM install AS build
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY apps/api ./apps/api
RUN pnpm prisma generate
RUN pnpm build

# ---------- Stage 3: production runtime ----------
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app

# 仅复制运行所需文件
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./

# 生产启动：先执行数据库迁移（migrate deploy，禁止 migrate dev），再启动 API
CMD ["sh", "-c", "pnpm prisma migrate deploy && node apps/api/dist/main.js"]

EXPOSE 3000
