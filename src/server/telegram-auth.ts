import crypto from "node:crypto";

export interface TelegramUserAuth {
  userId: number;
  username?: string;
  firstName?: string;
}

/** Валидация initData по документации Telegram Mini Apps */
export function userFromInitData(
  initData: string,
  botToken: string
): TelegramUserAuth | null {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calculatedHash !== hash) return null;

  const authDate = Number(params.get("auth_date") || 0);
  if (authDate && Date.now() / 1000 - authDate > 86400) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  try {
    const user = JSON.parse(userRaw) as {
      id: number;
      username?: string;
      first_name?: string;
    };
    if (typeof user.id !== "number") return null;
    return {
      userId: user.id,
      username: user.username,
      firstName: user.first_name,
    };
  } catch {
    return null;
  }
}

import { verifyAuthToken } from "./auth-token.js";

export function parseTelegramUser(
  body: {
    initData?: string;
    auth?: string;
    userId?: number;
    username?: string;
    firstName?: string;
    matchId?: string;
  },
  botToken?: string
): TelegramUserAuth | null {
  if (body.initData && botToken) {
    const fromInit = userFromInitData(body.initData, botToken);
    if (fromInit) return fromInit;
  }

  if (body.auth) {
    const fromToken = verifyAuthToken(body.auth, body.matchId);
    if (fromToken) {
      return {
        userId: fromToken.userId,
        username: body.username,
        firstName: body.firstName,
      };
    }
  }

  // Fallback для локальной разработки без initData
  if (body.userId && !body.initData && !body.auth) {
    return {
      userId: body.userId,
      username: body.username,
      firstName: body.firstName,
    };
  }

  return null;
}
