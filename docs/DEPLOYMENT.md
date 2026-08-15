# JIUJU 生产部署指南（Docker Compose 单机部署）

本文档覆盖从服务器准备到首次部署、更新、回滚的完整流程。**HTTPS 终止由外部反向代理（Lucky / Nginx / Caddy）负责**，本 compose 只负责 `web / api / postgres`。

## 部署拓扑

```text
外部反向代理（Lucky / Nginx / Caddy）
  ├─ 域名解析 + SSL 证书 + HTTPS 终止
  ├─ /     → http://web:80        （React 静态站点）
  └─ /api  → http://web:80        （nginx 再把 /api 反代到 api:3000）

Docker Compose：
  web      → nginx 托管 dist + SPA fallback + /api 反代到 api
  api      → NestJS production（启动时 prisma migrate deploy）
  postgres → PostgreSQL 16（持久化卷）
```

## 一、服务器准备

- 系统：Ubuntu 22.04 LTS（或相近 Linux），2 核 / 2GB 以上内存（推荐 2C4G）
- 安装 Docker 与 Docker Compose v2：

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
docker compose version   # 应 >= 2.20
```

- 域名已解析到服务器公网 IP。

## 二、拉取代码与首次配置

```bash
git clone https://github.com/Yanke00011/JIUJU.git jiuju
cd jiuju
cp .env.production.example .env.production
```

编辑 `.env.production`，**必须修改**：

| 变量 | 说明 |
| --- | --- |
| `JWT_SECRET` | 强随机值（至少 32 字符），禁止复用开发值 |
| `POSTGRES_PASSWORD` | 数据库强密码（首次初始化生效） |
| `DATABASE_URL` | 与 `POSTGRES_PASSWORD` 一致（`postgres:5432`） |
| `CORS_ORIGINS` | 你的前端域名，如 `https://app.example.com`（禁止 `*`） |
| `SWAGGER_ENABLED` | 生产保持 `false` |

## 三、首次部署

```bash
# 备份：全新部署可跳过
docker compose -f docker-compose.prod.yml up -d --build
```

等待 postgres healthy 后 api 自动执行 `prisma migrate deploy`。验证：

```bash
curl http://localhost/api/v1/health          # {"success":true,...,"database":"up"}
curl http://localhost/                       # 返回 React 首页
```

> 若 web 绑定 80 端口被占用，可用 `WEB_PORT=8080` 覆盖；生产建议保持 80 由反向代理转发。

## 四、外部 HTTPS 反向代理配置

### 方案 A：Caddy（自动 HTTPS，推荐）

`Caddyfile`：

```caddyfile
app.example.com {
    reverse_proxy localhost:80
}
```

### 方案 B：Nginx

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;
    ssl_certificate     /path/fullchain.pem;
    ssl_certificate_key /path/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 方案 C：Lucky（国产品，面板配置）

新建 Web 服务：监听 `https`、绑定域名、目标地址 `http://127.0.0.1:80`，启用证书自动申请。

## 五、更新部署

```bash
# 0. 更新前备份数据库
./scripts/backup.sh /data/backups

# 1. 拉取最新代码
git pull

# 2. 重新构建镜像并启动
docker compose -f docker-compose.prod.yml up -d --build

# 3. 数据库迁移（api 启动时会自动 migrate deploy；如需手动执行）
docker compose -f docker-compose.prod.yml exec api sh -c 'pnpm prisma migrate deploy'

# 4. 验证
curl http://localhost/api/v1/health
```

## 六、回滚

```bash
# 1. 回滚到上一版本镜像（若用版本 tag）
docker compose -f docker-compose.prod.yml up -d --no-build   # 使用上次构建的镜像

# 或重新构建指定 commit：
git checkout <上一版本commit>
docker compose -f docker-compose.prod.yml up -d --build

# 2. 数据库回滚（仅当迁移破坏数据时，恢复备份）
./scripts/restore 见 docs/BACKUP.md
```

> 原则：**先备份再更新**；迁移向前兼容（只新增枚举值/可空字段），通常无需回滚数据库。

## 七、日常运维

- 日志：`docker compose -f docker-compose.prod.yml logs -f api`
- 状态：`docker compose -f docker-compose.prod.yml ps`
- 重启：`docker compose -f docker-compose.prod.yml restart`
- 备份：`./scripts/backup.sh /data/backups`（建议 cron 每日执行）

> 注意：`docker-compose.yml`（开发）与 `docker-compose.prod.yml`（生产）位于同一目录时默认使用**相同项目名**（目录名），`docker compose down` 会同时影响两者。生产服务器上不应同时存在两套 compose；本地联调时请用 `-p jiuju-prod` 隔离，例如：
> `docker compose -f docker-compose.prod.yml -p jiuju-prod up -d --build`

## 八、常见问题

| 现象 | 处理 |
| --- | --- |
| `502 Bad Gateway`（/api 经 web） | 检查 `docker logs jiuju-api`，确认 api 正常且 postgres healthy |
| `P1000` 认证失败 | `POSTGRES_PASSWORD` 与 `DATABASE_URL` 不一致；修改后 `down -v` 重建（会清空数据，先备份） |
| 登录后刷新 404 | 反代未配置 SPA fallback；确认外部代理 `location / { try_files $uri $uri/ /index.html; }` 或 Caddy 直接反代 `localhost:80` |
| CORS 报错 | `.env.production` 的 `CORS_ORIGINS` 未包含前端域名 |
