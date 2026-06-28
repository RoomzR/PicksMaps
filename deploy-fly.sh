#!/bin/bash
set -e
cd "$(dirname "$0")"

FLY="${FLYCTL_INSTALL:-$HOME/.fly}/bin/fly"
export PATH="$(dirname "$FLY"):$PATH"

if ! command -v fly &>/dev/null; then
  echo "Устанавливаю Fly CLI..."
  curl -L https://fly.io/install.sh | sh
  export PATH="$HOME/.fly/bin:$PATH"
fi

if ! fly auth whoami &>/dev/null; then
  echo "Войдите в Fly.io (откроется браузер):"
  fly auth login
fi

[ -f .env ] || { echo "Создайте .env"; exit 1; }
source .env

APP_NAME="picksmaps-bot"
DEPLOY_URL="https://${APP_NAME}.fly.dev"

echo "App: $APP_NAME"
echo "URL: $DEPLOY_URL"

if ! fly apps list 2>/dev/null | grep -q "$APP_NAME"; then
  fly apps create "$APP_NAME" 2>/dev/null || true
fi

fly secrets set \
  BOT_TOKEN="$BOT_TOKEN" \
  BOT_USERNAME="$BOT_USERNAME" \
  ADMIN_IDS="$ADMIN_IDS" \
  WEBAPP_URL="$DEPLOY_URL" \
  -a "$APP_NAME"

echo "Деплой (может занять 3-5 мин)..."
fly deploy -a "$APP_NAME" --ha=false

echo ""
echo "============================================"
echo "  Готово: $DEPLOY_URL"
echo "  Бот: @$BOT_USERNAME → /app"
echo "============================================"
