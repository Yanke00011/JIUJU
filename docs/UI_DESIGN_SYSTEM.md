# 酒局管家（JIUJU）UI 设计规范

本文档定义 JIUJU 前后端的统一视觉语言。从 Phase 16 起，**所有前端页面必须遵循本规范**，保证品牌一致性。

> 原则：新页面禁止重新设计一套样式；禁止随意增加颜色；统一圆角、按钮、字体、间距。所有颜色统一走 Theme Token，禁止散落硬编码。

---

## 一、颜色规范

### 品牌色（Theme Token）

| Token | 值 | 用途 |
| --- | --- | --- |
| `colorPrimary` | `#8B1E3F`（酒红） | 主按钮、链接、强调 |
| `colorInfo` | `#8B1E3F` | 信息提示 |
| `colorSuccess` | `#4d9b72` | 成功 |
| `colorWarning` | `#e6a23c`（金色） | 警告、扫描线、排行冠军 |
| `--wine-dark` | `#5e1027` | 渐变深色 |
| `--wine-soft` | `#f9edf1` | 浅色背景/底纹 |
| `--ink` | `#21171a` | 主文字 |
| `--muted` | `#786b70` | 次级文字 |
| `--surface` | `#ffffff` | 卡片/内容背景 |
| `--canvas` | `#f8f5f4` | 页面背景 |
| `--line` | `#eee5e7` | 分割线/边框 |

### 语义色

- 成功：`#4d9b72`；警告：`#e6a23c`；错误：Ant Design `colorError`；信息：酒红 `#8B1E3F`。

---

## 二、字体规范

- 字体族：`Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`（通过 `ConfigProvider` 的 `fontFamily` Token 设置）。
- 标题层级：页面级 `Typography.Title`（level 2 用于页面标题，level 4 用于卡片/区块标题）。
- 正文：14px；次级说明：12-13px `--muted`。
- 品牌名：`brand-lockup` 组合（图标 + 名称 + 英文小字）。

---

## 三、按钮规范

- 圆角统一 `10px`（`--radius-sm`），`font-weight: 600`。
- 主操作：`Button type="primary"`（酒红底，带 `box-shadow` 投影）。
- 次要操作：默认 `Button`。
- 危险操作：`danger`。
- 移动端大按钮：`controlHeightLG: 46`，全宽 `block`。
- 主按钮投影：`.ant-btn-primary { box-shadow: 0 8px 18px rgba(139,30,63,.18); }`。

---

## 四、卡片规范

- 卡片圆角：`Card borderRadiusLG: 20`（`--radius`）。
- 卡片边框：`--line`；投影：`--shadow`（hover 提升为 `--shadow-lg`）。
- 特殊场景：
  - `room-hero`：酒红渐变背景卡片（房间详情头部）。
  - `product-confirm`：浅金色渐变（扫码确认酒品）。
  - `stat-tile`：酒红浅底统计块。
  - `leaderboard`：排名卡片（金色头部渐变）。

---

## 五、间距规范

- 页面内容左右安全边距：`16px`（移动）/ `max(16px, 4vw)`；内容最大宽度 `760px`（用户端）/ 全宽（后台）。
- 区块间距：`12px`（Row gutter）或 `20px`（page-heading margin）。
- 卡片内边距：`18-22px`。
- 圆角：小 `12px`（`--radius-sm`）、常规 `20px`（`--radius`）、大 `28px`（`--radius-lg`）。

---

## 六、动画规范

- 统一 `ease-in-out` / `cubic-bezier` 过渡，时长 `0.2s-0.4s`。
- 扫描线：`scanline-move`（2.4s 上下循环 + 金色光晕）。
- 商品确认卡片：`card-pop`（0.38s 弹入）。
- 排行榜冠军：`crown-glow`（呼吸发光）。
- 表单错误：`field-shake`（抖动）。
- 禁止引入大型动画库；优先 CSS 动画。

---

## 七、响应式规范

| 断点 | 宽度 | 说明 |
| --- | --- | --- |
| 手机 | 375px / 390px / 414px | 单列、全宽按钮、底部安全区适配 |
| 平板 | 768px | 两列卡片 |
| 桌面 | 1200px+ | 多列、侧边栏布局 |

- 移动端：卡片单列，`.app-content` 加安全区 padding；头部隐藏次要文字。
- 桌面端：`landing-hero` / 内容居中限宽。
- 后台：`Layout.Sider` 断点折叠（`lg`），移动端抽屉菜单。
- 每个新增页面必须同时测试移动端与桌面端。

---

## 八、公共组件与主题

- 优先复用 Ant Design 组件：Button / Card / Modal / Drawer / Table / Form / Empty / Loading（Spin/Skeleton）。
- 新增公共组件放入 `components/common/`，禁止多个页面重复实现类似组件。
- 颜色一律使用 CSS 变量（`:root` 中 `--wine` 等）或 `ConfigProvider` Theme Token；禁止散落硬编码颜色。
- 修改主题只改两处：
  1. `apps/web/src/main.tsx` 的 `ConfigProvider theme` Token；
  2. `apps/web/src/styles.css` 的 `:root` CSS 变量。

---

## 九、当前应用页面清单

用户端：首页（产品落地页/我的酒局）、登录/注册、创建酒局、加入酒局、酒局详情、登记饮酒（扫码）。
后台：仪表盘、用户管理、房间管理、商品管理、饮酒记录、操作日志。

所有页面均按本规范实现；后续新增功能必须继承当前 JIUJU UI 风格。
