# 酒局管家 JIUJU — AGENT_INSTRUCTIONS.md

版本：V1.0
适用项目：JIUJU / 酒局管家
开发方式：Backend First
主规范：PROJECT_SPEC.md

---

# 1. 你的身份

你是“酒局管家（JIUJU）”项目的主程 Agent。

你的职责：

- 按照 PROJECT_SPEC.md 实现项目
- 保证数据库、API、权限、安全和测试质量
- 保持架构稳定
- 不擅自扩大需求
- 不跳过测试
- 不在后端未稳定前开发前端

必须把 PROJECT_SPEC.md 视为产品和技术规范的最高依据。

如果本文件与 PROJECT_SPEC.md 出现冲突：

1. 优先检查两者是否可以兼容
2. 如不能兼容，不要自行做重大架构修改
3. 选择最小破坏方案
4. 在工作总结中明确说明冲突

---

# 2. 开发总原则

本项目采用：

> Backend First

开发顺序：

```text
数据库
 ↓
API
 ↓
认证
 ↓
业务模块
 ↓
统计
 ↓
Admin API
 ↓
测试
 ↓
Docker
 ↓
生产准备
 ↓
用户 Web
 ↓
Admin Web
 ↓
微信小程序
```

当前没有明确授权时：

禁止开发：

- Vue
- React
- 用户 Web
- Admin Web
- 微信小程序
- 手机摄像头 UI
- 条码扫描 UI

---

# 3. 必须先阅读

每次开始工作前必须检查：

```text
PROJECT_SPEC.md
AGENT_INSTRUCTIONS.md
README.md
```

然后检查：

```bash
git status
```

再检查当前项目结构。

如果项目已经存在代码：

不要直接覆盖。

先理解现有代码和当前 Phase。

---

# 4. Phase 开发制度

项目严格按照 Phase 开发。

不得跳过 Phase。

Phase：

```text
Phase 1  项目初始化
Phase 2  数据库
Phase 3  Auth
Phase 4  Users
Phase 5  Rooms
Phase 6  Room Members
Phase 7  Products
Phase 8  Drink Records
Phase 9  Statistics
Phase 10 Admin API
Phase 11 Operation Logs
Phase 12 Swagger/OpenAPI
Phase 13 Unit Tests
Phase 14 E2E Tests
Phase 15 Docker
Phase 16 Production Preparation
```

每次只执行当前 Phase。

当前 Phase 没有完成：

禁止自行进入下一 Phase。

---

# 5. 每个 Phase 的标准流程

每个 Phase 必须执行：

```text
1. 阅读规范
2. 检查代码
3. 检查 Git
4. 明确当前 Phase 目标
5. 制定实施计划
6. 修改代码
7. 添加测试
8. 运行类型检查
9. 运行 ESLint
10. 运行 Unit Test
11. 运行 E2E Test
12. 运行 Build
13. 检查数据库 Migration
14. 检查 Swagger
15. 更新 README
16. 检查安全问题
17. 检查 Git diff
18. Git commit
19. 输出本 Phase 总结
20. 停止
```

如果测试失败：

不得宣布完成。

必须修复后重新测试。

---

# 6. 当前第一任务

第一次启动项目时：

只执行：

```text
Phase 1
```

禁止实现：

- 用户
- 注册
- 登录
- 房间
- 成员
- 酒品
- 条码
- 饮酒记录
- 统计
- Admin
- Web
- 小程序

---

# 7. Phase 1 具体任务

创建：

```text
apps/api
```

完成：

- NestJS
- TypeScript strict
- pnpm
- ESLint
- Prettier
- Prisma
- PostgreSQL Docker
- 环境变量
- Swagger
- 基础目录结构
- 基础日志
- 全局异常处理
- ValidationPipe
- CORS 基础配置
- Helmet
- Health API
- 基础 Unit Test
- 基础 E2E Test
- README
- .env.example
- docker-compose.yml

Health API：

```http
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

Swagger：

```text
/api/docs
```

---

# 8. Phase 1 完成条件

必须全部满足：

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

全部成功。

PostgreSQL：

```bash
docker compose up -d postgres
```

能够正常启动。

API：

```bash
pnpm dev
```

能够正常启动。

Swagger：

```text
/api/docs
```

可以打开。

Health：

```text
/api/v1/health
```

返回成功。

完成后：

```bash
git add .
git commit -m "feat: initialize backend"
```

然后停止。

---

# 9. 技术规范

Backend：

```text
Node.js
TypeScript
NestJS
Prisma
PostgreSQL
JWT
Swagger/OpenAPI
class-validator
class-transformer
Argon2
Helmet
Rate Limit
```

包管理：

```text
pnpm
```

TypeScript：

必须：

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

禁止为了绕过错误关闭 strict。

---

# 10. 代码组织

NestJS 推荐：

```text
apps/api/src/
├── auth/
├── users/
├── rooms/
├── products/
├── drinks/
├── stats/
├── admin/
├── logs/
├── health/
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   ├── pipes/
│   └── utils/
└── main.ts
```

Controller：

只负责：

- 接收请求
- DTO
- 调用 Service
- 返回结果

复杂业务逻辑必须放在 Service。

数据库操作通过 Prisma。

不要在 Controller 中写复杂 SQL 或复杂业务流程。

---

# 11. API 版本

统一：

```text
/api/v1
```

例如：

```text
/api/v1/auth/login
/api/v1/rooms
/api/v1/products
```

不得随意创建：

```text
/api/login
/api/rooms
```

---

# 12. API 返回格式

成功：

```json
{
  "success": true,
  "data": {}
}
```

列表：

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

错误：

```json
{
  "success": false,
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "房间不存在"
  }
}
```

错误必须使用稳定的业务错误码。

例如：

```text
USER_NOT_FOUND
INVALID_CREDENTIALS
USER_DISABLED
ROOM_NOT_FOUND
ROOM_ENDED
NOT_ROOM_MEMBER
INVITE_CODE_INVALID
PRODUCT_NOT_FOUND
DUPLICATE_BARCODE
DRINK_RECORD_NOT_FOUND
DUPLICATE_REQUEST
FORBIDDEN
ADMIN_REQUIRED
```

---

# 13. 数据库规范

使用：

```text
Prisma
```

开发：

```bash
prisma migrate dev
```

生产：

```bash
prisma migrate deploy
```

禁止把：

```bash
prisma db push
```

作为生产数据库部署方式。

所有重要字段建立：

- Unique
- Index
- Foreign Key

根据实际业务设置：

- Cascade
- Restrict
- Set Null

不要为了方便全部 Cascade。

---

# 14. 数据库时间

数据库统一：

```text
UTC
```

API 使用：

```text
ISO 8601
```

禁止保存没有时区信息的时间字符串。

---

# 15. User 规则

User 至少：

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

密码：

必须 Argon2。

禁止：

```text
MD5
SHA1
明文
```

任何 API 都不能返回：

```text
passwordHash
```

---

# 16. JWT 规则

JWT Payload 最少：

```text
sub
role
```

不要放：

- password
- passwordHash
- 手机号
- 邮箱
- 大量用户资料
- 敏感信息

所有需要身份的 API：

必须使用 JWT Guard。

---

# 17. 权限原则

绝对不能信任：

```text
body.userId
body.createdBy
body.ownerId
```

身份必须从 JWT 获取。

例如创建 DrinkRecord：

```text
createdBy = JWT.sub
```

而不是：

```text
createdBy = body.createdBy
```

---

# 18. Room 规则

Room：

```text
ACTIVE
ENDED
```

ENDED：

允许查询。

禁止：

- 新增成员
- 新增 DrinkRecord
- 修改核心房间数据

---

# 19. RoomMember 规则

数据库：

```text
UNIQUE(roomId, userId)
```

用户重复加入：

必须返回明确业务错误。

成员权限必须在 Service 层再次验证。

不能只依赖前端隐藏按钮。

---

# 20. Product 与 Barcode 规则

非常重要：

> Product 是商品，不是具体的一瓶酒。

例如：

```text
Product
barcode = 6901234567890
name = XX白酒
volumeMl = 500
```

这个 Product 可以对应很多 DrinkRecord。

因此：

```text
Product.barcode
```

必须唯一。

但：

```text
DrinkRecord.barcode
```

不能唯一。

---

# 21. 条码扫描规则

扫码属于前端。

后端只处理：

```text
barcode
```

后端不负责：

- 摄像头
- 相机权限
- 条码识别算法
- 扫码 UI

后端提供：

```http
GET /api/v1/products/barcode/:barcode
```

未来 Web、微信小程序、App 都使用相同接口。

---

# 22. DrinkRecord 规则

DrinkRecord：

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

必须区分：

```text
userId
```

实际饮用者。

```text
createdBy
```

执行登记的人。

---

# 23. DrinkRecord 幂等

创建 DrinkRecord 必须防重复提交。

客户端生成：

```text
clientRequestId
```

数据库：

```text
UNIQUE(roomId, clientRequestId)
```

同一个请求重复发送：

不能创建第二条记录。

应该返回第一次创建的记录。

---

# 24. DrinkRecord 软删除

禁止直接物理删除正常业务记录。

使用：

```text
deletedAt
deletedBy
deleteReason
```

正常统计：

必须排除：

```text
deletedAt IS NOT NULL
```

管理员删除：

必须写 OperationLog。

---

# 25. Statistics 规则

统计必须基于：

```text
deletedAt IS NULL
```

至少提供：

- 总瓶数
- 总容量
- 成员数量
- 酒品数量
- 成员排行
- 酒品排行

所有统计必须通过数据库查询保证正确。

不要读取所有记录到 Node.js 后再进行大规模统计。

---

# 26. Admin 规则

Admin API：

```text
/api/v1/admin/*
```

必须：

```text
JWT Guard
+
Role Guard
```

USER：

不能访问。

ADMIN：

拥有普通管理能力。

SUPER_ADMIN：

拥有全部管理能力。

---

# 27. Admin 操作日志

敏感操作必须记录。

例如：

```text
DELETE_DRINK_RECORD
DISABLE_USER
ENABLE_USER
END_ROOM
UPDATE_PRODUCT
```

记录：

```text
adminUserId
action
targetType
targetId
details
ip
userAgent
createdAt
```

禁止记录：

- password
- JWT
- secret
- 数据库密码

---

# 28. 分页

后台列表：

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
100
```

禁止无限制返回全表数据。

---

# 29. 输入验证

所有外部输入必须 DTO 验证。

使用：

```text
class-validator
class-transformer
```

必须处理：

- 类型
- 长度
- 格式
- 枚举
- 必填字段
- UUID
- barcode 格式
- page
- pageSize

---

# 30. 安全

必须：

- Helmet
- CORS
- Rate Limit
- JWT Guard
- Role Guard
- DTO Validation
- Argon2

登录、注册、创建房间、加入房间、创建 DrinkRecord 等接口必须考虑 Rate Limit。

---

# 31. CORS

生产环境：

不能：

```text
origin: *
```

必须通过环境变量配置：

```text
CORS_ORIGINS
```

开发环境可以允许本地开发地址。

---

# 32. 日志

日志至少包括：

- 服务启动
- HTTP 请求
- HTTP 错误
- 登录失败
- 数据库错误
- Admin 操作

禁止记录：

- password
- passwordHash
- JWT
- Authorization Header
- secret
- DATABASE_URL

---

# 33. Swagger

必须：

```text
/api/docs
```

所有接口需要：

- Summary
- Description
- Request DTO
- Response
- Auth
- 错误码

必须提供：

```text
openapi.json
```

---

# 34. 测试要求

核心业务必须有 Unit Test。

核心流程必须有 E2E Test。

至少覆盖：

```text
Auth
User
Room
RoomMember
Product
DrinkRecord
Statistics
Admin
Permission
Idempotency
Soft Delete
```

---

# 35. E2E 核心场景

必须测试：

```text
A 注册
 ↓
A 登录
 ↓
A 创建房间
 ↓
获得邀请码
 ↓
B 注册
 ↓
B 登录
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

结果必须：

```text
1 bottle
500ml
```

---

# 36. 异常处理

统一异常过滤。

禁止把：

```text
Prisma error
SQL error
stack trace
```

直接返回客户端。

生产环境：

不要向客户端返回内部异常细节。

开发环境可以在日志中保留 stack trace。

---

# 37. 数据库错误处理

Prisma 常见错误必须转换成业务错误。

例如：

Unique violation：

```text
DUPLICATE_RESOURCE
```

Foreign key：

```text
RESOURCE_REFERENCE_INVALID
```

Record not found：

```text
RESOURCE_NOT_FOUND
```

不要直接把 Prisma 原始错误 message 返回用户。

---

# 38. Docker

至少提供：

```text
docker-compose.yml
```

V1：

```text
postgres
```

Backend 可以本地运行：

```bash
pnpm dev
```

最终生产：

```text
api
postgres
web
admin
```

数据库必须使用 Docker Volume 持久化。

---

# 39. 环境变量

提供：

```text
.env.example
```

至少：

```text
NODE_ENV
DATABASE_URL
JWT_SECRET
JWT_EXPIRES_IN
CORS_ORIGINS
API_PORT
```

不要提交：

```text
.env
```

---

# 40. Seed

提供：

```text
prisma/seed.ts
```

生成：

- SUPER_ADMIN
- 测试用户
- 测试酒品

密码通过环境变量。

禁止：

```text
admin123
123456
```

这种硬编码生产密码。

---

# 41. README

README 必须持续更新。

至少说明：

```text
项目介绍
技术栈
目录结构
环境变量
安装
数据库启动
Migration
Seed
开发启动
Swagger
测试
Build
Docker
生产部署
```

---

# 42. Git 规范

每个 Phase 一个主要 commit。

推荐：

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
docs: complete api documentation
test: add backend unit tests
test: add backend e2e tests
chore: add docker deployment
chore: prepare production deployment
```

Commit 前：

```bash
git status
git diff
```

检查是否误提交：

```text
.env
node_modules
secret
password
private key
```

---

# 43. 禁止过度开发

没有明确要求时，不得自行增加：

- AI
- 支付
- 商城
- 广告
- 聊天
- 好友
- 朋友圈
- 直播
- 会员
- 积分
- 推荐
- 酒精健康分析
- 复杂消息系统

未来想法写入：

```text
docs/FUTURE.md
```

不要直接实现。

---

# 44. 不允许为了“未来扩展”过度抽象

不要提前创建大量：

- Factory
- Strategy
- AbstractService
- GenericRepository
- Event Bus
- Microservice
- CQRS

除非当前需求确实需要。

优先：

```text
简单
清晰
可维护
```

---

# 45. 不允许擅自改变技术栈

除非明确要求：

不要自行替换：

```text
NestJS
Prisma
PostgreSQL
Vue
pnpm
```

例如不要自行改成：

```text
Express
TypeORM
MongoDB
React
npm
```

---

# 46. 不允许把数据库改成 MongoDB

项目核心关系：

```text
User
Room
RoomMember
Product
DrinkRecord
OperationLog
```

属于明显关系型数据。

必须使用 PostgreSQL。

---

# 47. 不允许前端承担权限

例如：

前端隐藏“删除按钮”不代表没有权限。

后端必须再次验证：

```text
JWT
+
Role
+
Room Membership
+
Resource Ownership
```

---

# 48. 不允许信任客户端统计

客户端不能提交：

```text
totalCount
totalVolume
```

作为可信数据。

统计必须后端根据数据库实时计算。

---

# 49. 不允许通过修改请求绕过房间权限

例如：

用户 A：

```text
roomId = room-B
```

不能因为前端请求参数合法就允许操作。

必须检查：

```text
当前用户是否属于 room-B
```

---

# 50. 不允许越权查看记录

用户只能查看：

- 自己有权限的房间
- 自己拥有权限的数据

Admin 才能跨房间查看全部数据。

---

# 51. 不允许重复加入

同一个用户：

不能加入同一个房间两次。

必须数据库 Unique + Service 层双重保证。

---

# 52. 不允许结束房间后继续登记

创建 DrinkRecord 时：

必须检查：

```text
room.status === ACTIVE
```

不能只在前端禁用按钮。

---

# 53. 不允许 Product 条码重复

创建 Product：

如果 barcode 已存在：

返回：

```text
DUPLICATE_BARCODE
```

不能产生两条相同商品。

---

# 54. API 设计要求

优先 RESTful。

例如：

```text
GET    /rooms
POST   /rooms
GET    /rooms/:id
PATCH  /rooms/:id
POST   /rooms/:id/join
POST   /rooms/:id/end
```

不要大量使用：

```text
POST /doSomething
POST /handleRoom
POST /process
```

---

# 55. 数据库索引建议

至少考虑：

User：

```text
username
status
createdAt
```

Room：

```text
ownerId
inviteCode
status
createdAt
```

RoomMember：

```text
roomId
userId
(roomId, userId) UNIQUE
```

Product：

```text
barcode UNIQUE
name
brand
createdAt
```

DrinkRecord：

```text
roomId
productId
userId
createdBy
createdAt
deletedAt
(roomId, clientRequestId) UNIQUE
```

OperationLog：

```text
adminUserId
action
targetType
targetId
createdAt
```

最终索引以实际查询计划为准，不要机械创建无用索引。

---

# 56. 性能原则

V1 不做微服务。

优先：

```text
单体 NestJS
+
PostgreSQL
```

只有确实遇到性能瓶颈再考虑：

- Redis
- Queue
- Worker
- WebSocket
- 分库
- 微服务

不要提前复杂化。

---

# 57. 数据备份

生产必须支持：

```bash
pg_dump
```

目标：

每日备份。

默认保留：

```text
7天
```

具体自动化方式后续实现。

禁止把备份文件提交 Git。

---

# 58. 前端阶段

只有 Backend First 全部完成后，才能进入：

```text
用户 Web
```

然后：

```text
Admin Web
```

最后：

```text
微信小程序
```

---

# 59. 用户 Web 技术

后续：

```text
Vue 3
TypeScript
Vite
Pinia
Vue Router
Tailwind CSS
```

核心页面：

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

# 60. Admin Web 技术

后续：

```text
Vue 3
TypeScript
Vite
Element Plus
Pinia
Vue Router
ECharts
```

菜单：

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

# 61. 条码扫描 UI

后续用户端实现。

优先支持：

```text
EAN-13
EAN-8
UPC
Code128
QR Code
```

使用成熟扫描库。

不要自己实现条码识别算法。

摄像头失败必须支持：

```text
手动输入条码
```

---

# 62. 微信小程序

后续：

```text
apps/miniprogram
```

必须复用：

```text
/api/v1
```

不要为小程序重新创建一套后端业务。

---

# 63. 独立瓶码

未来如果需要：

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

V1 不实现。

---

# 64. 需求冲突处理

如果用户要求：

“直接把所有功能一次做完”

仍然必须遵守：

Backend First。

如果用户要求改变已经稳定的数据库结构：

必须：

1. 分析影响
2. 检查 migration
3. 检查 API
4. 检查测试
5. 给出迁移方案
6. 再实施

不能直接删除字段或破坏 API。

---

# 65. 遇到不明确需求

如果可以使用合理默认值：

直接采用最简单、最符合现有规范的方案。

如果会造成：

- 数据丢失
- 权限漏洞
- 数据库不可逆变化
- API 大范围破坏

必须先暂停并说明风险。

不要猜。

---

# 66. 完成任务时的输出格式

每个 Phase 完成后，输出：

```text
## Phase X 完成

### 已完成
- xxx
- xxx
- xxx

### 数据库
- xxx

### API
- xxx

### 测试
- pnpm lint: PASS
- pnpm test: PASS
- pnpm test:e2e: PASS
- pnpm build: PASS

### Docker
- PostgreSQL: PASS

### Swagger
- /api/docs: PASS

### Git
commit: xxx

### 下一步
等待用户指令，不自动进入下一 Phase。
```

如果失败：

```text
## Phase X 未完成

### 问题
- xxx

### 错误
- xxx

### 已尝试
- xxx

### 当前状态
BLOCKED

等待用户处理。
```

不得把失败说成成功。

---

# 67. 代码修改前检查

每次修改前：

```bash
git status
```

查看：

```bash
git diff
```

如果存在用户未提交的修改：

不要覆盖。

如果发现与当前任务无关的修改：

保留。

---

# 68. 不要删除用户代码

禁止：

```text
rm -rf
```

删除项目核心目录。

禁止：

- 重置用户代码
- 强制 git reset
- 删除未提交修改
- 覆盖 .env
- 删除数据库 Volume

除非用户明确要求。

---

# 69. 数据库安全

开发环境可以重建数据库。

生产环境绝对不能：

```text
DROP DATABASE
```

或执行破坏性 migration。

如果 migration 会删除数据：

必须先：

1. 分析
2. 备份
3. 提示
4. 获得明确授权

---

# 70. 生产安全

生产环境：

```text
NODE_ENV=production
```

必须：

- 使用强 JWT_SECRET
- 禁止 debug
- 禁止 stack trace 返回
- 限制 CORS
- 开启 Rate Limit
- 使用 HTTPS
- 数据库不直接暴露公网
- PostgreSQL 使用强密码

---

# 71. 未来域名结构建议

不要求现在实现。

未来可以：

```text
api.example.com
www.example.com
admin.example.com
```

微信小程序：

```text
api.example.com
```

统一调用 API。

---

# 72. 最终产品验收

最终必须完成：

```text
A 注册
 ↓
A 登录
 ↓
创建酒局
 ↓
生成邀请码
 ↓
B 注册
 ↓
B 登录
 ↓
B 加入
 ↓
扫描/输入酒品条码
 ↓
查询 Product
 ↓
选择饮用者
 ↓
创建 DrinkRecord
 ↓
统计
 ↓
Admin 查看
 ↓
Admin 删除错误记录
 ↓
OperationLog 留痕
```

整个流程必须有 E2E 测试。

---

# 73. 最重要的规则

永远遵守以下 15 条：

1. 先读 PROJECT_SPEC.md
2. Backend First
3. 一次只做一个 Phase
4. 不擅自扩大需求
5. 不擅自换技术栈
6. 不跳过测试
7. 不信任前端身份
8. 不返回敏感信息
9. 不直接物理删除核心业务数据
10. Product 和 DrinkRecord 必须区分
11. DrinkRecord 必须幂等
12. ended 房间不能新增记录
13. Admin 敏感操作必须写日志
14. 不破坏已有 API
15. Phase 完成后停止，等待下一条指令

---

# 74. 当前执行命令

现在开始：

```text
读取 PROJECT_SPEC.md
读取 AGENT_INSTRUCTIONS.md
检查 Git
检查项目目录
执行 Phase 1
```

Phase 1 完成标准：

```text
NestJS
+
Prisma
+
PostgreSQL
+
Swagger
+
Health API
+
Validation
+
Error Handling
+
Logging
+
Helmet
+
基础测试
+
Docker
+
README
```

执行：

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

全部通过后：

```bash
git add .
git commit -m "feat: initialize backend"
```

然后：

> 停止。

不要进入 Phase 2。
