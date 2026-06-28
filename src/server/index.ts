import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import type { MapName, MatchFormat, Side, TeamSlot } from "../shared/types.js";
import { getPublicMatchView } from "../shared/types.js";
import { deleteOldMatches, initDb } from "./db.js";
import {
  MatchError,
  createMatch,
  getMatch,
  joinTeam,
  performVetoAction,
  pickSide,
} from "./match-service.js";
import { broadcastMatch, subscribeClient } from "./ws.js";
import { startBot } from "./bot.js";
import { buildMatchLink, isAdmin } from "./config.js";
import { parseTelegramUser } from "./telegram-auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

initDb();
deleteOldMatches();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const user = parseTelegramUser(
    {
      initData: req.query.initData as string | undefined,
      auth: req.query.auth as string | undefined,
      matchId: req.query.matchId as string | undefined,
    },
    BOT_TOKEN
  );
  if (!user) {
    res.status(401).json({ error: "Не авторизован" });
    return;
  }
  res.json(user);
});

app.get("/api/match/:id", (req, res) => {
  const match = getMatch(req.params.id);
  if (!match) {
    res.status(404).json({ error: "Матч не найден" });
    return;
  }
  let userId = req.query.userId ? Number(req.query.userId) : undefined;
  if (!userId) {
    const user = parseTelegramUser(
      {
        initData: req.query.initData as string | undefined,
        auth: req.query.auth as string | undefined,
        matchId: req.params.id,
      },
      BOT_TOKEN
    );
    userId = user?.userId;
  }
  res.json(getPublicMatchView(match, userId));
});

app.post("/api/match", (req, res) => {
  const user = parseTelegramUser(req.body, BOT_TOKEN);
  if (!user || !isAdmin(user.userId)) {
    res.status(403).json({
      error: user
        ? "Только админ может создавать матчи"
        : "Откройте Mini App через кнопку бота (/app для админа)",
    });
    return;
  }

  const { format, teamAName, teamBName } = req.body as {
    format: MatchFormat;
    teamAName: string;
    teamBName: string;
  };

  const validFormats: MatchFormat[] = ["bo1", "bo2", "bo3", "bo5"];
  if (!validFormats.includes(format)) {
    res.status(400).json({ error: "Неверный формат матча" });
    return;
  }

  try {
    const match = createMatch({
      format,
      teamAName,
      teamBName,
      adminId: user.userId,
    });
    res.json({
      match: getPublicMatchView(match, user.userId),
      link: buildMatchLink(match.id),
    });
  } catch (e) {
    if (e instanceof MatchError) {
      res.status(400).json({ error: e.message, code: e.code });
      return;
    }
    throw e;
  }
});

app.post("/api/match/:id/join", (req, res) => {
  const user = parseTelegramUser({ ...req.body, matchId: req.params.id }, BOT_TOKEN);
  if (!user) {
    res.status(401).json({ error: "Не авторизован" });
    return;
  }

  const { team } = req.body as { team: TeamSlot };
  if (team !== "A" && team !== "B") {
    res.status(400).json({ error: "Неверная команда" });
    return;
  }

  try {
    const match = joinTeam(req.params.id, team, user);
    broadcastMatch(match);
    res.json(getPublicMatchView(match, user.userId));
  } catch (e) {
    if (e instanceof MatchError) {
      res.status(400).json({ error: e.message, code: e.code });
      return;
    }
    throw e;
  }
});

app.post("/api/match/:id/veto", (req, res) => {
  const user = parseTelegramUser({ ...req.body, matchId: req.params.id }, BOT_TOKEN);
  if (!user) {
    res.status(401).json({ error: "Не авторизован" });
    return;
  }

  const { map } = req.body as { map: MapName };

  try {
    const match = performVetoAction(req.params.id, user.userId, map);
    broadcastMatch(match);
    res.json(getPublicMatchView(match, user.userId));
  } catch (e) {
    if (e instanceof MatchError) {
      res.status(400).json({ error: e.message, code: e.code });
      return;
    }
    throw e;
  }
});

app.post("/api/match/:id/side", (req, res) => {
  const user = parseTelegramUser({ ...req.body, matchId: req.params.id }, BOT_TOKEN);
  if (!user) {
    res.status(401).json({ error: "Не авторизован" });
    return;
  }

  const { side } = req.body as { side: Side };
  if (side !== "CT" && side !== "T") {
    res.status(400).json({ error: "Неверная сторона" });
    return;
  }

  try {
    const match = pickSide(req.params.id, user.userId, side);
    broadcastMatch(match);
    res.json(getPublicMatchView(match, user.userId));
  } catch (e) {
    if (e instanceof MatchError) {
      res.status(400).json({ error: e.message, code: e.code });
      return;
    }
    throw e;
  }
});

// Static files (production build)
const clientDist = path.join(__dirname, "../client");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

import { verifyAuthToken } from "./auth-token.js";

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const matchId = url.searchParams.get("matchId");
  let userId = url.searchParams.get("userId")
    ? Number(url.searchParams.get("userId"))
    : undefined;

  const auth = url.searchParams.get("auth");
  if (!userId && auth && matchId) {
    const verified = verifyAuthToken(auth, matchId);
    if (verified) userId = verified.userId;
  }

  if (!matchId) {
    ws.close(1008, "matchId required");
    return;
  }

  subscribeClient(ws, matchId, userId);

  const match = getMatch(matchId);
  if (match) {
    ws.send(
      JSON.stringify({
        type: "match_update",
        data: getPublicMatchView(match, userId),
      })
    );
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.BOT_TOKEN) {
    startBot();
  } else {
    console.warn("BOT_TOKEN not set — bot disabled");
  }
});
