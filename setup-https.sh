#!/bin/bash
# Быстрая настройка DuckDNS + HTTPS для Mini App
# Использование: DOMAIN=mypicks.duckdns.org DUCK_TOKEN=xxx ./setup-https.sh
set -e

DOMAIN="${DOMAIN:?Укажите DOMAIN=mypicks.duckdns.org}"
DUCK_TOKEN="${DUCK_TOKEN:-}"
APP_DIR="${APP_DIR:-$HOME/PicksMaps}"
PORT="${PORT:-3000}"

if [ -n "$DUCK_TOKEN" ]; then
  echo "url=\"https://www.duckdns.org/update?domains=${DOMAIN%%.*}&token=$DUCK_TOKEN&ip=\""
  mkdir -p ~/duckdns
  echo "url=\"https://www.duckdns.org/update?domains=${DOMAIN%%.*}&token=$DUCK_TOKEN&ip=\""> ~/duckdns/duck.sh
  chmod +x ~/duckdns/duck.sh
  (crontab -l 2>/dev/null; echo "*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1") | crontab -
  ~/duckdns/duck.sh
fi

sudo apt-get install -y nginx certbot python3-certbot-nginx

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
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "Получаю SSL-сертификат..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
  sudo certbot --nginx -d "$DOMAIN"

sed -i "s|^WEBAPP_URL=.*|WEBAPP_URL=https://$DOMAIN|" "$APP_DIR/.env"
cd "$APP_DIR" && pm2 restart picksmaps

echo ""
echo "HTTPS готов: https://$DOMAIN"
echo "Обновите WEBAPP_URL в .env если нужно"
