# 酒局管家 JIUJU 用户 Web 多阶段构建
# 阶段 1-2：Node 构建（Vite 产物到 dist）
# 阶段 3：nginx 静态托管 + /api 反向代理 + SPA fallback

# ---------- Stage 1: base + install ----------
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM install AS build
# 生产使用相对路径 /api（由 nginx 反向代理到 api）；禁止写死 localhost:3000
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY apps/web ./apps/web
RUN pnpm --filter @jiuju/web build

# ---------- Stage 3: nginx runtime ----------
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
