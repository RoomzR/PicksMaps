#!/bin/bash
# Запуск с вашего Mac — деплой на 1cloud VPS одной командой
# Использование: ./deploy-to-server.sh root@123.45.67.89
set -e

SERVER="${1:?Укажите сервер: ./deploy-to-server.sh root@IP}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Деплой PicksMaps на $SERVER ==="

# Копируем проект на сервер
echo "Копирую файлы..."
ssh "$SERVER" "mkdir -p ~/PicksMaps"
rsync -avz --progress \
  --exclude node_modules \
  --exclude dist \
  --exclude data \
  --exclude .git \
  "$SCRIPT_DIR/" "$SERVER:~/PicksMaps/"

# Копируем .env
if [ -f "$SCRIPT_DIR/.env" ]; then
  scp "$SCRIPT_DIR/.env" "$SERVER:~/PicksMaps/.env"
fi

# Запускаем деплой на сервере
echo "Устанавливаю на сервере..."
ssh -t "$SERVER" "cd ~/PicksMaps && chmod +x deploy-vps.sh && ./deploy-vps.sh"

echo ""
echo "Готово! Проверьте: ssh $SERVER 'pm2 logs picksmaps --lines 20'"
