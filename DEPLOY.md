# Деплой PicksMaps

## Fly.io — нужна верификация

Аккаунт помечен как high risk → https://fly.io/high-risk-unlock  
После разблокировки: `./deploy-fly.sh`

---

## Render.com (бесплатно, проще всего)

### 1. GitHub
```bash
cd /Users/roomz/Documents/PicksMaps
git branch -M main
git add .
git commit -m "PicksMaps CS2 veto bot"
```
Создайте репо на https://github.com/new → затем:
```bash
git remote add origin https://github.com/ВАШ_ЛОГИН/PicksMaps.git
git push -u origin main
```

### 2. Render
1. https://render.com → регистрация через GitHub
2. **New +** → **Web Service** → выберите репозиторий
3. **Build Command:** `npm install && npm run build`
4. **Start Command:** `npm start`
5. **Plan:** Free
6. **Environment Variables:**
   - `BOT_TOKEN` — токен от BotFather
   - `BOT_USERNAME` — `picksmapsmeta_bot`
   - `ADMIN_IDS` — `1098436562`
   - `WEBAPP_URL` — пока оставьте пустым, обновите после деплоя
7. **Create Web Service**

### 3. После первого деплоя
1. Скопируйте URL: `https://picksmaps-xxxx.onrender.com`
2. Render → **Environment** → `WEBAPP_URL` = этот URL
3. **Manual Deploy** → Redeploy
4. @picksmapsmeta_bot → `/app`

⚠️ Free Render засыпает через ~15 мин — первый ответ бота может быть с задержкой ~30 сек.

---

## Сравнение

| | Fly.io | Render Free |
|---|--------|-------------|
| Цена | бесплатно | бесплатно |
| 24/7 | ✅ | ❌ засыпает |
| HTTPS | постоянный | постоянный |
| cloudflared | не нужен | не нужен |
