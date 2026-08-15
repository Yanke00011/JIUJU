<div align="center">

# 酒局管家 · JIUJU

朋友聚会的公平饮酒记录工具 —— 扫码记录每一杯，让聚会更公平。

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-e0234e?logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169e1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ed?logo=docker&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-9-f69220?logo=pnpm&logoColor=white)

</div>

**JIUJU（酒局管家）** 是一款面向朋友聚会的饮酒记录 Web 应用。在饭局上创建一个酒局房间，朋友通过邀请码加入，用手机摄像头扫描酒瓶条形码即可识别酒品、登记饮用者，并自动生成瓶数、容量、酒精量与成员/酒品排行 —— 谁喝了多少，一目了然，谁也赖不掉。

> 产品原则：**简单、稳定、可扩展**。一次登记的目标控制在 10 秒内完成。

```text
创建酒局 → 朋友加入 → 扫码识别酒品 → 确认饮用者与数量 → 自动统计排行
```

---

## 功能特性

**用户端**

- 注册 / 登录 / JWT 认证（Argon2 密码哈希）
- 创建酒局、6 位邀请码加入、成员管理、结束酒局
- **扫码登记**：手机摄像头识别 EAN-13 / EAN-8 / UPC / Code128 / QR 条码，自动匹配酒品
- **选择已有酒品**：按名称 / 品牌 / 条码搜索已录入酒品，直接登记
- 数量支持小数（如半瓶 0.5），登记保存商品快照，历史数据不受商品修改影响
- 实时统计排行：总瓶数 / 总容量 / 总酒精量、用户排行（按酒精量）、酒品排行
- 我的酒局：`进行中 / 历史` 双 Tab + 分页加载，支持上百个酒局

**管理后台**（ADMIN / SUPER_ADMIN）

- 运营仪表盘：用户 / 酒局 / 饮酒记录 / 商品等实时数据与趋势图
- 用户、房间、商品、饮酒记录、操作日志管理
- 商品**扫码录入**：扫条码自动检测是否已存在，不存在则自动填入新增表单
- CSV 导出、批量删除、操作审计日志（谁在何时对什么做了什么）

**工程化**

- NestJS + Prisma + PostgreSQL，TypeScript 严格模式，pnpm Monorepo
- Swagger/OpenAPI 文档、单元测试 + E2E 测试
- Docker 多阶段构建 + docker-compose 生产部署（自动迁移）
- PWA：支持添加到手机桌面
- 移动端优先的响应式 UI，统一 JIUJU Design System

---

## 界面预览

> TODO：上线后补充截图。

| 落地页 | 扫码登记 | 酒局详情 | 管理后台 |
| --- | --- | --- | --- |
| （占位） | （占位） | （占位） | （占位） |

---

## 使用教程

以一次真实的「老张生日局」为例，演示完整使用流程。

### 1. 注册与登录

打开部署地址，进入登录页：

- 首次使用点击 **注册**，填写昵称、用户名与密码（至少 8 位且包含字母和数字）；
- 注册成功后切回 **登录** 页登录；
- 登录后进入「我的酒局」。

> 已有种子账号（开发环境）：`admin`（超级管理员）与 `testuser`，密码见下方「快速开始」。

### 2. 创建酒局

在「我的酒局」页点击 **创建**：

1. 输入酒局名称（例如「老张生日局」）；
2. 创建后自动成为 **房主**，并获得一个 **6 位邀请码**（如 `A7K92P`）；
3. 把邀请码复制给朋友。

### 3. 邀请朋友加入

- 朋友注册/登录后，在「我的酒局」点击 **加入**；
- 输入 6 位邀请码即可入局；
- 加入后可在酒局详情页看到成员列表与实时排行。

### 4. 扫码登记饮酒

在酒局详情页点击底部 **登记饮酒**：

1. 页面自动打开后置摄像头；
2. 对准酒瓶条形码，系统识别后自动查询商品；
3. 确认为对应酒品后，填写数量（支持小数，如 0.5 瓶）；
4. 点击 **确认登记**，统计立即更新。

> 扫码无法使用时（无摄像头 / HTTPS 限制）：可在登记页 **手动输入条码** 查询，或切换到 **选择已有酒品** 按名称 / 品牌 / 条码搜索登记。

### 5. 查看排行

酒局详情页每 15 秒自动刷新：

- **用户排行**：按酒精摄入量降序，第一名有金色标识，自己的排名高亮；
- **酒品排行**：按饮用数量降序；
- 顶部汇总：记录数 / 总瓶数 / 总容量。

### 6. 结束酒局

房主在酒局详情页点击 **结束酒局**：

- 结束后房间进入「历史」，禁止继续登记与加入；
- 历史统计与记录仍可查看（我的酒局 → 历史 Tab）。

### 7. 管理后台（仅管理员）

以 `ADMIN` / `SUPER_ADMIN` 角色登录后，点击右上角 **管理后台**：

- **仪表盘**：查看用户、酒局、饮酒记录、商品等实时统计与趋势；
- **商品管理**：新增 / 编辑 / 搜索商品，支持 **扫码录入**（扫条码自动判断是否已存在，不存在则自动填入条码）；
- **用户管理**：禁用 / 恢复用户；
- **房间管理**：查看详情、统计摘要、CSV 导出、结束房间；
- **饮酒记录**：多条件筛选、恢复软删除记录；
- **操作日志**：审计管理员操作（表格 / 时间线两种视图）。

---

## 快速开始（开发环境）

### 环境要求

- Node.js ≥ 20（LTS）
- pnpm 9（推荐用 Corepack：`corepack enable`）
- Docker 与 Docker Compose（本地 PostgreSQL）
- Git

```bash
node --version   # >= 20
pnpm --version   # 9.x
docker --version
```

### 后端启动

```bash
# 1. 克隆并安装依赖
git clone https://github.com/Yanke00011/JIUJU.git jiuju
cd jiuju
pnpm install

# 2. 配置环境变量（必须把 SEED_ADMIN_PASSWORD 从占位值改成真实密码，否则 seed 会失败）
cp apps/api/.env.example apps/api/.env
#    编辑 apps/api/.env，将 SEED_ADMIN_PASSWORD 改为你的密码，如：SEED_ADMIN_PASSWORD="my-admin-password"

# 3. 启动 PostgreSQL
docker compose up -d postgres

# 4. 数据库迁移与种子数据
pnpm prisma generate
pnpm prisma migrate deploy
pnpm prisma db seed

# 5. 启动 API（http://localhost:3000）
pnpm dev
```

> 开发新增字段用 `pnpm prisma migrate dev --name <名称>`；生产环境只允许 `migrate deploy`。

### 前端启动

```bash
cd apps/web
cp .env.example .env   # VITE_API_BASE_URL 默认 /api
pnpm dev               # http://localhost:5173
```

开发环境 Vite 会把 `/api` 代理到后端 `:3000`（自动拼接 `/api/v1` 前缀），无需关心 CORS。

### 手机局域网测试

```bash
cd apps/web
pnpm dev --host        # 监听 0.0.0.0
```

手机与电脑同一局域网，手机浏览器访问 `http://<电脑IP>:5173`。

> 摄像头（`getUserMedia`）仅在 **HTTPS 或 localhost** 下可用；局域网 IP 调试时浏览器可能拒绝摄像头，可改用「选择已有酒品」或手动输入条码走通流程。

### 种子账号（开发环境）

| 账号 | 角色 | 密码 |
| --- | --- | --- |
| `admin` | SUPER_ADMIN | 见 `apps/api/.env` 的 `SEED_ADMIN_PASSWORD` |
| `testuser` | USER | `testuser-dev-password-2026` |

---

## 项目结构

```text
jiuju/
├── apps/
│   ├── api/                  # NestJS 后端
│   └── web/                  # 用户端 + 管理后台（React）
├── prisma/
│   ├── schema.prisma         # 数据模型
│   ├── migrations/           # 数据库迁移
│   └── seed.ts               # 种子数据
├── scripts/
│   └── cleanup-test-data.ts  # 测试数据清理脚本
├── docs/
│   ├── DEVELOPMENT_LOG.md    # 开发日志（按 Phase）
│   └── UI_DESIGN_SYSTEM.md   # JIUJU UI 设计规范
├── Dockerfile
├── docker-compose.yml        # 开发（PostgreSQL）
├── docker-compose.prod.yml   # 生产（API + PostgreSQL）
└── package.json              # pnpm workspace 根
```

---

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 后端 | Node.js 20 · NestJS 10 · TypeScript 5 · Prisma 6 |
| 数据库 | PostgreSQL 16 |
| 认证 | JWT · Argon2id（`@node-rs/argon2`） |
| API 文档 | Swagger / OpenAPI |
| 前端 | React 18 · Vite 5 · Ant Design 5 · html5-qrcode · TanStack Query · Zustand · Axios |
| 部署 | Docker · Docker Compose |

数据模型：`User` / `Room` / `RoomMember` / `Product` / `DrinkRecord` / `OperationLog`。详见 `prisma/schema.prisma`。

---

## 环境变量

### API（`apps/api/.env`）

| 变量 | 说明 |
| --- | --- |
| `NODE_ENV` | `development` / `production` |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `JWT_SECRET` | JWT 签名密钥，生产必须为强随机值 |
| `JWT_EXPIRES_IN` | 有效期，如 `7d` |
| `CORS_ORIGINS` | 允许的跨域来源，逗号分隔（生产禁止 `*`） |
| `API_PORT` | API 端口（默认 3000） |
| `SWAGGER_ENABLED` | 是否启用 Swagger（生产默认关闭） |
| `SEED_ADMIN_PASSWORD` | 种子管理员 `admin` 的密码（仅 Seed 使用） |

### Web（`apps/web/.env`）

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE_URL` | API 基础地址，开发默认 `/api`（走 Vite 代理），生产指向真实 API |

生产环境使用 `.env.production.example`（复制为 `.env.production`），`docker-compose.prod.yml` 自动读取。

---

## 常用脚本

在仓库根目录执行：

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 API（watch 模式） |
| `pnpm build` | 构建 API |
| `pnpm typecheck` | API 类型检查 |
| `pnpm lint` | ESLint |
| `pnpm test` | 单元测试 |
| `pnpm test:e2e` | E2E 测试 |
| `pnpm prisma migrate dev` | 开发环境生成并应用迁移 |
| `pnpm prisma migrate deploy` | 生产环境应用迁移 |
| `pnpm prisma db seed` | 写入种子数据 |
| `pnpm cleanup:test-data` | 清理测试数据（`test_` / `e2e_` 前缀） |
| `pnpm --filter @jiuju/web dev` | 启动前端（Vite） |
| `pnpm --filter @jiuju/web build` | 构建前端 |

---

## API 文档

- 所有接口以 `/api/v1` 为前缀，统一响应格式：

```json
{ "success": true, "data": {} }
```

- 错误响应：

```json
{ "success": false, "error": { "code": "ROOM_NOT_FOUND", "message": "房间不存在" } }
```

- 开发环境 Swagger：`http://localhost:3000/api/docs`（生产默认关闭）

主要接口分组：

| 模块 | 说明 |
| --- | --- |
| `Auth` | 注册 / 登录 / 当前用户（登录 10 次/分、注册 20 次/分限流） |
| `Users` | 用户资料查询与修改 |
| `Rooms` | 创建 / 列表 / 详情 / 结束酒局 |
| `Room Members` | 邀请码加入 / 成员列表 / 退出 / 移除 |
| `Products` | 条码查询 / 搜索 / 创建 / 修改 |
| `Drink Records` | 登记 / 列表 / 详情 / 修改 / 软删除（含商品快照） |
| `Statistics` | 酒局实时统计与排行 |
| `Admin` | 用户 / 房间 / 商品 / 饮酒记录 / 操作日志（仅管理员） |

> 完整接口清单与参数、错误码见 Swagger 文档。

---

## 测试

```bash
pnpm test          # 单元测试（145+ 用例）
pnpm test:e2e      # E2E 测试（120+ 用例）
pnpm typecheck     # TypeScript 检查
pnpm lint          # ESLint
pnpm prisma validate
```

每个 Phase 完成需全绿后再提交，详情见 `docs/DEVELOPMENT_LOG.md`。

---

## 部署

生产使用 **Docker Compose 单机部署**，包含三个服务：`web`（nginx 托管 React 静态站 + `/api` 反向代理 + SPA fallback）、`api`（NestJS production）、`postgres`（PostgreSQL 持久化）。HTTPS / 域名由外部反向代理（Lucky / Nginx / Caddy）负责，不在本 compose 内终止。

> 完整部署教程见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)；上线检查清单见 [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)。

### 开发

```bash
docker compose up -d postgres
```

### 首次生产部署

```bash
cp .env.production.example .env.production   # 填写真实值（JWT_SECRET / CORS_ORIGINS / 数据库密码）
docker compose -f docker-compose.prod.yml up -d --build
```

生产要点：

- `web`：React 构建产物由 nginx 托管，前端使用相对路径 `VITE_API_BASE_URL=/api`（禁止写死 `localhost:3000`），`/api` 由 nginx 反代到 `api:3000`；
- API 容器启动时自动执行 `prisma migrate deploy`（禁止 `migrate dev` / `db push`）；
- `JWT_SECRET` 为空、`CORS_ORIGINS` 为空或含 `*` 时拒绝启动；
- 生产默认关闭 Swagger；PostgreSQL 使用持久化数据卷；
- 外部代理规则：`/` → `web:80`，`/api` → `web:80`（web 内部再转 api）。

### 更新部署

```bash
# 0. 更新前备份数据库
./scripts/backup.sh /data/backups

# 1. 拉取最新代码
git pull

# 2. 重新构建并启动
docker compose -f docker-compose.prod.yml up -d --build

# 3. 数据库迁移（api 启动时自动执行；如需手动）
docker compose -f docker-compose.prod.yml exec api sh -c 'pnpm prisma migrate deploy'
```

### 数据库备份

```bash
./scripts/backup.sh /data/backups        # 一键备份（pg_dump + gzip，保留 7 天）
# 恢复（详见 docs/BACKUP.md）
gunzip -c /data/backups/backup_<时间戳>.sql.gz | docker exec -i jiuju-prod-postgres psql -U jiuju -d jiuju
```

建议每日备份并保留至少 7 天，详见 [docs/BACKUP.md](docs/BACKUP.md)。

---

## 项目文档

- [开发日志（按 Phase）](docs/DEVELOPMENT_LOG.md)
- [JIUJU UI 设计规范](docs/UI_DESIGN_SYSTEM.md)
- [生产部署指南](docs/DEPLOYMENT.md)
- [数据库备份与恢复](docs/BACKUP.md)
- [上线检查清单](docs/RELEASE_CHECKLIST.md)
- [项目规格书](PROJECT_SPEC.md)
- [AI Agent 开发说明](AGENT_INSTRUCTIONS.md)

---

## Roadmap

当前为 **JIUJU V1.0 Release Candidate**，上线前将完成：代码审查、UI 统一、体验与性能优化、安全检查、Docker 生产部署、HTTPS 与域名、数据库备份、上线检查清单。

V1 范围之外（规划中）：

- 微信小程序 / 微信登录
- WebSocket 实时同步
- 酒水价格与 AA 分摊
- 独立瓶码（防伪码 / 监管码 / 序列号）
- 完善酒品数据库与外部数据源

V1 明确不做：支付、社交/好友系统、聊天、直播、AI 功能、商城、广告。

---

## 贡献

欢迎提交 Issue 与 Pull Request。参与开发前请阅读：

1. [项目规格书](PROJECT_SPEC.md)
2. [AI Agent 开发说明](AGENT_INSTRUCTIONS.md)
3. [开发日志](docs/DEVELOPMENT_LOG.md)

请严格按 Phase 顺序推进，每个 Phase 完成需测试全绿并更新开发日志。

---

## License

本项目目前未开源，保留所有权利（All rights reserved）。
