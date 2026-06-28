import crypto from "node:crypto";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  return process.env.BOT_TOKEN || "dev-secret";
}

export function createAuthToken(userId: number, matchId?: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}:${matchId || ""}:${exp}`;
  const sig = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyAuthToken(
  token: string,
  matchId?: string
): { userId: number } | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [userIdStr, tokenMatchId, expStr, sig] = raw.split(":");
    const userId = Number(userIdStr);
    const exp = Number(expStr);
    if (!userId || !exp || !sig) return null;
    if (Date.now() > exp) return null;
    if (matchId && tokenMatchId && tokenMatchId !== matchId) return null;

    const payload = `${userIdStr}:${tokenMatchId}:${expStr}`;
    const expected = crypto
      .createHmac("sha256", secret())
      .update(payload)
      .digest("hex")
      .slice(0, 16);
    if (sig !== expected) return null;

    return { userId };
  } catch {
    return null;
  }
}

export function appendAuthToUrl(url: string, userId: number, matchId?: string): string {
  const token = createAuthToken(userId, matchId);
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}auth=${token}`;
}
