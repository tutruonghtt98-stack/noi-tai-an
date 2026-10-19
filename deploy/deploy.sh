#!/usr/bin/env bash
# Chạy trên VPS mỗi lần deploy (GitHub Actions gọi qua SSH, hoặc chạy tay).
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="${DEPLOY_BRANCH:-main}"
echo "▶ Cập nhật mã nguồn ($BRANCH)…"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "▶ Cài dependencies…"
npm ci --no-audit --no-fund

echo "▶ Migrate database…"
npx prisma migrate deploy

echo "▶ Build…"
npm run build

echo "▶ Khởi động lại PM2…"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "▶ Kiểm tra sức khoẻ…"
for i in {1..20}; do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
    echo "✔ Deploy thành công"
    exit 0
  fi
  sleep 2
done
echo "✖ Ứng dụng không phản hồi /api/health — xem: pm2 logs noi-tai-an" >&2
exit 1
