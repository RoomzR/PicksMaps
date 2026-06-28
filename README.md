# PicksMaps — Telegram бот для пиков/банов карт CS2

Telegram Mini App для проведения профессионального вето карт в Counter-Strike 2.

## Возможности

- **Админ** создаёт матч (BO1 / BO2 / BO3 / BO5), задаёт названия двух команд
- Получает **ссылку** и отправляет её капитанам
- **Капитаны** открывают ссылку, выбирают свою команду (слева / справа)
- После выбора обоих начинается **вето** по профессиональным правилам CS2
- При **пике** карты соперник выбирает сторону (CT / T)
- **Decider** — ножевой раунд за сторону
- Обновления в **реальном времени** через WebSocket

## Карты (Active Duty)

Ancient, Anubis, Dust II, Inferno, Mirage, Nuke, Overpass

## Форматы вето

| Формат | Баны | Пики | Decider |
|--------|------|------|---------|
| BO1    | 6    | —    | 1 карта (knife) |
| BO2    | 4    | 2    | knife |
| BO3    | 2+2  | 2    | ban ban pick pick ban ban → decider |
| BO5    | 2    | 4    | knife |

## Быстрый старт

### 1. Создайте бота

1. Напишите [@BotFather](https://t.me/BotFather)
2. `/newbot` → получите **BOT_TOKEN**
3. `/newapp` → привяжите Mini App к боту
4. Укажите URL вашего приложения (HTTPS)

### 2. Настройка

```bash
cp .env.example .env
```

Заполните `.env`:

```env
BOT_TOKEN=123456:ABC...
BOT_USERNAME=YourBotUsername
ADMIN_IDS=ваш_telegram_id
WEBAPP_URL=https://your-domain.com
PORT=3000
```

Узнать свой Telegram ID: [@userinfobot](https://t.me/userinfobot)

### 3. Установка и запуск

```bash
npm install
npm run dev        # dev: сервер :3000 + фронт :5173
```

Для локальной разработки Mini App нужен **HTTPS-туннель** (Telegram требует HTTPS):

```bash
npx ngrok http 5173
```

Укажите ngrok-URL в `WEBAPP_URL` и в настройках Mini App у BotFather.

### 4. Продакшен

```bash
npm run build
npm start
```

Сервер отдаёт API, WebSocket и собранный фронтенд на одном порту.

## Использование

1. Админ открывает бота → **«Создать матч»**
2. Выбирает формат, вводит названия команд → **«Создать»**
3. Копирует ссылку и отправляет капитанам
4. Капитаны открывают ссылку → выбирают команду
5. По очереди банят/пикают карты
6. После пика — соперник выбирает CT или T
7. В конце — итоговый список карт

## Структура проекта

```
src/
├── shared/types.ts      # Типы и логика вето
├── server/
│   ├── index.ts         # Express + WebSocket
│   ├── bot.ts           # Telegram бот (grammy)
│   ├── match-service.ts # Бизнес-логика матчей
│   └── db.ts            # SQLite
└── client/              # React Mini App (Vite)
```

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/match/:id` | Состояние матча |
| POST | `/api/match` | Создать матч (админ) |
| POST | `/api/match/:id/join` | Выбрать команду |
| POST | `/api/match/:id/veto` | Бан/пик карты |
| POST | `/api/match/:id/side` | Выбор стороны CT/T |
| WS | `/ws?matchId=...` | Real-time обновления |

## Безопасность

В продакшене рекомендуется валидировать `initData` от Telegram (HMAC с BOT_TOKEN). Сейчас для упрощения используется `userId` из WebApp.
