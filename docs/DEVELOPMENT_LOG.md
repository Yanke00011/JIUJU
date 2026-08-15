# 酒局管家（JIUJU）开发日志

本文档记录项目的开发历史、阶段完成情况、重要技术决策与 API/数据库变化。

> 规则：每完成一个 Phase，必须在此文档追加记录（新增功能、数据库变化、API 变化、Git commit、测试结果）。

---

## Phase 15.1 — Admin Dashboard 增强（进行中）

- **状态**：进行中
- **新增功能**：
  - 用户管理增强：关键词搜索（username/nickname）、详情（参与房间数/饮酒记录数）、删除用户（SUPER_ADMIN）
  - 商品管理增强：新增商品、关键词搜索（barcode/name/brand）、删除商品（SUPER_ADMIN，引用保护）
  - 房间管理增强：关键词搜索（名称/邀请码/房主）、详情（成员/饮酒记录/统计）、结束房间、CSV 导出
  - 新增饮酒记录管理：分页、按房间/用户/商品/时间过滤、查看完整快照与删除状态、恢复软删除记录
  - Dashboard 增强：6 张统计卡片 + 最近酒局 + 最近操作日志
  - AdminLayout 重构：单一导航（桌面 Sider / 移动端唯一 Drawer）
- **数据库变化**：`User` 新增 `deletedAt`（软删除字段）
- **API 变化**：
  - `DELETE /api/v1/admin/users/:id`（SUPER_ADMIN，物理/软删除）
  - `POST /api/v1/admin/products`、`DELETE /api/v1/admin/products/:id`（PRODUCT_IN_USE 保护）
  - `POST /api/v1/admin/rooms/:id/end`、`GET /api/v1/admin/rooms/:id/members`、`GET /api/v1/admin/rooms/:id/drinks`、`GET /api/v1/admin/rooms/:id/export`（CSV）
  - `GET /api/v1/admin/drinks`、`POST /api/v1/admin/drinks/:id/restore`
  - `GET /api/v1/admin/dashboard`
  - 搜索参数：`GET /admin/users|rooms|products?keyword=`
- **权限**：ADMIN 可管理用户/房间/商品/日志；SUPER_ADMIN 额外可删除用户与商品；普通 USER 禁止访问
- **Git commit**：`feat: enhance admin dashboard`（待提交）
- **测试结果**：待完成（后端 140 unit / 116 e2e 全绿，前端 build 通过）

---

## Phase 15 — Web 产品化优化 + PWA + Admin 管理后台

- **状态**：已完成
- **新增功能**：
  - 首页改造：未登录展示产品介绍，已登录展示我的酒局
  - UI 全面优化（Ant Design，移动端优先，loading/empty/error/成功反馈）
  - 登录/注册体验优化（友好错误提示、注册后自动切登录）
  - PWA：manifest、Service Worker、图标，支持添加到桌面
  - Admin 管理后台：Dashboard / 用户 / 房间 / 商品 / 操作日志
- **数据库变化**：无
- **API 变化**：无（复用既有 Admin API）
- **Git commit**：`ca9af91 feat: improve web ux and add admin dashboard`
- **测试结果**：web build ✅；后端 117 unit / 101 e2e ✅
- **重要设计说明**：密码找回未实现（后端无对应接口），README 已记录预留设计。

---

## Phase 14 — Web 扫码饮酒记录 + 开发文档完善

- **状态**：已完成
- **新增功能**：
  - 扫码登记页 `/rooms/:id/drink`（html5-qrcode 摄像头扫描 → 商品查询 → 数量确认 → 创建记录）
  - 酒局详情实时排行榜（统计接口 + 15s 自动刷新）
  - README 完整开发教程
- **数据库变化**：无
- **API 变化**：无（复用既有 API）
- **Git commit**：`80018f0 feat: add web drink scanning and update docs`
- **测试结果**：web build ✅；后端 117 unit / 101 e2e ✅

---

## Phase 13 — Web 前端基础

- **状态**：已完成
- **新增功能**：`apps/web` React 18 + Vite + Ant Design；登录/注册、我的酒局、创建/加入酒局、酒局详情；Zustand 状态管理、PrivateRoute、request.ts 网络层
- **数据库变化**：无
- **API 变化**：无
- **Git commit**：`7d8810e feat: init web frontend`（后续 `fa1a65c 修复注册问题`）
- **测试结果**：web build ✅

---

## Phase 12 — 生产部署准备（Docker）

- **状态**：已完成
- **新增功能**：多阶段 Dockerfile、`docker-compose.prod.yml`、`.env.production.example`、Health 数据库状态、生产安全启动检查（JWT_SECRET 非空 / CORS 严格 / Swagger 默认关闭）、请求日志 requestId
- **数据库变化**：无
- **Git commit**：`ace0708 feat: prepare production deployment`
- **测试结果**：117 unit / 101 e2e ✅；docker build + 生产栈实测通过

---

## Phase 11 — 操作日志查询

- **状态**：已完成
- **新增功能**：`GET /admin/logs`（分页 + 过滤）、`GET /admin/logs/:id`
- **数据库变化**：无
- **Git commit**：`306c45d feat: add operation log query`
- **测试结果**：116 unit / 101 e2e ✅

---

## Phase 10 — Admin API

- **状态**：已完成
- **新增功能**：AdminGuard、用户/房间/商品管理接口、OperationLog 写入
- **数据库变化**：无
- **Git commit**：`aca982c feat: add admin api`
- **测试结果**：109 unit / 94 e2e ✅

---

## Phase 9 — 酒局统计

- **状态**：已完成
- **新增功能**：`GET /rooms/:id/statistics`（总量 / 用户排行 / 商品排行，实时聚合）
- **数据库变化**：无
- **Git commit**：`b538267 feat: add room statistics`
- **测试结果**：95 unit / 83 e2e ✅
- **重要设计说明**：使用 PostgreSQL 原生聚合（`$queryRaw`），Decimal 转 number 返回。

---

## Phase 8 — 饮酒记录

- **状态**：已完成
- **新增功能**：DrinkRecord 创建/列表/详情/修改/软删除；商品快照保存；quantity 支持小数
- **数据库变化**：`quantity Int → Decimal(6,2)`；`volumeMl → volumeMlSnapshot`；新增 `alcoholPercentSnapshot`
- **Git commit**：`216778f feat: add drink record management`
- **测试结果**：87 unit / 78 e2e ✅

---

## Phase 7 — 商品与条形码

- **状态**：已完成
- **新增功能**：Product 创建/查询/修改、barcode 查询（8-14 位数字）
- **数据库变化**：无
- **Git commit**：`ed1ea26 feat: add product and barcode api`
- **测试结果**：70 unit / 64 e2e ✅

---

## Phase 6 — 房间成员

- **状态**：已完成
- **新增功能**：加入/退出/移除成员、成员列表、我的成员信息
- **数据库变化**：无
- **Git commit**：`95d9b13 feat: add room member management`
- **测试结果**：57 unit / 50 e2e ✅

---

## Phase 5 — 酒局管理

- **状态**：已完成
- **新增功能**：房间创建（事务 + 邀请码）/列表/详情/结束
- **数据库变化**：无
- **Git commit**：`e7b698c feat: add room management`
- **测试结果**：39 unit / 33 e2e ✅

---

## Phase 4 — 用户中心

- **状态**：已完成
- **新增功能**：`GET/PATCH /users/me`
- **数据库变化**：无
- **Git commit**：`bb1dff6 feat: add user profile api`
- **测试结果**：26 unit / 24 e2e ✅

---

## Phase 3 — 用户认证

- **状态**：已完成
- **新增功能**：注册/登录/当前用户、JWT（payload 仅 sub+role）、JwtAuthGuard、Argon2id、限流
- **数据库变化**：无
- **Git commit**：`6928bca feat: add authentication`
- **测试结果**：19 unit / 15 e2e ✅

---

## Phase 2 — 数据库设计

- **状态**：已完成
- **新增功能**：Prisma Schema（User/Room/RoomMember/Product/DrinkRecord/OperationLog）、初始迁移、Seed
- **数据库变化**：初始迁移 `20260815041020_init`
- **Git commit**：`deebbc4 feat: add database schema`
- **测试结果**：Prisma validate ✅

---

## Phase 1 — 后端初始化

- **状态**：已完成
- **新增功能**：NestJS（apps/api）、ESLint/Prettier、Docker Compose（PostgreSQL）、Health API、Swagger、全局管道/异常/响应包装
- **数据库变化**：无
- **Git commit**：`cf30362 feat: initialize backend`
- **测试结果**：4 unit / 4 e2e ✅
