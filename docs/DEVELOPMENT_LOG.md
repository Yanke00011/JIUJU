# 酒局管家（JIUJU）开发日志

本文档记录项目的开发历史、阶段完成情况、重要技术决策与 API/数据库变化。

> 规则：每完成一个 Phase，必须在此文档追加记录（新增功能、数据库变化、API 变化、Git commit、测试结果）。

---

## Phase 17.3.2 — Admin 用户权限管理增强

- **状态**：已完成
- **新增功能**：后台支持 SUPER_ADMIN 管理管理员权限。
  - 新增接口 `PATCH /api/v1/admin/users/:id/role`（`{ role: "USER" | "ADMIN" }`，仅 SUPER_ADMIN）。
  - 用户管理页：角色列已展示（普通用户 / 管理员 / 超级管理员标签）；当前用户为 SUPER_ADMIN 时，对普通用户显示「设置管理员」、对管理员显示「取消管理员权限」按钮（Popconfirm 确认），成功后 Toast 反馈并刷新列表。
  - 操作日志新增 `USER_ROLE_UPDATE`（details 含 `oldRole / newRole / targetUser`），仪表盘与日志页动作标签/过滤器已补充。
- **权限规则**：
  - 仅 SUPER_ADMIN 可提升/降级（ADMIN 调用 → 403 `SUPER_ADMIN_REQUIRED`；USER → 403 `FORBIDDEN`）；
  - 仅允许 `USER ↔ ADMIN`，禁止设置为 SUPER_ADMIN（DTO 400 `VALIDATION_ERROR`）；
  - 不能修改自己（403 `CANNOT_MODIFY_SELF_ROLE`）；
  - 不能修改 SUPER_ADMIN（403 `CANNOT_MODIFY_SUPER_ADMIN`）；
  - 角色相同视为幂等，直接返回不写日志。
- **API 变化**：新增 `PATCH /api/v1/admin/users/:id/role`（其余不变）。
- **数据库变化**：无（OperationLog 复用既有字段，无需 migration）。
- **影响范围**：`apps/api/src/admin/admin-users.controller.ts`、`admin-users.service.ts`、新增 `dto/update-user-role.dto.ts`、`admin-users.service.spec.ts`、`test/admin.e2e-spec.ts`；`apps/web/src/pages/admin/AdminUsers.tsx`、`AdminDashboard.tsx`、`AdminLogs.tsx`、`apps/web/src/services/admin.ts`
- **测试结果**：后端 typecheck/lint ✅、unit 151 ✅（+6）、e2e 127 ✅（+7，覆盖提升/降级/ADMIN 403/USER 403/自改 403/改超管 403/SET SUPER_ADMIN 400/OperationLog）；前端 typecheck/build ✅；浏览器实测（SUPER_ADMIN 提升 USER 成功、角色标签与按钮正确、普通 ADMIN 不显示角色按钮、Popconfirm 与成功提示正常、OperationLog 落库正确）。
- **Git commit**：`feat: add admin user role management`

---

## Phase 17.3.3 — README 重写（GitHub 规范 + 使用教程）

- **状态**：已完成
- **改动内容**：重写根目录 `README.md`，从面向开发者的长文档改为符合 GitHub 规范的**产品 README**：
  - 顶部：项目名 + 徽章（TypeScript / NestJS / React / PostgreSQL / Prisma / Docker / pnpm）
  - 新增「使用教程」章节：以「老张生日局」为场景，逐步演示注册登录、创建酒局、邀请加入、扫码登记、选择已有酒品、查看排行、结束酒局、管理后台操作
  - 保留并精简：快速开始（后端/前端/手机局域网测试）、环境变量、常用脚本、项目结构、技术栈、API 文档、测试、Docker 生产部署、备份、Roadmap
  - 链接到 `docs/DEVELOPMENT_LOG.md`、`docs/UI_DESIGN_SYSTEM.md`、`PROJECT_SPEC.md`、`AGENT_INSTRUCTIONS.md`
- **API / 数据库变化**：无
- **后续修复**：
  - 快速开始勘误：原文档复制 `.env.example` 后直接 `pnpm prisma db seed`，但示例中 `SEED_ADMIN_PASSWORD` 为占位值 `change-me-before-use`，seed 会直接抛错；已在 README 中补充「将 SEED_ADMIN_PASSWORD 改为真实密码」步骤，并把克隆地址改为真实仓库 `https://github.com/Yanke00011/JIUJU.git`。
  - 首页新增 GitHub 仓库按钮：落地页导航增加「GitHub」链接按钮（登录页右侧），登录后的 App 头部增加 GitHub 图标按钮，均新开标签打开 `https://github.com/Yanke00011/JIUJU`。
- **Git commit**：`docs: rewrite readme with usage tutorial`（README 重写）；`fix: fix readme seed step and add github button`（本次勘误与按钮）

---

## Phase 17.3.1 — 我的酒局列表体验优化

- **状态**：已完成
- **新增功能**：
  1. **Tabs 结构**：「我的酒局」改为 `[进行中] [历史]` 两个 Tab（带数量角标），按房间状态前端分流，不再上下无限堆叠。
  2. **进行中 Tab**：卡片展示名称 + 状态标签 + 房主徽章 + 成员数量 + 创建时间 + 邀请码（带复制按钮）+ 主色「进入酒局」大按钮（突出）。
  3. **历史 Tab**：卡片展示名称 + 状态标签 + 房主徽章 + 参与人数 + 总饮酒杯数 + 结束时间 + 「查看详情」按钮（无登记入口）。
  4. **分页加载**：每页 8 个 + 「加载更多（已显示 X / Y）」按钮，加载完显示「已全部加载 · 共 N 个」；列表只渲染当前已加载部分，支持 100+ 房间不卡顿。
  5. **受限补充请求**：仅对当前可见页中尚未补充的房间，并行拉取成员数（历史页另加统计杯数），`Promise.allSettled` 失败自动跳过、按房间累积缓存，避免 N+1 拖垮列表。
  6. **三态齐备**：Loading（Skeleton 卡片）、Error（中文提示 + 重新加载）、Empty（EmptyState：进行中空态给「创建酒局」CTA，历史空态纯提示）。
  7. **预留**：搜索/时间/成员筛选入口未开发（按需求不过度开发），页面结构已为后续扩展留出空间。
- **API 变化**：无（前端纯展示优化）。
- **数据库变化**：无。
- **重要记录（未来后端优化建议）**：当前 `GET /api/v1/rooms` 一次性返回全部房间且不含成员数/统计；建议未来改造为「分页 + status 筛选 + memberCount + totalQuantity」的列表接口，减少前端分页与前端的 N+1 补充请求。
- **影响范围**：`apps/web/src/components/MyRooms.tsx`（新增）、`apps/web/src/pages/Home.tsx`、`apps/web/src/styles.css`
- **测试结果**：
  - 前端 `pnpm --filter @jiuju/web typecheck` ✅、`build` ✅；后端无改动（`git diff apps/api/` 为空）。
  - 浏览器实测（手机 390px）：创建 11 个进行中 + 3 个历史（含 1 个有饮酒记录）房间 → 进行中 Tab 正确分页（8 / 11 → 加载更多 → 11），历史 Tab 展示「1 人参与 / 共 1 杯」；Tab 切换正常；空状态（新用户 e2e_empty_user）进行中/历史均正确；卡片单列、按钮可点、复制邀请码正常、无 uncaught error。
  - 测试数据（14 个 e2e_ 房间 + e2e_empty_user）已全部清理，`pnpm cleanup:test-data` 复跑无残留。
- **Git commit**：`feat: improve my rooms list experience`

---

## Phase 17.3 — JIUJU V1.0 UI 全面优化（Design System 统一）

- **状态**：已完成
- **优化内容**（仅视觉/交互/响应式，未动任何核心逻辑）：
  1. **公共组件**（新增 `apps/web/src/components/common/`）：`PageHeader`（标题+副标题+操作）、`EmptyState`（友好空状态）、`StatCard`（数据统计卡，accent 强调色），统一各页面的标题区/空状态/统计块。
  2. **首页 Home**：落地页 Hero 增加价值徽章（朋友聚会 / 扫码即记 / 实时排行 / 防止逃酒），文案强化「防止逃酒」定位；「我的酒局」改用 PageHeader + EmptyState（加载/失败/空三态齐备），房间卡片加品类图标。
  3. **酒局详情 RoomDetail**：邀请码增加「复制」按钮（clipboard + 成功提示）；成员列表改为头像胶囊（成员徽章，房主金色头像）；排行榜中「我的排名」行高亮（`.me` 酒红浅底）；底部登记栏改为模糊毛玻璃样式。
  4. **登记饮酒 DrinkRecord**：确认酒品卡片增加「图片占位区」（品类 emoji + 分类标签）；数量输入大号化；提交按钮改为移动端底部固定操作栏（毛玻璃，`[重新选择][确认登记]`），桌面端居中限宽。扫码生命周期 / 登记流程未改动。
  5. **Admin Dashboard**：6 个统计卡改用 `StatCard`（图标 + 强调色 + hover 上浮），使用网格布局（桌面 3 列 / 平板 2 列 / 手机 1 列）；「最近操作日志」增加图标头像与中文动作标签。
  6. **AdminLogs**：新增「表格 / 时间线」视图切换（antd Timeline，DELETE 动作红色节点），时间线视图自带分页。
  7. **全局**：页面进入动画（`page-in`，尊重 `prefers-reduced-motion`）；卡片 hover 提升；统一圆角/阴影/间距继续走既有 CSS 变量与 Theme Token。
- **后续修复**：酒局详情页底部「登记饮酒」栏在迁移内联样式时遗漏 `position: fixed`，导致按钮不再固定于底部；已补回 fixed 定位/左右吸附/安全区 padding，并将栏内宽度与内容区（760px）对齐，与登记页底部操作栏保持一致。
- **影响范围**：`apps/web/src/components/common/`（3 个新增）、`apps/web/src/pages/Home.tsx`、`apps/web/src/pages/RoomDetail.tsx`、`apps/web/src/pages/DrinkRecord.tsx`、`apps/web/src/pages/admin/AdminDashboard.tsx`、`apps/web/src/pages/admin/AdminLogs.tsx`、`apps/web/src/styles.css`
- **API 变化**：无（`git diff apps/api/` 为空）
- **数据库变化**：无
- **测试结果**：
  - 前端 `pnpm --filter @jiuju/web typecheck` ✅、`build` ✅
  - 浏览器实测（StrictMode 开发环境，手机 390px + 桌面 1440px）：
    - 落地页徽章/文案正确；我的酒局空状态与卡片正常；
    - 房间详情：邀请码复制、成员胶囊、我的排行高亮、底部登记栏均正常；
    - 登记页：图片占位 + 底部固定提交栏，扫码/手动查询/选择登记全流程回归通过（DrinkRecord 正确落库）；
    - 后台：仪表盘统计卡网格、日志时间线视图切换正常；无 uncaught error。
  - 已知非阻塞警告：antd 静态 `message` API 的 theme context 提示（既有，非本次引入）。
  - 测试数据使用 `e2e_` 前缀已清理；`pnpm cleanup:test-data` 复跑无残留。
- **Git commit**：`feat: improve jiuju ui design system`

---

## Phase 17 — JIUJU V1.0 Release Candidate 优化（扫码登记体验 + 后台扫码录入 + UI 统一）

- **状态**：已完成
- **新增功能**：
  1. **登记饮酒双入口**（用户端 `DrinkRecord`）：页面顶部 `[扫码添加] [选择已有酒品]` Segmented 切换。
     - 扫码添加：保留原扫码生命周期（未改动 scanner 单实例 / scanLock / barcode 防重 / 摄像头释放）。
     - 选择已有酒品：新增商品搜索（名称/品牌/条码，300ms 防抖，复用商品列表接口），移动端优先的卡片列表 + `[选择]`；选择后进入与扫码一致的「确认酒品」登记流程。
     - 两种方式最终共用同一个 `POST /rooms/:id/drinks` 创建接口（单一登记逻辑）。
  2. **抽取公共扫码组件** `apps/web/src/components/BarcodeScanner.tsx`：将原 DrinkRecord 中的 html5-qrcode 生命周期（单实例 + initializingRef + scanLockRef + 3 秒防重 + stop/clear 幂等 + StrictMode 兼容 + 卸载释放）抽取为可复用组件，通过 `ref` 暴露 `start()/stop()`，供用户登记与后台商品录入共用。
  3. **后台商品扫码录入**（AdminProducts）：新增 `[扫码录入]` 按钮 → Modal 内复用 `BarcodeScanner`。扫码后先查库：已存在 → 展示商品信息并支持「查看商品」（跳转表格按条码过滤）；不存在 → 自动填入新增表单 barcode，管理员完善名称/品牌/分类/容量/酒精度后创建。权限继承 Admin 后台（ADMIN / SUPER_ADMIN，USER 禁止）。
  4. **UI 统一**：选择商品卡片沿用 JIUJU Design System（`--wine` 品牌色、`--wine-soft` 分类标签、`--radius-sm` 圆角、`--shadow` hover 提升）；移动端/桌面端均验证。
- **API 变化**：新增 `GET /api/v1/products?page=&pageSize=&keyword=`（登录用户可用，按 barcode/name/brand 关键词分页搜索；复用既有 `toProductDto` + `parsePagination` 模式，不重复造接口）。
- **数据库变化**：无（无 Prisma migration）。
- **影响范围**：`apps/api/src/products/products.controller.ts`、`apps/api/src/products/products.service.ts`、`apps/web/src/components/BarcodeScanner.tsx`（新增）、`apps/web/src/pages/DrinkRecord.tsx`、`apps/web/src/pages/admin/AdminProducts.tsx`、`apps/web/src/services/products.ts`、`apps/web/src/types/api.ts`、`apps/web/src/styles.css`
- **Git commit**：`feat: optimize drink registration and admin product scanner`
- **测试结果**：
  - 后端 `pnpm --filter @jiuju/api typecheck` ✅、`lint` ✅、unit 145 ✅、e2e 120 ✅（含新增 GET /products 未破坏既有 products e2e 14 条）
  - 前端 `pnpm --filter @jiuju/web typecheck` ✅、`build` ✅
  - 浏览器实测（移动 430px + 桌面 1440px，StrictMode 开发环境）：
    - 选择已有酒品：搜索「啤酒/白酒」命中商品卡片 → 选择 → 数量 2 → 确认登记 → DrinkRecord 正确落库（qty=2、商品快照 500ml/4.5% 正确）；
    - 扫码模式手动条码查询、识别反馈 overlay、重新选择/继续登记流程正常；
    - 后台「扫码录入」Modal 打开/关闭正常、摄像头随关闭释放、无 uncaught error；
    - 摄像头实拍扫码（需真机）留待上线前人工复核。
  - 测试数据使用 `e2e_` 前缀，已全部清理；`pnpm cleanup:test-data` 复跑确认无残留。

---

## Phase 16.2 — 扫码引擎重构（生命周期修复）

- **状态**：已完成
- **Bug 原因**：
  1. **扫码重复请求商品接口（429）**：html5-qrcode 以 10fps 持续解码，条码停留在镜头前时 `onScanSuccess` 每帧触发；原回调没有任何锁，每帧都调用 `productQuery.mutate(code)` → 一次扫码发起多个 `GET /products/barcode/*` → 命中 Throttler（100 次/60s）。`stopScanner` 只在查询 `onSuccess` 后才执行，且请求已在途，无法取消。
  2. **出现两个摄像头画面**：React 18 StrictMode（`main.tsx`）开发模式下 effect「挂载→卸载→再挂载」。原代码 `scannerRef.current = qr` 在 `await qr.start()` **之后**才赋值，卸载清理时 `scannerRef` 还是 `null` → cleanup 空转；第二次挂载再次 `new Html5Qrcode()` → 两个实例挂在同一 `#drink-scanner` 容器 → 两个 `<video>`、两个 getUserMedia 流、两个解码回调。
  3. **stop() 同步抛错**：html5-qrcode 2.x 的 `stop()` 在未启动时**同步 throw**（非 Promise reject），原 `scanner.stop().catch(...)` 无法捕获 → 卸载时产生 uncaught error。
- **修复方案**：
  1. **单实例 + 同步注册**：`scannerRef.current = qr` 在 `new Html5Qrcode()` 创建后**立即**赋值（先于 `start()`），配合 `initializingRef` 防止 StrictMode 重复初始化；`startScanner` 首行守卫 `scannerRef.current || initializingRef.current` 直接返回。
  2. **扫码锁**：`scanLockRef`（useRef 非 useState）在第一次成功解码时置 true，后续回调直接 return；流程为「加锁 → 停摄像头（destroyScanner）→ 只请求一次商品接口」，禁止先请求再 stop。
  3. **Barcode 防重**：`lastBarcodeRef` + `lastScanTimeRef`，同一 barcode 3 秒内禁止重复查询（扫码回调与手动输入共用）。
  4. **统一销毁 `destroyScanner()`**：stop + clear + `scannerRef=null` + `initializingRef=false` + `scanLockRef=false`，`stop()` 用 try/catch 包裹（兼容同步抛错），幂等可重复调用；组件卸载 cleanup 调用它，离开页面即释放摄像头。
  5. **异步续调用令牌校验**：`start()`/`getCameras()` 等 await 之后校验 `scannerRef.current !== qr`，若已被销毁/替换则立即 stop+clear 并放弃，避免竞态残留 video/stream。
  6. **状态解耦**：扫码状态（starting/scanning/querying/success/not-found/network-error/camera-denied）不再依赖 `scanning` 布尔值，摄像头停止后仍能展示「识别成功/未找到/网络异常」；新增 idle 态「打开摄像头扫码」按钮；查询失败后复位扫码锁并自动重启摄像头继续扫描。
- **影响范围**：`apps/web/src/pages/DrinkRecord.tsx`
- **API / 数据库变化**：无（未改后端、未改数据库、未放宽 Throttler、保留 StrictMode）
- **Git commit**：`fix: refactor scanner lifecycle and prevent duplicate barcode requests`
- **测试结果**：`pnpm typecheck` ✅、`pnpm build` ✅、`pnpm --filter @jiuju/web typecheck/build` ✅；浏览器实测（开发环境 StrictMode）：
  - 进入扫码页无 uncaught error（原 `Cannot stop, scanner is not running` 已消除）；
  - 摄像头权限拒绝场景正确显示中文错误（权限不足），可进入 idle 并重试；
  - 手动条码查询正常；同一 barcode 3 秒内重复查询被拦截（仅 1 次请求），不同 barcode 正常放行；
  - 进出页面多次不叠加实例、无残留报错；
  - 摄像头实拍/双摄像头验证与 iPhone Safari / Android Chrome 真机测试待上线前人工复核（本环境无摄像头）。

---

## Phase 16 Bug Fix — 扫码登记流程修复 + 测试数据清理

- **状态**：已完成
- **Bug 原因**：
  1. **手动输入条码查询无响应**：`DrinkRecord` 页用 `InputNumber` 输入条码，但其 `onChange` 返回 `number`，组件却按 `string` 存入 `barcode` 状态；点击查询时 `barcode.trim()` 对 number 调用抛异常，被表单静默吞掉 → 无任何反馈（无 loading、无结果、无报错）。
  2. **扫码框黑屏**：`scanner-frame` 在摄像头初始化前是 `display:none`，html5-qrcode 在容器隐藏/无尺寸时启动 → video 无画面；且未自动请求摄像头、缺少启动/停止/清理的生命周期管理与错误细分。
  3. **测试数据污染**：admin e2e 的超级管理员用户名 `e2e_superadmin_*` 前缀不匹配清理用的 `e2e_admin*`，导致每次 e2e 运行残留一个用户；且缺少统一的测试数据清理脚本。
- **修复方案**：
  1. 手动条码改用 `Input`（字符串）+ `inputMode="numeric"`，校验通过后查询；新增 `queryState`（idle/loading/success/not-found/network-error）明确展示「查询中 Loading / 未找到该商品，请检查条码 / 网络连接失败」。
  2. 扫码改为进入页面自动请求后置摄像头（`Html5Qrcode.getCameras()` 优先后置，回退 `facingMode: environment`）；`scanner-frame` 始终可见，初始化前显示「正在启动摄像头...」占位；用 `scannerRef` 管理实例，`start/stop/clear` 幂等化，卸载时释放；错误映射为明确原因（权限被拒 / HTTPS 限制 / 浏览器不支持 / 摄像头不可用）。
  3. 新增 `scripts/cleanup-test-data.ts`（`pnpm cleanup:test-data`）：按用户名前缀（test_/e2e_/live_/webflow_/web_/p15/p151/prod_）清理测试用户及其房间、成员、饮酒记录、操作日志，并按条码 `999999` / 测试商品名清理测试商品；显式保护 `admin`/`testuser` 种子账号与真实数据。同时修复 admin e2e 超级管理员前缀，使 `e2e_admin*` 清理覆盖全部测试用户。
- **影响范围**：`apps/web/src/pages/DrinkRecord.tsx`、`apps/web/src/styles.css`、`apps/api/test/admin.e2e-spec.ts`、新增 `scripts/cleanup-test-data.ts`、`package.json`（新增 `cleanup:test-data` 脚本）
- **API / 数据库变化**：无（仅前端修复 + 测试清理脚本）
- **Git commit**：`fix: repair drink scanning workflow and cleanup test data`
- **测试结果**：后端 typecheck/lint ✅，145 unit / 120 e2e ✅（e2e 连跑 2 次稳定，且跑完后无测试数据残留），build ✅；前端 typecheck/build ✅；清理脚本实测可删除测试数据且保留 admin/testuser 与真实用户。

---

## Phase 16 — Admin 数据分析增强 + 扫码体验升级 + UI 设计规范（已完成）

- **状态**：已完成
- **新增功能**：
  - Admin Dashboard 数据修复：移除前端 mock 统计，全部数据实时来自数据库（`GET /admin/dashboard` + `GET /admin/analytics`）
  - Admin 运营分析：酒局趋势、饮酒趋势（每日聚合）、热门酒品 Top10（按饮用数量）、用户饮酒排行（按酒精摄入量）、活跃酒局列表
  - 商品批量管理：表格多选 + 批量删除（逐个检查 DrinkRecord 引用，未引用删除、被引用返回 `PRODUCT_IN_USE`），返回成功/失败数量与失败列表，前端展示详细结果
  - 扫码页升级：全屏扫码视窗、圆角扫描框 + 四角装饰、半透明遮罩、酒红/金色扫描线 + 光晕动画、扫码中/识别成功/未找到商品/摄像头权限状态提示、商品确认卡片弹入动画
  - UI Design System：新增 `docs/UI_DESIGN_SYSTEM.md`（颜色/字体/按钮/卡片/间距/动画/响应式/公共组件/主题 Token 规范）
- **数据库变化**：无
- **API 变化**：
  - `GET /api/v1/admin/analytics?days=`（运营分析）
  - `POST /api/v1/admin/products/batch-delete`（批量删除，SUPER_ADMIN）
- **权限**：批量删除仅 SUPER_ADMIN（`SuperAdminGuard`）；分析接口 ADMIN / SUPER_ADMIN；写入 `OperationLog`（`PRODUCT_BATCH_DELETE`）
- **Git commit**：`feat: enhance admin analytics and scanner experience`
- **测试结果**：后端 typecheck/lint ✅，145 unit / 120 e2e ✅（e2e 连跑 3 次稳定），build ✅，prisma validate ✅；前端 typecheck/build ✅
- **重要设计说明**：Analytics 与批量删除均在后端完成聚合与引用检查，避免大量数据传到前端计算（禁止前端 mock 统计）。

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
