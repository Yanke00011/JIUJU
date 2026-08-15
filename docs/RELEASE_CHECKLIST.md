# JIUJU V1.0 上线检查清单

上线前、部署、测试、回滚全流程核对表。全部勾选后才可发布。

## 一、上线前准备

- [ ] 修改生产环境变量 `apps/.env.production`（禁止使用示例占位值）
- [ ] 修改 PostgreSQL 数据库密码（`POSTGRES_PASSWORD`，强随机）
- [ ] 设置强随机 `JWT_SECRET`（至少 32 字符，禁止复用开发值）
- [ ] 配置域名 DNS 解析到服务器
- [ ] 配置 HTTPS（外部反向代理：Lucky / Nginx / Caddy + SSL 证书）
- [ ] `CORS_ORIGINS` 填入前端域名（禁止 `*`）
- [ ] `SWAGGER_ENABLED=false`
- [ ] 数据库备份（`./scripts/backup.sh`）确认可执行
- [ ] 数据库备份文件异地存放

## 二、部署

- [ ] `docker compose -f docker-compose.prod.yml config` 校验通过
- [ ] `docker compose -f docker-compose.prod.yml up -d --build`
- [ ] postgres 容器 healthy
- [ ] api 启动时 `prisma migrate deploy` 执行成功（无报错）
- [ ] web 容器正常运行（nginx 托管静态资源）

## 三、测试（上线环境实测）

- [ ] 注册新用户成功
- [ ] 登录成功
- [ ] 创建酒局成功
- [ ] 邀请码加入成功
- [ ] 扫码登记（HTTPS 环境下摄像头可用，一次扫码仅一次 `/products/barcode` 请求）
- [ ] 手动条码 / 选择已有酒品登记
- [ ] 结束酒局 → ENDING 倒计时 → 撤销 → 再次结束
- [ ] 15 分钟后自动归档 ENDED（历史可见）
- [ ] 酒局统计 / 排行正确
- [ ] 管理后台登录（SUPER_ADMIN）与各模块可访问

## 四、安全核对

- [ ] 未登录访问 `/api/*` 返回 401
- [ ] 普通用户访问 `/admin` 被拦截（403/跳转）
- [ ] 非房主不能结束/撤销房间
- [ ] 非成员不能查看房间详情/统计
- [ ] 生产环境 Swagger 关闭（`/api/docs` 404）

## 五、回滚预案

- [ ] 已记录当前镜像版本（`docker images` / commit hash）
- [ ] 已执行一次全量数据库备份
- [ ] 回滚步骤已在 `docs/DEPLOYMENT.md` 记录（git checkout + rebuild / 恢复备份）

## 六、发布后观察（24h）

- [ ] 无 500 错误堆叠（`docker logs -f api`）
- [ ] 无 429 扫码限流误报
- [ ] 数据库备份 cron 正常运行一次
