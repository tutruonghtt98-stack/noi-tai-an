#!/usr/bin/env bash
# Cài đặt lần đầu trên VPS Hostinger (Ubuntu 22.04/24.04). Chạy với quyền root:
#   DOMAIN=ten-mien.vn EMAIL=ban@email.com REPO=git@github.com:user/noi-tai-an.git bash setup-vps.sh
set -euo pipefail
: "${DOMAIN:?Thiếu DOMAIN}" "${EMAIL:?Thiếu EMAIL}" "${REPO:?Thiếu REPO}"
APP_USER=deploy
APP_DIR=/var/www/noi-tai-an

echo "▶ Gói hệ thống"
apt-get update -y
apt-get install -y curl git nginx ufw certbot python3-certbot-nginx

echo "▶ Node.js 22 LTS + PM2"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "▶ Người dùng deploy"
id -u "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
mkdir -p "$APP_DIR" && chown "$APP_USER:$APP_USER" "$APP_DIR"

echo "▶ Firewall"
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable

echo "▶ Nginx"
sed "s/__DOMAIN__/$DOMAIN/g" "$(dirname "$0")/nginx.conf" > /etc/nginx/sites-available/noi-tai-an
ln -sf /etc/nginx/sites-available/noi-tai-an /etc/nginx/sites-enabled/noi-tai-an
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "▶ SSL Let's Encrypt"
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect

echo "▶ PM2 khởi động cùng hệ thống"
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER"

cat <<MSG

✔ Xong phần hệ thống. Bước tiếp theo (đăng nhập bằng user $APP_USER):
  sudo -iu $APP_USER
  git clone $REPO $APP_DIR && cd $APP_DIR
  cp .env.example .env && nano .env
     DATABASE_URL="..."   # Supabase — Connection pooling (cổng 6543)
     DIRECT_URL="..."     # Supabase — Direct connection (cổng 5432)
     AUTH_URL="https://$DOMAIN"
  bash deploy/deploy.sh
MSG
