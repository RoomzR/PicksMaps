#!/bin/bash
# Деплой PicksMaps на VPS (1cloud.ru, cloudvps.by и любой Ubuntu)
set -e

APP_DIR="${APP_DIR:-$HOME/PicksMaps}"
PORT="${PORT:-3000}"
DOMAIN="${DOMAIN:-}"

echo "=== PicksMaps VPS Deploy ==="

# Node.js 20
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 18 ]]; then
  echo "Устанавливаю Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs build-essential
fi

# Зависимости для better-sqlite3
sudo apt-get install -y python3 make g++ git 2>/dev/null || true

# Клонирование / обновление
if [ -d "$APP_DIR/.git" ]; then
  echo "Обновляю репозиторий..."
  cd "$APP_DIR" && git pull
else
  if [ -z "$REPO_URL" ]; then
    echo "Укажите REPO_URL или скопируйте проект в $APP_DIR"
    echo "Пример: REPO_URL=https://github.com/user/PicksMaps.git ./deploy-vps.sh"
    exit 1
  fi
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "Заполните .env:"
  nano .env
fi

source .env 2>/dev/null || true

npm install
npm run build

# PM2
if ! command -v pm2 &>/dev/null; then
  sudo npm install -g pm2
fi

pm2 delete picksmaps 2>/dev/null || true
pm2 start npm --name picksmaps -- start
pm2 save
pm2 startup | tail -1 | sudo bash 2>/dev/null || true

# Nginx + HTTPS (если указан домен)
if [ -n "$DOMAIN" ]; then
  sudo apt-get install -y nginx certbot python3-certbot-nginx 2>/dev/null || true

  sudo tee /etc/nginx/sites-available/picksmaps >/dev/null <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX

  sudo ln -sf /etc/nginx/sites-available/picksmaps /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@$DOMAIN || \
    echo "Certbot: укажите email вручную: sudo certbot --nginx -d $DOMAIN"

  # Обновить WEBAPP_URL
  sed -i "s|^WEBAPP_URL=.*|WEBAPP_URL=https://$DOMAIN|" .env
  pm2 restart picksmaps
fi

echo ""
echo "============================================"
echo "  PicksMaps запущен!"
echo "  pm2 status"
echo "  pm2 logs picksmaps"
if [ -n "$DOMAIN" ]; then
  echo "  URL: https://$DOMAIN"
else
  echo "  URL: http://$(curl -s ifconfig.me 2>/dev/null || echo 'IP'):$PORT"
  echo "  Для HTTPS: DOMAIN=ваш-домен.ru ./deploy-vps.sh"
fi
echo "============================================"
