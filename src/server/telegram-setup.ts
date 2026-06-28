export async function syncTelegramMenu(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const url = process.env.WEBAPP_URL;
  if (!token || !url || url.includes("localhost")) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/setChatMenuButton`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_button: {
            type: "web_app",
            text: "🎮 PicksMaps",
            web_app: { url },
          },
        }),
      }
    );
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (data.ok) {
      console.log(`Telegram menu → ${url}`);
    } else {
      console.warn("Menu sync failed:", data.description);
    }
  } catch (e) {
    console.warn("Menu sync error:", e);
  }
}
