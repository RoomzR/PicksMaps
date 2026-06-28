#!/bin/bash
# Полный деплой PicksMaps на Amvera.ru
# Использование:
#   AMVERA_USER=email AMVERA_PASSWORD=pass ./deploy-amvera.sh
# или положите AMVERA_USER / AMVERA_PASSWORD в .env.local
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

AMVERA_CLI="${AMVERA_CLI:-$SCRIPT_DIR/.tools/amvera}"
PROJECT_SLUG="${AMVERA_PROJECT:-picksmaps}"
GIT_BRANCH="${AMVERA_BRANCH:-master}"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if [[ ! -x "$AMVERA_CLI" ]]; then
  echo "Скачиваю Amvera CLI..."
  mkdir -p "$SCRIPT_DIR/.tools"
  ARCH="$(uname -m)"
  if [[ "$ARCH" == "arm64" ]]; then
    ZIP="amvera-macos-arm.zip"
  else
    ZIP="amvera-macos-x64.zip"
  fi
  curl -sL -o "$SCRIPT_DIR/.tools/$ZIP" \
    "https://github.com/amvera-cloud/cli/releases/download/v1.2.2/$ZIP"
  unzip -o "$SCRIPT_DIR/.tools/$ZIP" -d "$SCRIPT_DIR/.tools"
  chmod +x "$AMVERA_CLI"
fi

if [[ -z "${AMVERA_USER:-}" || -z "${AMVERA_PASSWORD:-}" ]]; then
  echo "Ошибка: задайте AMVERA_USER и AMVERA_PASSWORD"
  echo "Пример: AMVERA_USER=you@mail.com AMVERA_PASSWORD=secret ./deploy-amvera.sh"
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Ошибка: нет файла .env (BOT_TOKEN и др.)"
  exit 1
fi

# shellcheck disable=SC1091
source .env

echo "=== 1/6 Вход в Amvera ==="
"$AMVERA_CLI" login -u "$AMVERA_USER" -p "$AMVERA_PASSWORD"

echo "=== 2/6 Создание проекта (если ещё нет) ==="
if ! "$AMVERA_CLI" get project 2>/dev/null | grep -q "$PROJECT_SLUG"; then
  "$AMVERA_CLI" create project -s "$PROJECT_SLUG" || true
fi

AMVERA_GIT_URL="https://git.amvera.ru/${AMVERA_USER}/${PROJECT_SLUG}"
echo "Git remote: $AMVERA_GIT_URL"

echo "=== 3/6 Переменные окружения ==="
# Домен Amvera: picksmaps.amvera.app или slug из панели
APP_DOMAIN="$("$AMVERA_CLI" get domain -s "$PROJECT_SLUG" 2>/dev/null | head -1 || true)"
if [[ -z "$APP_DOMAIN" ]]; then
  WEBAPP_URL="${WEBAPP_URL:-https://${PROJECT_SLUG}.amvera.app}"
else
  WEBAPP_URL="https://${APP_DOMAIN}"
fi
echo "WEBAPP_URL → $WEBAPP_URL"

set_env() {
  local key="$1"
  local val="$2"
  "$AMVERA_CLI" env delete -s "$PROJECT_SLUG" -k "$key" 2>/dev/null || true
  "$AMVERA_CLI" env add -s "$PROJECT_SLUG" -k "$key" -v "$val"
}

set_env BOT_TOKEN "${BOT_TOKEN:?BOT_TOKEN не задан в .env}"
set_env BOT_USERNAME "${BOT_USERNAME:-picksmapsmeta_bot}"
set_env ADMIN_IDS "${ADMIN_IDS:-}"
set_env WEBAPP_URL "$WEBAPP_URL"
set_env PORT "3000"
set_env DATA_DIR "/data"

echo "=== 4/6 Коммит и push ==="
git add amvera.yaml deploy-amvera.sh src/server/db.ts DEPLOY.md .gitignore 2>/dev/null || true
git diff --cached --quiet || git commit -m "Add Amvera deploy config and script."

if git remote get-url amvera &>/dev/null; then
  git remote set-url amvera "$AMVERA_GIT_URL"
else
  git remote add amvera "$AMVERA_GIT_URL"
fi

# Amvera по умолчанию ждёт ветку master
git push amvera "HEAD:${GIT_BRANCH}"

echo "=== 5/6 Ожидание сборки ==="
sleep 15
"$AMVERA_CLI" logs build -s "$PROJECT_SLUG" 2>/dev/null | tail -20 || true

echo "=== 6/6 Синхронизация Telegram menu ==="
curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d "{\"menu_button\":{\"type\":\"web_app\",\"text\":\"🎮 PicksMaps\",\"web_app\":{\"url\":\"${WEBAPP_URL}\"}}}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Menu OK' if d.get('ok') else d)"

echo ""
echo "Готово!"
echo "  URL:  $WEBAPP_URL"
echo "  Бот:  @${BOT_USERNAME:-picksmapsmeta_bot} → /app"
echo "  Логи: $AMVERA_CLI logs run -s $PROJECT_SLUG"
