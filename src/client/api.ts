import type { PublicMatch, MatchFormat } from "./types";

function getTg() {
  return window.Telegram?.WebApp;
}

let cachedAuth: string | null = null;

export function getAuthToken(): string | null {
  if (cachedAuth) return cachedAuth;
  const params = new URLSearchParams(window.location.search);
  cachedAuth = params.get("auth");
  return cachedAuth;
}

export function initTelegram() {
  const tg = getTg();
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor("#0f0f14");
    tg.setBackgroundColor("#0f0f14");
  } catch {
    /* older Telegram clients */
  }
}

function parseUserFromInitData(initData?: string) {
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const raw = params.get("user");
    if (!raw) return null;
    const user = JSON.parse(raw) as {
      id: number;
      username?: string;
      first_name?: string;
    };
    if (typeof user.id === "number") return user;
  } catch {
    /* ignore */
  }
  return null;
}

export function isTelegramWebView(): boolean {
  const w = getTg();
  if (!w) return false;
  if (w.initData) return true;
  const platform = w.platform;
  return Boolean(platform && platform !== "unknown");
}

/** @deprecated use isTelegramWebView */
export function isInsideTelegram(): boolean {
  return isTelegramWebView();
}

export function getTelegramUser() {
  const tg = getTg();
  const unsafe = tg?.initDataUnsafe?.user;
  if (unsafe?.id) return unsafe;

  const parsed = parseUserFromInitData(tg?.initData);
  if (parsed) return parsed;

  if (!isTelegramWebView() && import.meta.env.DEV) {
    return { id: 1098436562, username: "dev_admin", first_name: "Dev" };
  }
  return null;
}

export function getTelegramDomainHint(): string {
  return window.location.hostname;
}

export function getMatchIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("match");
  if (fromQuery) return fromQuery;

  const tg = getTg();
  const startParam = tg?.initDataUnsafe?.start_param;
  if (startParam?.startsWith("match_")) {
    return startParam.replace("match_", "");
  }
  return null;
}

function authBody(extra: Record<string, unknown> = {}) {
  const user = getTelegramUser();
  const matchId = getMatchIdFromUrl();
  return {
    initData: getTg()?.initData || "",
    auth: getAuthToken() || undefined,
    matchId: matchId || undefined,
    userId: user?.id,
    username: user?.username,
    firstName: user?.first_name,
    ...extra,
  };
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Нет связи с сервером");
  }

  let data: { error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Ошибка сервера (${res.status})`);
  }

  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export async function fetchMe(): Promise<{
  userId: number;
  username?: string;
  firstName?: string;
}> {
  const matchId = getMatchIdFromUrl();
  const auth = getAuthToken();
  const initData = getTg()?.initData || "";
  const q = new URLSearchParams();
  if (auth) q.set("auth", auth);
  if (initData) q.set("initData", initData);
  if (matchId) q.set("matchId", matchId);
  return api(`/api/me?${q}`);
}

export async function fetchMatch(
  matchId: string,
  userId?: number
): Promise<PublicMatch> {
  const auth = getAuthToken();
  const q = new URLSearchParams();
  if (userId) q.set("userId", String(userId));
  if (auth) q.set("auth", auth);
  q.set("matchId", matchId);
  const initData = getTg()?.initData;
  if (initData) q.set("initData", initData);
  return api(`/api/match/${matchId}?${q}`);
}

export async function createMatch(params: {
  format: MatchFormat;
  teamAName: string;
  teamBName: string;
}): Promise<{ match: PublicMatch; link: string }> {
  return api("/api/match", {
    method: "POST",
    body: JSON.stringify(authBody(params)),
  });
}

export async function joinTeam(
  matchId: string,
  team: "A" | "B"
): Promise<PublicMatch> {
  return api(`/api/match/${matchId}/join`, {
    method: "POST",
    body: JSON.stringify(authBody({ team, matchId })),
  });
}

export async function vetoMap(
  matchId: string,
  map: string
): Promise<PublicMatch> {
  return api(`/api/match/${matchId}/veto`, {
    method: "POST",
    body: JSON.stringify(authBody({ map, matchId })),
  });
}

export async function pickSide(
  matchId: string,
  side: "CT" | "T"
): Promise<PublicMatch> {
  return api(`/api/match/${matchId}/side`, {
    method: "POST",
    body: JSON.stringify(authBody({ side, matchId })),
  });
}

export function connectWs(
  matchId: string,
  userId: number | undefined,
  onUpdate: (match: PublicMatch) => void
): WebSocket {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const uid = userId ? `&userId=${userId}` : "";
  const auth = getAuthToken();
  const authQ = auth ? `&auth=${encodeURIComponent(auth)}` : "";
  const ws = new WebSocket(
    `${proto}://${window.location.host}/ws?matchId=${matchId}${uid}${authQ}`
  );

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "match_update") onUpdate(msg.data);
  };

  return ws;
}

export function haptic(type: "light" | "medium" | "heavy" = "light") {
  getTg()?.HapticFeedback?.impactOccurred(type);
}

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  getTg()?.showAlert?.("Ссылка скопирована!");
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        initDataUnsafe: {
          user?: { id: number; username?: string; first_name?: string };
          start_param?: string;
        };
        initData?: string;
        platform?: string;
        version?: string;
        HapticFeedback?: { impactOccurred: (type: string) => void };
        showAlert?: (msg: string) => void;
        close: () => void;
      };
    };
  }
}
