# JIUJU 数据库备份与恢复

本文档说明 JIUJU（PostgreSQL）的备份与恢复流程。**建议每日备份并保留至少 7 天**，并在每次上线/更新前手动备份一次。

## 一、备份

### 方式 1：一键脚本（推荐）

仓库内已提供 `scripts/backup.sh`（依赖 Docker，自动检测 `jiuju-prod-postgres` 或 `jiuju-postgres` 容器）：

```bash
chmod +x scripts/backup.sh
./scripts/backup.sh                 # 备份到 ./backups，保留 7 天
./scripts/backup.sh /data/backups   # 指定备份目录
```

产出文件：`backups/backup_<时间戳>.sql.gz`（gzip 压缩的 pg_dump 全量备份，`--no-owner` 便于迁移）。

环境变量（可选）：

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `POSTGRES_CONTAINER` | postgres 容器名 | `jiuju-prod-postgres` |
| `POSTGRES_USER` | 数据库用户 | `jiuju` |
| `POSTGRES_DB` | 数据库名 | `jiuju` |
| `BACKUP_KEEP_DAYS` | 保留天数 | `7` |

### 方式 2：手动 pg_dump

```bash
docker exec jiuju-prod-postgres pg_dump -U jiuju -d jiuju --no-owner | gzip > backup_$(date +%Y%m%d).sql.gz
```

> 建议通过 cron 每天执行：`0 3 * * * /path/to/jiuju/scripts/backup.sh /data/backups`

## 二、恢复

### 场景：恢复到同一部署实例

```bash
# 1. 停止 api（避免写库）
docker compose -f docker-compose.prod.yml stop api

# 2. 恢复（gzip 解压后灌入 postgres 容器）
gunzip -c /data/backups/backup_<时间戳>.sql.gz | docker exec -i jiuju-prod-postgres psql -U jiuju -d jiuju

# 3. 重启 api
docker compose -f docker-compose.prod.yml start api
```

### 场景：全新实例恢复

```bash
# 1. 先启动 postgres 并等待健康
docker compose -f docker-compose.prod.yml up -d postgres

# 2. 恢复数据（此时表为空）
gunzip -c /data/backups/backup_<时间戳>.sql.gz | docker exec -i jiuju-prod-postgres psql -U jiuju -d jiuju

# 3. 启动 api 与 web（api 启动时会执行 migrate deploy，幂等）
docker compose -f docker-compose.prod.yml up -d
```

> 注意：`pg_dump` 全量备份包含 schema 与数据。恢复后若 schema 有新增迁移，`migrate deploy` 只会补齐差异，不会破坏既有数据。

## 三、备份一致性建议

- 备份为 `--no-owner`，跨机器恢复不会因用户/角色不同而失败。
- 恢复前建议先对备份文件做 `gunzip -t <file>.sql.gz` 校验完整性。
- 定期（至少每月）演练一次恢复流程，确认备份可用。
- 不要把备份文件放在容器数据卷内；建议挂载到宿主机独立目录或对象存储。
