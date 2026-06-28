export function buildMatchLink(matchId: string): string {
  const botUsername = process.env.BOT_USERNAME || "YourBot";
  // start= открывает чат и бот показывает кнопку Mini App
  // startapp= работает только если Mini App настроен в BotFather
  return `https://t.me/${botUsername}?start=match_${matchId}`;
}

export function buildWebAppUrl(matchId?: string): string {
  const base = process.env.WEBAPP_URL || "http://localhost:5173";
  if (matchId) return `${base}?match=${matchId}`;
  return base;
}

export function getAdminIds(): number[] {
  return (process.env.ADMIN_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map(Number);
}

export function isAdmin(userId: number): boolean {
  const adminIds = getAdminIds();
  return adminIds.length === 0 || adminIds.includes(userId);
}
