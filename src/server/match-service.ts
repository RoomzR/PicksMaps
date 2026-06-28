import { nanoid } from "nanoid";
import {
  type Captain,
  type MapName,
  type Match,
  type MatchFormat,
  type Side,
  type TeamSlot,
  CS2_MAPS,
  getCurrentVetoStep,
  getOpponentTeam,
} from "../shared/types.js";
import { loadMatch, saveMatch } from "./db.js";

export class MatchError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
  }
}

export function createMatch(params: {
  format: MatchFormat;
  teamAName: string;
  teamBName: string;
  adminId: number;
}): Match {
  const match: Match = {
    id: nanoid(10),
    format: params.format,
    teamAName: params.teamAName.trim(),
    teamBName: params.teamBName.trim(),
    adminId: params.adminId,
    status: "waiting_teams",
    captainA: null,
    captainB: null,
    firstBanTeam: null,
    currentStep: 0,
    remainingMaps: [...CS2_MAPS],
    pickedMaps: [],
    history: [],
    pendingSidePick: null,
    createdAt: Date.now(),
  };

  if (!match.teamAName || !match.teamBName) {
    throw new MatchError("Названия команд обязательны", "INVALID_TEAMS");
  }

  saveMatch(match);
  return match;
}

export function getMatch(id: string): Match | null {
  return loadMatch(id);
}

export function joinTeam(
  matchId: string,
  team: TeamSlot,
  captain: Captain
): Match {
  const match = loadMatch(matchId);
  if (!match) throw new MatchError("Матч не найден", "NOT_FOUND");
  if (match.status !== "waiting_teams") {
    throw new MatchError("Выбор команд уже завершён", "ALREADY_STARTED");
  }

  const otherCaptain = team === "A" ? match.captainB : match.captainA;
  if (otherCaptain?.userId === captain.userId) {
    throw new MatchError("Вы уже выбрали другую команду", "ALREADY_JOINED");
  }

  const slotCaptain = team === "A" ? match.captainA : match.captainB;
  if (slotCaptain && slotCaptain.userId !== captain.userId) {
    throw new MatchError("Эта команда уже занята", "TEAM_TAKEN");
  }

  if (team === "A") {
    match.captainA = captain;
  } else {
    match.captainB = captain;
  }

  if (match.captainA && match.captainB) {
    match.firstBanTeam = Math.random() < 0.5 ? "A" : "B";
    normalizeTeamsForFirstBan(match);
    match.status = "veto";
    advanceDeciderIfNeeded(match);
  }

  saveMatch(match);
  return match;
}

/** Команда с первым баном всегда становится A в последовательности вето */
function normalizeTeamsForFirstBan(match: Match): void {
  if (!match.firstBanTeam || match.firstBanTeam === "A") return;

  const tmpName = match.teamAName;
  match.teamAName = match.teamBName;
  match.teamBName = tmpName;

  const tmpCaptain = match.captainA;
  match.captainA = match.captainB;
  match.captainB = tmpCaptain;

  match.firstBanTeam = "A";
}

function advanceDeciderIfNeeded(match: Match): void {
  let step = getCurrentVetoStep(match);
  while (step?.action === "decider" && match.remainingMaps.length === 1) {
    const map = match.remainingMaps[0];
    match.pickedMaps.push({
      map,
      pickedBy: step.team,
      sideBy: "knife",
    });
    match.history.push({
      step: match.currentStep,
      action: "decider",
      team: step.team,
      map,
      sideBy: "knife",
      timestamp: Date.now(),
    });
    match.remainingMaps = [];
    match.currentStep++;
    match.status = "finished";
    step = getCurrentVetoStep(match);
  }
}

export function performVetoAction(
  matchId: string,
  userId: number,
  map: MapName
): Match {
  const match = loadMatch(matchId);
  if (!match) throw new MatchError("Матч не найден", "NOT_FOUND");

  if (match.status === "side_pick" && match.pendingSidePick) {
    throw new MatchError("Сейчас нужно выбрать сторону", "SIDE_REQUIRED");
  }

  if (match.status !== "veto") {
    throw new MatchError("Вето не активно", "NOT_VETO");
  }

  const step = getCurrentVetoStep(match);
  if (!step) throw new MatchError("Вето завершено", "VETO_DONE");
  if (step.action === "decider") {
    throw new MatchError("Decider определяется автоматически", "DECIDER_AUTO");
  }

  const captain = step.team === "A" ? match.captainA : match.captainB;
  if (!captain || captain.userId !== userId) {
    throw new MatchError("Сейчас не ваш ход", "NOT_YOUR_TURN");
  }

  if (!match.remainingMaps.includes(map)) {
    throw new MatchError("Карта недоступна", "MAP_UNAVAILABLE");
  }

  match.remainingMaps = match.remainingMaps.filter((m) => m !== map);

  if (step.action === "ban") {
    match.history.push({
      step: match.currentStep,
      action: "ban",
      team: step.team,
      map,
      timestamp: Date.now(),
    });
    match.currentStep++;
    advanceDeciderIfNeeded(match);
    if (match.status === "veto") {
      const next = getCurrentVetoStep(match);
      if (next?.action === "decider" && match.remainingMaps.length === 1) {
        advanceDeciderIfNeeded(match);
      }
    }
  } else if (step.action === "pick") {
    match.history.push({
      step: match.currentStep,
      action: "pick",
      team: step.team,
      map,
      timestamp: Date.now(),
    });

    const sideBy = getOpponentTeam(step.team);
    match.pendingSidePick = { map, sideBy };
    match.status = "side_pick";

    match.pickedMaps.push({
      map,
      pickedBy: step.team,
      sideBy,
    });
  }

  saveMatch(match);
  return match;
}

export function pickSide(
  matchId: string,
  userId: number,
  side: Side
): Match {
  const match = loadMatch(matchId);
  if (!match) throw new MatchError("Матч не найден", "NOT_FOUND");
  if (match.status !== "side_pick" || !match.pendingSidePick) {
    throw new MatchError("Выбор стороны не требуется", "NO_SIDE_PICK");
  }

  const { map, sideBy } = match.pendingSidePick;
  const captain = sideBy === "A" ? match.captainA : match.captainB;
  if (!captain || captain.userId !== userId) {
    throw new MatchError("Сейчас не ваш ход", "NOT_YOUR_TURN");
  }

  const picked = match.pickedMaps.find((p) => p.map === map);
  if (picked) picked.side = side;

  const lastHistory = match.history[match.history.length - 1];
  if (lastHistory && lastHistory.map === map) {
    lastHistory.side = side;
    lastHistory.sideBy = sideBy;
  }

  match.pendingSidePick = null;
  match.currentStep++;
  match.status = "veto";
  advanceDeciderIfNeeded(match);

  saveMatch(match);
  return match;
}
