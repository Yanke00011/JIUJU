#!/usr/bin/env bash
#
# 酒局管家 JIUJU - PostgreSQL 备份脚本
# 用法：
#   ./scripts/backup.sh                      # 备份到 ./backups（保留 7 天）
#   ./scripts/backup.sh /path/to/backup/dir  # 指定备份目录
#
# 依赖：docker（compose 内的 postgres 容器）或本机 psql。
# 备份文件：backup_<timestamp>.sql.gz
#
set -euo pipefail

# 默认备份目录与保留天数
BACKUP_DIR="${1:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"

# 容器名：优先生产 compose 的 jiuju-prod-postgres，否则开发 jiuju-postgres
CONTAINER="${POSTGRES_CONTAINER:-jiuju-prod-postgres}"
POSTGRES_USER="${POSTGRES_USER:-jiuju}"
POSTGRES_DB="${POSTGRES_DB:-jiuju}"

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/backup_${TS}.sql.gz"

# 自动检测容器：优先生产 jiuju-prod-postgres，否则开发 jiuju-postgres
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  if docker ps --format '{{.Names}}' | grep -qx "jiuju-postgres"; then
    CONTAINER="jiuju-postgres"
  fi
fi

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "→ 使用容器 $CONTAINER 备份..."
  docker exec "$CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner | gzip > "$FILE"
else
  echo "→ 未找到生产/开发容器，尝试本机 pg_dump..."
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner 2>/dev/null | gzip > "$FILE" \
    || { echo "✗ 备份失败：未找到容器或本机 pg_dump 不可用"; exit 1; }
fi

echo "✔ 备份完成：$FILE ($(du -h "$FILE" | cut -f1))"

# 清理超过保留天数的旧备份
find "$BACKUP_DIR" -name 'backup_*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "→ 已清理 $KEEP_DAYS 天前的旧备份"
