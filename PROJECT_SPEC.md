# 酒局管家（JIUJU）项目开发规格书
## Project Specification + Agent Development Instructions
版本：V1.0
开发模式：Backend First

---

# 1. 项目概述

项目名称：酒局管家

英文代号：`jiuju`

项目类型：多人酒局管理、酒品条码识别、饮酒记录、房间统计及可视化管理后台。

核心目标：

用户注册/登录后，可以创建或加入一个酒局房间。房间成员使用手机摄像头扫描酒瓶商品条形码，系统识别酒品，然后选择实际饮用者并登记一瓶。系统自动统计每个人、本场酒局以及不同酒品的登记数量。

最终系统包含：

1. 用户 Web 端
2. Admin 可视化管理后台
3. NestJS API 后端
4. PostgreSQL 数据库
5. 后续可扩展微信小程序

核心流程：

用户登录
→ 创建酒局
→ 朋友加入
→ 扫描酒瓶条形码
→ 查询/创建酒品
→ 选择饮用者
→ 登记一瓶
→ 自动统计

---

# 2. 产品原则

第一版坚持：

- 简单
- 稳定
- 可扩展
- 移动端优先
- Backend First
- API 与前端解耦

核心操作应该尽量控制在：

扫描 → 选人 → 确认

最好 10 秒以内完成一次登记。

禁止为了“看起来完整”而提前加入没有明确需求的复杂功能。

---

# 3. 总体技术架构

最终架构：

```text
                         Internet
                            │
             ┌──────────────┴──────────────┐
             ↓                             ↓
       用户 Web                         Admin Web
             │                             │
             └──────────────┬──────────────┘
                            ↓
                         NestJS
                           API
                            │
               ┌────────────┼────────────┐
               ↓            ↓            ↓
          PostgreSQL       Redis       Object Storage
```

V1 必须使用：

- PostgreSQL

V1 可以暂时不启用：

- Redis
- Object Storage

后续如果需要实时同步、缓存、限流增强等，再加入 Redis。

---

# 4. Monorepo 结构

最终项目：

```text
jiuju/
├── apps/
│   ├── api/
│   ├── web/
│   └── admin/
│
├── packages/
│   └── shared/
│
├── prisma/
│
├── docs/
│
├── docker/
│
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── PROJECT_SPEC.md
└── README.md
```

说明：

- `apps/api`：NestJS 后端
- `apps/web`：用户端
- `apps/admin`：管理后台
- `packages/shared`：未来共享类型、API 类型等
- `prisma`：数据库 schema、migration、seed
- `docs`：技术文档、未来需求
- `docker`：Docker 相关文件

---

# 5. Backend First 开发原则

开发顺序必须：

```text
数据库
 ↓
API
 ↓
测试
 ↓
Swagger/OpenAPI
 ↓
Admin API
 ↓
用户 Web
 ↓
Admin Web
 ↓
微信小程序
```

当前阶段禁止同时开发前端。

必须先把后端做到可以独立运行和测试。

---

# 6. 技术栈

## Backend

- Node.js
- TypeScript
- NestJS
- Prisma
- PostgreSQL
- JWT
- Swagger/OpenAPI
- class-validator
- class-transformer
- Argon2
- Helmet
- Rate Limit

包管理器：

```text
pnpm
```

TypeScript：

必须开启 strict。

---

# 7. API 基础规范

API 版本：

```text
/api/v1
```

示例：

```text
/api/v1/auth/login
/api/v1/rooms
/api/v1/products
```

以后可以扩展：

```text
/api/v2
```

不得因为 V2 直接破坏 V1 API。

---

# 8. API 响应规范

成功：

```json
{
  "success": true,
  "data": {}
}
```

分页列表：

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

失败：

```json
{
  "success": false,
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "房间不存在"
  }
}
```

禁止直接把数据库错误、SQL、stack trace 返回给用户。

---

# 9. 用户模型 User

字段：

```text
id
username
passwordHash
nickname
avatar
status
role
createdAt
updatedAt
lastLoginAt
```

status：

```text
ACTIVE
DISABLED
```

role：

```text
USER
ADMIN
SUPER_ADMIN
```

要求：

- username 唯一
- password 永远不能明文保存
- passwordHash 永远不能通过普通 API 返回
- disabled 用户不能登录
- lastLoginAt 在成功登录后更新

---

# 10. 用户注册

V1：

```text
username
password
nickname
```

要求：

- username 唯一
- password 至少 8 位
- 密码使用 Argon2 Hash
- 所有输入进行 DTO 验证

未来预留：

- 手机号
- 邮箱
- 微信 OpenID

V1 不实现微信登录。

---

# 11. 用户登录

接口：

```text
POST /api/v1/auth/login
```

返回：

```json
{
  "accessToken": "xxx",
  "user": {}
}
```

JWT Payload 最少：

```text
sub
role
```

不要在 JWT 放密码、敏感数据或完整用户对象。

接口：

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
POST /api/v1/auth/logout
```

JWT 无状态退出时，可以先由客户端删除 Token；未来如有需求再增加 Token 黑名单。

---

# 12. 房间模型 Room

字段：

```text
id
name
inviteCode
ownerId
status
createdAt
updatedAt
endedAt
```

status：

```text
ACTIVE
ENDED
```

---

# 13. 房间邀请码

要求：

- 6 位
- 大写字母 + 数字
- 唯一
- 排除容易混淆的字符：O、0、I、1
- 随机生成
- 生成冲突必须重新生成

例如：

```text
A7K92P
```

不允许：

```text
123456
AAAAAA
```

---

# 14. 房间成员 RoomMember

字段：

```text
id
roomId
userId
role
joinedAt
```

role：

```text
OWNER
MEMBER
```

数据库必须建立：

```text
UNIQUE(roomId, userId)
```

保证一个用户不能重复加入同一个房间。

---

# 15. 房间生命周期

```text
创建
 ↓
ACTIVE
 ↓
ENDED
```

ENDED 房间：

允许：

- 查看
- 查看成员
- 查看历史
- 查看统计

禁止：

- 新增成员
- 新增饮酒记录
- 修改核心数据

---

# 16. 房间权限

## OWNER

允许：

- 修改房间
- 结束房间
- 踢出成员
- 删除/修改房间记录
- 查看全部统计

## MEMBER

允许：

- 查看房间
- 查看成员
- 扫描/输入条码
- 登记饮酒记录
- 查看房间统计
- 查看自己的记录

普通 MEMBER：

不能：

- 踢人
- 修改房间
- 删除其他成员记录
- 修改其他成员记录

---

# 17. Product 酒品模型

Product 表示“商品”，不是具体某一瓶酒。

字段：

```text
id
barcode
brand
name
volumeMl
alcoholPercent
type
image
status
createdAt
updatedAt
```

type：

```text
BAIJIU
BEER
RED_WINE
WHITE_WINE
SPIRITS
COCKTAIL
OTHER
```

---

# 18. 商品条码核心设计

必须理解：

**商品条码 ≠ 具体的一瓶酒。**

例如：

```text
6901234567890
```

可能代表：

```text
XX白酒 500ml
```

但以下三瓶都可能拥有相同条码：

```text
第1瓶 6901234567890
第2瓶 6901234567890
第3瓶 6901234567890
```

因此：

```text
Product.barcode
```

必须唯一。

但：

```text
DrinkRecord.barcode
```

绝对不能唯一。

---

# 19. Product 条码查询

接口：

```text
GET /api/v1/products/barcode/:barcode
```

如果存在：

返回 Product。

如果不存在：

返回标准错误：

```text
PRODUCT_NOT_FOUND
```

前端以后可以进入“创建新酒品”流程。

V1 后端支持：

```text
POST /api/v1/products
PATCH /api/v1/products/:id
```

---

# 20. DrinkRecord 饮酒记录

DrinkRecord 表示：

> 某一个房间里，某一次实际登记的一瓶酒。

字段：

```text
id
roomId
productId
userId
createdBy
barcode
volumeMl
quantity
clientRequestId
createdAt
updatedAt
deletedAt
deletedBy
deleteReason
```

V1：

```text
quantity = 1
```

未来可以支持：

- 半瓶
- 多人分摊
- 具体独立瓶码

---

# 21. userId 与 createdBy

必须区分：

```text
userId
```

代表实际饮用者。

```text
createdBy
```

代表执行登记操作的人。

例如：

李四帮张三登记一瓶：

```text
userId = 张三
createdBy = 李四
```

禁止混淆。

---

# 22. 条形码扫描原则

扫码本身属于前端行为。

后端不负责调用摄像头。

后端只负责：

```text
barcode
 ↓
查询 Product
 ↓
返回 Product
```

未来可以有：

```text
Web
微信小程序
App
```

全部调用同一套 API。

---

# 23. DrinkRecord 创建流程

接口：

```text
POST /api/v1/rooms/:roomId/drinks
```

请求示例：

```json
{
  "productId": "xxx",
  "userId": "xxx",
  "clientRequestId": "uuid"
}
```

后端必须依次：

1. 验证 JWT
2. 获取当前登录用户
3. 验证当前用户属于该房间
4. 验证房间存在
5. 验证房间为 ACTIVE
6. 验证 Product 存在
7. 验证 userId 属于该房间
8. 验证 clientRequestId 是否重复
9. 创建 DrinkRecord
10. 返回记录

不能相信前端传来的 `createdBy`。

`createdBy` 必须从 JWT 当前用户获得。

---

# 24. 幂等设计

必须防止用户连续点击两次导致一瓶酒变成两瓶。

使用：

```text
clientRequestId
```

数据库建立：

```text
UNIQUE(roomId, clientRequestId)
```

重复请求：

应该返回原来已经创建的 DrinkRecord。

不能创建第二条记录。

---

# 25. DrinkRecord 删除

V1 使用软删除。

不要直接物理删除。

字段：

```text
deletedAt
deletedBy
deleteReason
```

正常查询：

```text
deletedAt IS NULL
```

后台可以查询已删除记录。

所有管理员删除操作必须写 OperationLog。

---

# 26. 统计

## 房间统计

必须提供：

```text
总瓶数
总容量
成员数量
酒品数量
成员排行
酒品排行
```

---

# 27. 成员统计

例如：

```text
张三
4瓶
2000ml

李四
3瓶
1500ml

王五
2瓶
1000ml
```

统计必须排除：

```text
deletedAt IS NOT NULL
```

---

# 28. 酒品统计

例如：

```text
XX白酒
8瓶
4000ml

XX啤酒
12瓶
6000ml
```

---

# 29. 时间规范

数据库统一使用 UTC。

API 时间使用 ISO 8601。

前端根据用户本地时区显示。

禁止在数据库保存：

```text
2026-08-15 20:30 北京时间字符串
```

这种没有时区信息的时间。

---

# 30. 分页

所有 Admin 列表必须支持：

```text
page
pageSize
sort
order
```

默认：

```text
page = 1
pageSize = 20
```

最大：

```text
pageSize = 100
```

防止一次读取海量数据。

---

# 31. 搜索

Admin 至少支持：

## 用户

```text
username
nickname
```

## 房间

```text
name
inviteCode
```

## 酒品

```text
barcode
brand
name
```

## 饮酒记录

```text
room
user
product
date
```

---

# 32. Admin API

Admin API 统一：

```text
/api/v1/admin/*
```

至少：

```text
GET /api/v1/admin/dashboard

GET /api/v1/admin/users
GET /api/v1/admin/users/:id

GET /api/v1/admin/rooms
GET /api/v1/admin/rooms/:id

GET /api/v1/admin/products
GET /api/v1/admin/products/:id

GET /api/v1/admin/drinks
GET /api/v1/admin/drinks/:id

GET /api/v1/admin/logs
```

管理操作：

```text
PATCH /api/v1/admin/users/:id/status
POST  /api/v1/admin/rooms/:id/end
POST  /api/v1/admin/products
PATCH /api/v1/admin/products/:id
DELETE /api/v1/admin/drinks/:id
```

所有 Admin API 必须检查管理员权限。

---

# 33. Admin Dashboard

必须返回：

```text
用户总数
活跃用户
房间总数
进行中房间
已结束房间
酒品数量
饮酒记录总数
今日酒局
今日饮酒记录
```

以及：

```text
最近7天新增用户
最近7天新增房间
最近7天饮酒记录
```

---

# 34. Admin 用户管理

支持：

- 搜索
- 查看
- 分页
- 禁用
- 恢复

禁止：

- 查看密码
- 查看 passwordHash

---

# 35. Admin 房间管理

支持：

- 搜索
- 分页
- 查看房间
- 查看房主
- 查看成员
- 查看酒品
- 查看饮酒记录
- 查看统计
- 结束房间

---

# 36. Admin 酒品管理

支持：

- 搜索
- 条码搜索
- 新增
- 修改
- 停用
- 查看使用次数

例如：

```text
6901234567890
XX白酒
扫描次数：328
状态：正常
```

---

# 37. Admin 饮酒记录管理

支持：

- 搜索
- 按房间筛选
- 按用户筛选
- 按酒品筛选
- 按日期筛选
- 查看详情
- 删除错误记录

删除必须提供：

```text
deleteReason
```

并写入操作日志。

---

# 38. Admin 权限

V1：

```text
SUPER_ADMIN
ADMIN
```

SUPER_ADMIN：

全部权限。

ADMIN：

- 用户
- 房间
- 酒品
- 饮酒记录
- 统计

未来可增加：

```text
OPERATOR
```

---

# 39. OperationLog

字段：

```text
id
adminUserId
action
targetType
targetId
details
ip
userAgent
createdAt
```

示例：

```text
管理员：张三

操作：DELETE_DRINK_RECORD

目标：DrinkRecord #18293

原因：误扫码
```

敏感操作必须写日志。

---

# 40. Swagger

必须提供：

```text
/api/docs
```

所有接口必须有：

- 描述
- 请求参数
- Request Body
- Response
- Authorization
- 错误码

同时输出：

```text
openapi.json
```

以后用于生成前端 TypeScript Client。

---

# 41. 数据库迁移

使用：

```text
Prisma Migration
```

生产环境禁止使用：

```text
prisma db push
```

作为正式迁移方案。

开发阶段可以使用，但最终必须生成 migration。

---

# 42. Seed

提供：

```text
prisma/seed.ts
```

至少生成：

```text
SUPER_ADMIN
测试用户
测试酒品
```

管理员密码必须通过环境变量提供。

禁止把真实密码硬编码到 Git。

---

# 43. 环境变量

必须提供：

```text
NODE_ENV
DATABASE_URL
JWT_SECRET
JWT_EXPIRES_IN
CORS_ORIGINS
API_PORT
```

提供：

```text
.env.example
```

禁止提交：

```text
.env
```

---

# 44. Docker

开发：

```text
docker compose up -d postgres
```

API：

```text
pnpm dev
```

生产：

```text
docker compose up -d
```

最终容器：

```text
api
postgres
web
admin
```

V1 Backend First 阶段只要求：

```text
api
postgres
```

---

# 45. 健康检查

必须：

```text
GET /api/v1/health
```

正常返回：

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

后续可以增加数据库健康状态。

---

# 46. 安全

必须：

- Helmet
- CORS
- Rate Limit
- DTO Validation
- JWT Guard
- Role Guard
- Argon2
- 参数校验

禁止：

- 明文密码
- MD5
- SHA1
- 把 JWT 写入日志
- 把数据库密码写入日志
- 信任前端传来的身份

---

# 47. 登录限流

至少对以下接口增加 Rate Limit：

```text
POST /auth/login
POST /auth/register
POST /rooms
POST /rooms/join
POST /rooms/:roomId/drinks
```

---

# 48. API 测试

必须测试：

## Auth

- 注册成功
- 重复注册失败
- 登录成功
- 错误密码
- JWT
- disabled 用户不能登录

## Room

- 创建
- 加入
- 重复加入
- 错误邀请码
- 退出
- 结束
- ended 后不能新增记录

## Member

- 成员权限
- OWNER 权限
- 踢人
- 非成员访问

## Product

- 查询
- 创建
- 修改
- 重复 barcode

## DrinkRecord

- 正常登记
- 非成员
- 非房间用户
- 房间结束
- 重复请求
- 删除
- 修改
- 权限

## Stats

- 瓶数
- 容量
- 成员排行
- 酒品排行
- 删除记录不计入

## Admin

- USER 不能访问
- ADMIN 可以
- SUPER_ADMIN 可以
- 删除写日志

---

# 49. E2E 验收流程

必须能够完整测试：

```text
注册用户 A
 ↓
登录 A
 ↓
创建房间
 ↓
生成邀请码
 ↓
注册用户 B
 ↓
登录 B
 ↓
B 加入房间
 ↓
创建酒品
 ↓
B 登记一瓶
 ↓
查询统计
 ↓
A 查看统计
```

最终：

```text
1瓶
500ml
```

统计必须完全一致。

---

# 50. 未来 Web 用户端

后端稳定后开发：

```text
apps/web
```

技术：

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Tailwind CSS

页面：

```text
/login
/register

/
/rooms
/rooms/create
/rooms/join
/rooms/:roomId
/rooms/:roomId/scan
/rooms/:roomId/drinks
/rooms/:roomId/members
/rooms/:roomId/stats
/me
```

---

# 51. 用户端核心体验

房间首页：

```text
老张生日局

邀请码：A7K92P

已登记：
12瓶
6000ml

[扫一扫]

本场统计：

张三 4瓶
李四 3瓶
王五 2瓶
赵六 1瓶
```

核心流程：

```text
打开房间
 ↓
扫一扫
 ↓
识别条码
 ↓
选择饮用者
 ↓
确认
```

---

# 52. 条码扫描

未来用户端调用手机摄像头。

目标支持：

- EAN-13
- EAN-8
- UPC
- Code128
- QR Code

优先使用成熟浏览器扫描库。

不要自行实现条码识别算法。

摄像头权限失败必须支持：

```text
手动输入条码
```

---

# 53. Admin Web

后端稳定后开发：

```text
apps/admin
```

技术：

- Vue 3
- TypeScript
- Vite
- Element Plus
- Pinia
- Vue Router
- ECharts

左侧菜单：

```text
仪表盘
用户管理
房间管理
酒品管理
条码管理
饮酒记录
数据统计
操作日志
系统设置
```

---

# 54. Admin 仪表盘

显示：

```text
用户总数
房间总数
酒品数量
饮酒记录
今日酒局
今日登记
```

图表：

```text
最近7天用户增长
最近7天房间增长
最近7天饮酒记录
```

---

# 55. 后台系统设置

未来支持：

- 网站名称
- Logo
- 注册开关
- 房间创建开关
- 房间人数限制
- 单房间记录限制
- 系统公告

V1 后端可以预留 Settings 模型，但没有明确需求时不要过度实现。

---

# 56. 微信小程序

最终可增加：

```text
apps/miniprogram
```

小程序直接使用：

```text
/api/v1
```

不重新设计数据库。

后端必须保持与客户端解耦。

---

# 57. 独立瓶码未来设计

如果未来酒瓶存在：

- 防伪码
- 监管码
- 生产序列号
- 独立二维码
- NFC

可以增加：

```text
Bottle
```

结构：

```text
Bottle
├── id
├── productId
├── serialNumber
├── roomId
├── drinkRecordId
└── createdAt
```

关系：

```text
Product
  ↓
Bottle
  ↓
DrinkRecord
```

V1 不实现。

---

# 58. V1 明确不做

禁止 Agent 自行增加：

- 支付
- 商城
- 广告
- 聊天
- 好友
- 朋友圈
- 直播
- AI
- 酒精健康分析
- 推荐系统
- 积分
- 会员
- 复杂消息系统

未来需求写入：

```text
docs/FUTURE.md
```

不要自行实现。

---

# 59. Git 规范

每个 Phase 独立提交。

示例：

```text
feat: initialize backend
feat: add database schema
feat: add authentication
feat: add user management
feat: add room management
feat: add room members
feat: add products
feat: add drink records
feat: add statistics
feat: add admin api
feat: add operation logs
test: add backend e2e tests
chore: add docker deployment
```

每次提交前检查：

```text
git status
```

确保没有：

```text
.env
node_modules
secret
password
private key
```

---

# 60. Agent 总开发规则

你是“酒局管家”项目的主程 Agent。

必须先阅读整个 `PROJECT_SPEC.md`。

不要自行改变架构。

采用 Backend First。

严格按 Phase 开发。

每次只实现当前 Phase。

完成当前 Phase 后：

1. 运行 TypeScript 检查
2. 运行 ESLint
3. 运行 Unit Test
4. 运行 E2E Test
5. 运行 Build
6. 检查 Docker
7. 检查 Prisma
8. 检查 Swagger
9. 更新 README
10. 创建 Git commit

没有完成当前 Phase 的测试，不得进入下一 Phase。

---

# 61. Agent 开发 Phase

严格执行：

## Phase 1：项目初始化

实现：

- NestJS
- TypeScript strict
- pnpm
- ESLint
- Prettier
- Prisma
- PostgreSQL Docker
- 环境变量
- Swagger
- Health API
- 基础日志
- 基础错误处理
- README

禁止实现：

- User
- Auth
- Room
- Product
- DrinkRecord
- Admin UI
- Web UI

完成后：

```text
feat: initialize backend
```

然后停止。

---

## Phase 2：数据库

实现：

- User
- Room
- RoomMember
- Product
- DrinkRecord
- OperationLog

完成：

- Prisma Schema
- Migration
- Seed
- 索引
- Unique
- Foreign Key

完成后：

```text
feat: add database schema
```

然后停止。

---

## Phase 3：Auth

实现：

- Register
- Login
- Me
- JWT
- Argon2
- Auth Guard
- Rate Limit

测试完成后：

```text
feat: add authentication
```

然后停止。

---

## Phase 4：Users

实现：

- 用户资料
- 用户状态
- 基础用户 API

完成：

```text
feat: add user management
```

然后停止。

---

## Phase 5：Rooms

实现：

- 创建
- 查询
- 修改
- 加入
- 退出
- 结束
- 邀请码
- 权限

完成：

```text
feat: add room management
```

然后停止。

---

## Phase 6：Room Members

实现：

- 成员列表
- OWNER
- MEMBER
- 踢人
- 权限

完成：

```text
feat: add room members
```

然后停止。

---

## Phase 7：Products

实现：

- Product
- Barcode
- 查询
- 创建
- 修改
- 停用

完成：

```text
feat: add products
```

然后停止。

---

## Phase 8：Drink Records

实现：

- 创建
- 查询
- 修改
- 软删除
- 权限
- 幂等
- clientRequestId

完成：

```text
feat: add drink records
```

然后停止。

---

## Phase 9：Statistics

实现：

- 房间统计
- 成员统计
- 酒品统计
- 总容量
- 总瓶数
- 排行

完成：

```text
feat: add statistics
```

然后停止。

---

## Phase 10：Admin API

实现：

- Dashboard
- Users
- Rooms
- Products
- Drinks
- Logs

完成：

```text
feat: add admin api
```

然后停止。

---

## Phase 11：Operation Logs

实现：

- Admin 操作日志
- 删除记录日志
- 房间管理日志
- 用户状态日志

完成：

```text
feat: add operation logs
```

然后停止。

---

## Phase 12：Swagger/OpenAPI

完善：

- 所有 DTO
- Response
- 错误码
- Authorization
- OpenAPI JSON

完成：

```text
docs: complete api documentation
```

然后停止。

---

## Phase 13：Unit Tests

核心 Service 必须覆盖。

完成：

```text
test: add backend unit tests
```

然后停止。

---

## Phase 14：E2E Tests

完成完整酒局流程。

完成：

```text
test: add backend e2e tests
```

然后停止。

---

## Phase 15：Docker

完成：

- API Dockerfile
- PostgreSQL
- Docker Compose
- Healthcheck
- Volume
- 环境变量

完成：

```text
chore: add docker deployment
```

然后停止。

---

## Phase 16：生产准备

完成：

- production env
- security review
- CORS
- Rate Limit
- migration
- backup script
- logging
- health check
- README

完成：

```text
chore: prepare production deployment
```

然后停止。

---

# 62. 当前启动指令

当 Agent 第一次启动项目时：

不要开发前端。

只执行：

```text
Phase 1
```

具体要求：

1. 创建 NestJS Backend
2. 配置 TypeScript strict
3. 配置 pnpm
4. 配置 ESLint
5. 配置 Prettier
6. 配置 Prisma
7. 配置 PostgreSQL Docker
8. 配置环境变量
9. 配置 Swagger
10. 配置目录结构
11. 配置健康检查：

```text
GET /api/v1/health
```

返回：

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

12. 配置基础异常处理
13. 配置基础日志
14. 创建 README
15. 创建 `.env.example`
16. 创建 `docker-compose.yml`
17. 配置基础测试

不要实现：

- 用户
- 登录
- 房间
- 酒品
- 饮酒记录
- Admin UI
- Web UI

完成后运行：

```text
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

确认 PostgreSQL Docker 正常。

确认 Swagger 正常。

确认：

```text
GET /api/v1/health
```

正常。

最后创建：

```text
feat: initialize backend
```

Git commit。

完成后停止。

不得自行进入 Phase 2。

---

# 63. 最终验收标准

最终系统必须能够完成：

```text
用户 A 注册
 ↓
用户 A 登录
 ↓
创建“老张生日局”
 ↓
生成邀请码 A7K92P
 ↓
用户 B 注册
 ↓
用户 B 登录
 ↓
B 输入 A7K92P
 ↓
加入房间
 ↓
查询酒品
 ↓
创建酒品
 ↓
B 登记一瓶
 ↓
DrinkRecord 创建
 ↓
房间统计更新
 ↓
A 查看统计
 ↓
看到：
1瓶
500ml
```

Admin：

```text
Admin 登录
 ↓
仪表盘
 ↓
查看用户
 ↓
查看房间
 ↓
查看酒品
 ↓
查看饮酒记录
 ↓
删除错误记录
 ↓
查看操作日志
```

整个流程必须通过 E2E 测试。

---

# 64. 产品未来方向

V2：

- 微信登录
- 微信小程序
- WebSocket 实时同步
- 多人分摊
- 酒水价格
- AA
- 账单
- 酒局历史

V3：

- 酒品数据库
- OCR
- 独立瓶码
- 防伪码
- 监管码
- 排行榜
- 更多数据统计

所有未来功能必须保持现有 API 和数据库架构可扩展。
