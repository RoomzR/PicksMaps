# Деплой PicksMaps

## 1cloud.ru (рекомендуется из Беларуси)

**Плюсы:** ДЦ в **Беларуси**, оплата картой РБ / ЕРИП / ₽, 24/7, от ~509 ₽/мес  
**Бонус:** ~500 ₽ на тест при регистрации

### Шаг 1 — Регистрация
1. https://1cloud.ru/signup
2. Пополните баланс (минимум ~500 ₽) или используйте бонус

### Шаг 2 — Создайте VPS
1. Панель → **Создать VPS**
2. **ЦОД:** выберите **Беларусь** (Минск)
3. **ОС:** Ubuntu 22.04
4. **Конфиг:** минимум **1 vCPU, 1 GB RAM, 10 GB SSD** (~509–875 ₽/мес)
5. Запишите **IP-адрес** и **root-пароль**

### Шаг 3 — Откройте порты
В панели 1cloud → Сеть / Firewall:
- **80** (HTTP)
- **443** (HTTPS)
- **22** (SSH)

### Шаг 4 — Подключитесь по SSH
```bash
ssh root@ВАШ_IP
```

### Шаг 5 — Деплой одной командой
```bash
export REPO_URL=https://github.com/ВАШ_ЛОГИН/PicksMaps.git
curl -fsSL https://raw.githubusercontent.com/ВАШ_ЛОГИН/PicksMaps/main/deploy-vps.sh | bash
```

Или вручную:
```bash
git clone https://github.com/ВАШ_ЛОГИН/PicksMaps.git
cd PicksMaps
chmod +x deploy-vps.sh
nano .env   # BOT_TOKEN, BOT_USERNAME, ADMIN_IDS, WEBAPP_URL
./deploy-vps.sh
```

### Шаг 6 — HTTPS (домен)

**Бесплатный домен:** https://duckdns.org или https://freedns.afraid.org

```bash
DOMAIN=picksmaps.duckdns.org ./deploy-vps.sh
```

В `.env`:
```
WEBAPP_URL=https://picksmaps.duckdns.org
```

Или **без домена** — используйте IP (Mini App в Telegram **нужен HTTPS**, поэтому домен обязателен).

### Шаг 7 — BotFather
Откройте @picksmapsmeta_bot → `/app` — кнопка меню обновится автоматически.

---

## Управление на сервере

```bash
pm2 status          # статус
pm2 logs picksmaps  # логи
pm2 restart picksmaps
cd ~/PicksMaps && git pull && npm run build && pm2 restart picksmaps
```

---

## Другие варианты

| Платформа | Из РБ | 24/7 | Цена |
|-----------|-------|------|------|
| **1cloud.ru (BY)** | ✅ | ✅ | ~509 ₽/мес |
| cloudvps.by | ✅ | ✅ | ~15 BYN/мес |
| Render Free | ✅ | ❌ | бесплатно |
| Fly.io | ⚠️ | ✅ | заблокирован |
| Свой ПК + tunnel | ✅ | ❌ | бесплатно |

---

## Fly.io

Аккаунт high risk → https://fly.io/high-risk-unlock → `./deploy-fly.sh`

## Render.com

См. раздел ниже (бесплатно, но засыпает).

### Render
1. GitHub → push проекта
2. https://render.com → Web Service
3. Build: `npm install && npm run build`
4. Start: `npm start`
5. Env: `BOT_TOKEN`, `BOT_USERNAME`, `ADMIN_IDS`, `WEBAPP_URL`
