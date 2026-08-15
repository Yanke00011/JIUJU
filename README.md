# 酒局管家（JIUJU）

> 多用户酒局管理、酒水记录、条码识别与房间统计的 Web 应用。

酒局管家让朋友在聚餐时创建一个酒局房间、通过邀请码加入，并用手机扫描酒瓶商品条码来识别酒品、登记实际饮用者，最后自动生成瓶数、容量、成员与酒品排行。

**产品原则：简单、稳定、可扩展。**

第一版优先把下面这条核心链路做顺，并尽量控制在 10 秒内完成一次登记：

```text
创建酒局 → 朋友加入 → 扫描酒瓶条码 → 识别酒品 → 选择饮用者 → 确认登记 → 自动统计
```

## 当前进度（Phase 1 已完成）

当前阶段为 **Backend First · Phase 1：项目初始化**，已完成：

- `apps/api` NestJS 后端初始化（TypeScript strict、pnpm Monorepo）
- ESLint + Prettier
- Prisma（`prisma/schema.prisma` + `prisma.config.ts`）
- PostgreSQL Docker（`docker-compose.yml`，`docker compose up -d postgres`）
- 环境变量（`apps/api/.env.example`）
- Swagger（`/api/docs`，同时输出 `/api/docs-json` OpenAPI JSON）
- Health API（`GET /api/v1/health`）
- 全局 `ValidationPipe`、统一异常处理、统一响应包装、基础请求日志、Helmet、CORS
- 基础单元测试与 E2E 测试、构建脚本、README

尚未实现（属于后续 Phase）：用户、注册/登录、JWT、房间、成员、酒品、饮酒记录、统计、Admin、用户 Web、Admin Web、微信小程序。

## 核心功能

### V1 范围

- 用户注册、登录、JWT 身份认证与当前用户信息
- 酒局房间创建、邀请码加入、成员管理、退出与结束房间
- 6 位唯一邀请码（大写字母与数字，排除 `O/0/I/1`）
- 酒品库：品牌、名称、条码、容量、酒精度、类型与状态
- 通过 `EAN-13`、`EAN-8`、`UPC`、`Code128`、`QR` 等条码查询酒品；扫码由 Web 前端调用摄像头完成
- 为房间成员登记一瓶酒，并使用 `clientRequestId` 实现幂等，避免重复点击产生多条记录
- 房间统计：总瓶数、总容量、成员数、酒品数、成员排行、酒品排行与历史记录
- 管理后台 API：仪表盘、用户、房间、酒品、饮酒记录、操作日志
- Swagger/OpenAPI、自动化测试、Docker 化部署与基础安全措施

### 重要数据原则

**商品条码不等于一瓶酒的唯一编号。** 同一款酒的多瓶通常共享同一个商品条码：

```text
6901234567890 → XX 白酒 500ml
                 ├─ 第 1 瓶
                 ├─ 第 2 瓶
                 └─ 第 3 瓶
```

因此，`Product.barcode` 必须唯一，而 `DrinkRecord.barcode` 不能唯一。同一条码可在同一房间登记多次。若未来需要识别具体的一瓶酒，应另行增加 `bottleSerial`（防伪码、监管码、序列号等），不能把商品条码误当作独立瓶码。

## 技术架构

```text
用户 Web ─┐
          ├── NestJS API ── PostgreSQL
Admin Web ─┘        │
                      ├── Redis（预留，V1 可不启用）
                      └── Object Storage（预留，V1 不需要）
```

| 层级 | 技术选型 |
| --- | --- |
| API | Node.js、TypeScript、NestJS、Prisma |
| 数据库 | PostgreSQL |
| 认证与校验 | JWT、class-validator、class-transformer |
| API 文档 | Swagger / OpenAPI |
| 用户 Web（后续） | Vue 3、Vite、TypeScript、Pinia、Vue Router、Tailwind CSS |
| Admin Web（后续） | Vue 3、Vite、TypeScript、Pinia、Vue Router、Element Plus、ECharts |
| 部署 | Docker Compose |

开发采用 **Backend First**。严格顺序为：

```text
数据库 → API → 测试 → Swagger/OpenAPI → Admin API → 用户 Web → Admin Web
```

不得同时并行实现后端、用户端与后台界面；后端完成前不开发 Vue、Tailwind、Element Plus 或扫码 UI。

## 目录结构

目标为 pnpm Monorepo：

```text
jiuju/
├── apps/
│   ├── api/                 # NestJS API
│   ├── web/                 # 用户 Web（后续）
│   └── admin/               # 管理后台（后续）
├── packages/
│   └── shared/              # 共享类型、工具与 OpenAPI 产物
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/
├── docker/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── PROJECT_SPEC.md
├── AGENT_INSTRUCTIONS.md
└── README.md
```

## 环境要求

- Node.js：推荐使用当前维护中的 LTS 版本
- pnpm：推荐通过 Corepack 安装与管理
- PostgreSQL：开发与生产均必须使用
- Docker 与 Docker Compose：用于本地依赖和生产部署
- Git：按 Phase 提交变更

首次开始开发前，先检查 Node.js、pnpm、Docker 与 PostgreSQL 连接是否可用。

## 安装与启动

以下命令描述当前 Phase 1 的实际使用方式；具体脚本名称以项目的 `package.json` 为准。

```bash
git clone <repository-url> jiuju
cd jiuju
pnpm install
cp apps/api/.env.example apps/api/.env
```

说明：项目使用 `pnpm`（Monorepo）。Node 20 环境建议使用 pnpm 9（可通过 `npm install -g --prefix <dir> pnpm@9` 本地安装，或 `corepack enable` 后由项目内 `packageManager` 字段指定版本）。

启动 PostgreSQL：

```bash
docker compose up -d postgres
```

生成 Prisma Client：

```bash
pnpm prisma generate
```

启动 API 开发服务：

```bash
pnpm dev
```

> 说明：业务数据模型、Migration 与 Seed 将在 Phase 2（数据库）添加。当前 Phase 1 仅完成 Prisma 初始化与连接配置，尚未包含任何业务模型。

完成 Web 与 Admin 应用后，开发环境可按 workspace 脚本分别或同时启动。生产环境使用：

```bash
docker compose up -d
```

最终 Compose 应包含 `api`、`postgres`、`web` 与 `admin`；Redis 为可选预留服务。

## 环境变量

API 环境变量位于 `apps/api/`。创建 `.env` 时至少配置以下变量：

```dotenv
NODE_ENV=development
DATABASE_URL="postgresql://jiuju:changeme@localhost:5432/jiuju?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="7d"
CORS_ORIGINS="http://localhost:5173,http://localhost:5174"
API_PORT=3000

# Prisma seed 使用（Phase 2 启用）；不得将真实密码提交到 Git
SEED_ADMIN_PASSWORD="change-me-before-use"
```

Prisma CLI 通过根目录 `prisma.config.ts` 加载 `apps/api/.env`。

生产环境必须：

- 使用强随机的 `JWT_SECRET`，禁止复用开发值；
- 仅允许可信来源出现在 `CORS_ORIGINS`；
- 将密钥放在安全的部署环境或密钥管理服务中，不提交 `.env`；
- 使用独立的数据库账号、强密码和持久化卷。

## 数据库与 Prisma

核心模型包括：

| 模型 | 责任 |
| --- | --- |
| `User` | 用户名、密码哈希、昵称、头像、状态、全局角色、登录时间 |
| `Room` | 房间名称、唯一邀请码、房主、状态与结束时间 |
| `RoomMember` | 房间成员与房间内角色（`OWNER` / `MEMBER`） |
| `Product` | 唯一商品条码、品牌、名称、容量、酒精度、类型与状态 |
| `DrinkRecord` | 房间、酒品、实际饮用者、登记人、条码、容量、幂等键与软删除信息 |
| `OperationLog` | 管理员操作、目标、详情、IP、User-Agent 与时间 |

关键约束：

- `User.username` 唯一；密码最少 8 位，只保存安全哈希，不返回 `passwordHash`。
- `Room.inviteCode` 唯一；房间状态为 `ACTIVE` 或 `ENDED`。
- `RoomMember` 必须有联合唯一约束：`UNIQUE(roomId, userId)`。
- `Product.barcode` 唯一。
- `DrinkRecord` 使用联合唯一约束：`UNIQUE(roomId, clientRequestId)`；重复请求返回原记录。
- `DrinkRecord.userId` 是实际饮用者；`createdBy` 是登记人，二者必须区分。
- 删除饮酒记录使用软删除：`deletedAt`、`deletedBy`、`deleteReason`。默认查询与统计必须排除已删除记录。
- 数据库统一使用 UTC；API 使用 ISO 8601；前端按用户本地时区显示。

数据库变更必须使用 Prisma Migration：

```bash
pnpm prisma migrate dev --name <migration-name>
```

禁止把 `prisma db push` 作为生产部署方式。每次正式变更应有可追踪的迁移文件。`prisma/seed.ts` 应创建超级管理员、测试用户与测试酒品；管理员密码通过环境变量提供。

## API 与 Swagger

所有 API 以版本前缀开始：

```text
/api/v1
```

例如：`POST /api/v1/auth/login`。未来新增不兼容版本时使用 `/api/v2`，不得破坏 V1。

统一响应格式：

```json
{
  "success": true,
  "data": {}
}
```

列表响应：

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 0
  }
}
```

错误响应：

```json
{
  "success": false,
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "房间不存在"
  }
}
```

分页后台接口统一支持 `page`、`pageSize`、`sort` 与 `order`；默认 `page=1`、`pageSize=20`，最大 `pageSize=100`。

主要接口范围：

- `Auth`：注册、登录、当前用户。
- `Rooms` 与 `Members`：创建、加入、退出、成员、结束与房间权限。
- `Products`：如 `GET /api/v1/products/barcode/:barcode`；找不到时返回 `PRODUCT_NOT_FOUND`。
- `Drinks`：`POST /api/v1/rooms/:roomId/drinks`。创建前依次校验 JWT、登记人房间成员身份、房间为 `ACTIVE`、酒品存在、实际饮用者属于房间、幂等键，然后创建或返回原记录。
- `Stats`：房间汇总、成员排行、酒品排行与历史记录。
- `Admin`：全部位于 `/api/v1/admin/*`，与普通用户接口隔离。

Swagger 必须提供在：

```text
/api/docs
```

文档必须覆盖 Auth、Users、Rooms、Members、Products、Drinks、Stats、Admin，并清晰描述参数、请求体、响应、错误码与鉴权要求。同时导出 `openapi.json`，作为前端生成 TypeScript API Client 的单一契约来源。

## 权限与后台

全局用户角色：`USER`、`ADMIN`、`SUPER_ADMIN`。用户状态：`ACTIVE`、`DISABLED`。

房间内角色：`OWNER`、`MEMBER`。房间结束后仍可查看统计与历史，但不得新增饮酒记录、加入成员或修改核心记录。

管理端至少提供：

- Dashboard：用户数、活跃用户、房间数、进行中/已结束房间、酒品数、饮酒记录数、今日酒局/记录、近 7 日趋势；
- 用户：按用户名/昵称搜索、查看、禁用与恢复；绝不显示密码；
- 房间：按名称/邀请码搜索，查看房主、成员、酒品、记录、统计并结束房间；
- 酒品：按条码/品牌/名称搜索、新增、编辑、停用；
- 饮酒记录：筛选房间、用户、酒品、日期，查看与软删除；删除必须填写 `deleteReason` 并记录 `OperationLog`；
- 操作日志：可追踪管理员、动作、目标、详情、IP、User-Agent 与时间。

`SUPER_ADMIN` 拥有全部权限；`ADMIN` 可管理用户、房间、酒品、饮酒记录与统计。后续若需要再增加更细的 `OPERATOR` 角色。

## 测试与质量检查

每个 Phase 完成后都必须运行测试、TypeScript 检查、Lint、Prisma 校验与 Docker 验证，并修复所有错误后再提交。

建议的检查命令：

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm typecheck
pnpm prisma validate
docker compose config
```

`pnpm prisma validate` 通过根目录 `prisma.config.ts` 加载 `apps/api/.env` 中的 `DATABASE_URL`。

最低测试覆盖：

- Auth：注册、重复注册、登录、错误密码、JWT、禁用用户。
- Room：创建、加入、重复加入、错误邀请码、退出、结束、结束后不可登记。
- Product：按条码查询、创建、重复条码。
- DrinkRecord：正常登记、非法房间、非成员、实际饮用者非成员、重复请求幂等、软删除与权限。
- Stats：瓶数、容量、成员排行、酒品统计，且已删除记录不得计入。
- Admin：权限隔离、列表分页、搜索、记录删除与操作日志。

## Docker、部署与备份

开发时可仅启动 PostgreSQL：

```bash
docker compose up -d postgres
```

生产部署需包含：

- API、Web、Admin 与 PostgreSQL 容器；
- PostgreSQL 持久化数据卷；
- 环境变量注入，绝不把密钥写入镜像或 Git；
- HTTPS 与反向代理；
- 数据库备份脚本，使用 `pg_dump`，目标为每日备份并保留至少 7 天。

第一版至少提供可执行备份脚本，不要求接入自动化平台。

## 安全

必须实施：

- Helmet 安全响应头；
- 严格 CORS；
- DTO 输入校验与转换；
- JWT Guard 与 Role Guard；
- 登录、注册、加入房间、创建房间、创建饮酒记录的限流；
- 安全密码哈希：优先 Argon2；若使用 bcrypt，成本参数必须不低于 12；
- 禁止 MD5、SHA-1 与明文密码；
- 生产日志中不得泄露密码、JWT、连接串或其他密钥。

## 开发 Phase

严格按顺序推进；每个 Phase 完成后须检查、测试、更新 README 并提交一个小而清晰的 Git commit。未经确认，不进入下一阶段。

| Phase | 内容 |
| --- | --- |
| 1 | 初始化 Monorepo、NestJS、Prisma、PostgreSQL、Docker、Health API、测试与 Swagger；验证基础服务可启动和连接。 |
| 2 | 用户系统：注册、登录、JWT、当前用户。 |
| 3 | 房间：创建、加入、退出、成员、邀请码、权限。 |
| 4 | 酒品：Product、条码、创建与查询。 |
| 5 | 扫码：手机摄像头、EAN-13、EAN-8、UPC、Code128、QR 与手动输入。 |
| 6 | 饮酒记录：确认酒品、选择饮用者、登记与幂等防重。 |
| 7 | 统计：瓶数、毫升、成员排行、酒品统计、历史记录。 |
| 8 | 用户 UI：移动端优先、响应式、扫码体验、Loading、错误提示、空状态。 |
| 9 | 安全：限流、CORS、权限、输入验证、日志。 |
| 10 | 生产部署：Docker、HTTPS、环境变量、数据库持久化、备份。 |
| 11–16 | 仅在前序能力稳定并获得确认后，继续完成 Admin Web、体验优化、集成测试、部署完善与后续规划中的扩展。 |

提交信息示例：

```text
feat: initialize monorepo
feat: add authentication
feat: add room management
feat: add product management
feat: add drink records
feat: add room statistics
chore: add docker deployment
```

不要将大量不相关功能压进同一次提交。

## AI Agent 使用说明

开始前，AI Agent 必须先读取项目根目录的：

```text
PROJECT_SPEC.md
AGENT_INSTRUCTIONS.md
README.md
```

Agent 的第一步不是直接编写业务功能，而是：

1. 分析当前项目状态与目录；
2. 检查 Node.js、pnpm、Docker 与数据库环境；
3. 对照规格确认数据模型和实施范围；
4. 输出当前 Phase 的实施计划；
5. 只执行获授权的一个 Phase。

每个 Phase 的完成条件：

```text
实现范围完成 → 完整测试 → 修复错误 → TypeScript/Lint/Prisma/Docker 检查
→ 更新 README → Git commit → 等待确认
```

可直接对 Agent 使用以下指令：

> 阅读 `PROJECT_SPEC.md`、`AGENT_INSTRUCTIONS.md` 和 `README.md`。你是酒局管家项目的主程 Agent。不要一次性实现全部功能，严格按 Phase 顺序开发。现在只执行 Phase 1：检查当前环境和项目目录，先输出实施计划，再初始化项目。完成测试、Swagger、Docker、Health API 后提交 Git commit。未经确认，不要进入 Phase 2。

## 最终验收流程

项目完成时，必须能在真实环境稳定完成以下端到端流程：

```text
用户 A 注册
  ↓
创建“老张生日局”，获得邀请码 A7K92P
  ↓
用户 B 注册并使用邀请码加入
  ↓
用户 A 用手机打开扫码页面，扫描一瓶 EAN-13 酒品
  ↓
系统识别 Product，选择“张三”并确认登记
  ↓
创建 DrinkRecord，房间统计立即更新
  ↓
用户 B 刷新页面后，可看到张三已登记 1 瓶
```

验收统计示例：

```text
总计：12 瓶 / 6000 ml

张三  4 瓶
李四  3 瓶
王五  2 瓶
赵六  1 瓶
```

同时验证：重复提交不会多记一瓶、结束房间后不能登记、已删除记录不进入统计、非成员无法登记、管理员操作有日志、Swagger 可用、Docker 可启动、数据库迁移与备份脚本可执行。

## Roadmap

以下能力不属于 V1，未经明确确认不得自行加入：

- 微信登录与微信小程序
- WebSocket 实时同步
- 多人分摊一瓶酒
- 酒水价格、AA 与账单
- 历史酒局与长期排行榜
- 完善酒品数据库与外部数据源
- 独立瓶码（防伪码/监管码/序列号）
- PWA 离线能力
- 更丰富的后台、运营功能

V1 明确不做：支付、朋友圈/社交、聊天、好友系统、直播、AI 功能、健康分析、商城、广告等。先确保“登录 → 建房 → 加入 → 扫码 → 登记 → 统计”的闭环稳定、可用、可维护。

---

项目代号：`jiuju`  
文档状态：V1 基线  
开发策略：Backend First
