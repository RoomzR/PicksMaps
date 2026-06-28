#!/bin/bash
cd "$(dirname "$0")"

echo "Stopping old processes..."
pkill -f "cloudflared tunnel --url http://localhost:3000" 2>/dev/null
pkill -f "node dist/server/index.js" 2>/dev/null
sleep 2

echo "Starting server..."
npm start &
SERVER_PID=$!
sleep 2

echo "Starting Cloudflare tunnel..."
cloudflared tunnel --url http://localhost:3000 2>&1 | tee /tmp/picksmaps-tunnel.log &
TUNNEL_PID=$!

echo "Waiting for tunnel URL..."
for i in $(seq 1 15); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/picksmaps-tunnel.log | head -1)
  if [ -n "$URL" ]; then
    echo ""
    echo "============================================"
    echo "  Server:  http://localhost:3000"
    echo "  Tunnel:  $URL"
    echo "============================================"
    echo ""
    echo "Обновите WEBAPP_URL в .env и URL в BotFather!"
    echo "Не закрывайте этот терминал."
    wait $SERVER_PID
    exit 0
  fi
  sleep 1
done

echo "Туннель не поднялся. Проверьте /tmp/picksmaps-tunnel.log"
wait $SERVER_PID
