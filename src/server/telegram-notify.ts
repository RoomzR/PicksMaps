import type { Match } from "../shared/types.js";
import { formatVetoBroadcast } from "../shared/types.js";

export async function notifyAdminVetoComplete(match: Match): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token || match.status !== "finished") return;

  const text = formatVetoBroadcast(match);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: match.adminId,
        text,
      }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      console.warn("Admin veto notify failed:", data.description);
    }
  } catch (e) {
    console.warn("Admin veto notify error:", e);
  }
}
