export const CS2_MAPS = [
  "Ancient",
  "Anubis",
  "Dust II",
  "Inferno",
  "Mirage",
  "Nuke",
  "Overpass",
] as const;

export type MapName = (typeof CS2_MAPS)[number];

export type MatchFormat = "bo1" | "bo2" | "bo3" | "bo5";

export type TeamSlot = "A" | "B";

export type MatchStatus =
  | "waiting_teams"
  | "veto"
  | "side_pick"
  | "finished";

export type Side = "CT" | "T";

export type VetoActionType = "ban" | "pick" | "decider";

export interface VetoStep {
  action: VetoActionType;
  team: TeamSlot;
  /** Кто выбирает сторону после пика (opponent) или knife на decider */
  sideBy?: "opponent" | "knife";
}

export interface Captain {
  userId: number;
  username?: string;
  firstName?: string;
}

export interface PickedMap {
  map: MapName;
  pickedBy: TeamSlot;
  side?: Side;
  sideBy?: TeamSlot | "knife";
}

export interface VetoHistoryEntry {
  step: number;
  action: VetoActionType;
  team: TeamSlot;
  map: MapName;
  side?: Side;
  sideBy?: TeamSlot | "knife";
  timestamp: number;
}

export interface Match {
  id: string;
  format: MatchFormat;
  teamAName: string;
  teamBName: string;
  adminId: number;
  status: MatchStatus;
  captainA: Captain | null;
  captainB: Captain | null;
  firstBanTeam: TeamSlot | null;
  currentStep: number;
  remainingMaps: MapName[];
  pickedMaps: PickedMap[];
  history: VetoHistoryEntry[];
  pendingSidePick: {
    map: MapName;
    sideBy: TeamSlot;
  } | null;
  createdAt: number;
}

/** Профессиональные форматы вето CS2 */
export function getVetoSequence(format: MatchFormat): VetoStep[] {
  switch (format) {
    case "bo1":
      // 6 банов, остаётся 1 карта (knife на decider)
      return [
        { action: "ban", team: "A" },
        { action: "ban", team: "B" },
        { action: "ban", team: "A" },
        { action: "ban", team: "B" },
        { action: "ban", team: "A" },
        { action: "ban", team: "B" },
        { action: "decider", team: "A", sideBy: "knife" },
      ];
    case "bo2":
      // 4 бана, 2 пика + decider
      return [
        { action: "ban", team: "A" },
        { action: "ban", team: "B" },
        { action: "ban", team: "A" },
        { action: "ban", team: "B" },
        { action: "pick", team: "A", sideBy: "opponent" },
        { action: "pick", team: "B", sideBy: "opponent" },
        { action: "decider", team: "A", sideBy: "knife" },
      ];
    case "bo3":
      // ban ban pick pick ban ban + decider (FACEIT/ESL)
      return [
        { action: "ban", team: "A" },
        { action: "ban", team: "B" },
        { action: "pick", team: "A", sideBy: "opponent" },
        { action: "pick", team: "B", sideBy: "opponent" },
        { action: "ban", team: "A" },
        { action: "ban", team: "B" },
        { action: "decider", team: "A", sideBy: "knife" },
      ];
    case "bo5":
      // 2 бана, 4 пика + decider
      return [
        { action: "ban", team: "A" },
        { action: "ban", team: "B" },
        { action: "pick", team: "A", sideBy: "opponent" },
        { action: "pick", team: "B", sideBy: "opponent" },
        { action: "pick", team: "A", sideBy: "opponent" },
        { action: "pick", team: "B", sideBy: "opponent" },
        { action: "decider", team: "A", sideBy: "knife" },
      ];
  }
}

export function getCurrentVetoStep(match: Match): VetoStep | null {
  const sequence = getVetoSequence(match.format);
  if (match.currentStep >= sequence.length) return null;
  return sequence[match.currentStep];
}

export function getOpponentTeam(team: TeamSlot): TeamSlot {
  return team === "A" ? "B" : "A";
}

export function formatLabel(format: MatchFormat): string {
  const labels: Record<MatchFormat, string> = {
    bo1: "BO1",
    bo2: "BO2",
    bo3: "BO3",
    bo5: "BO5",
  };
  return labels[format];
}

function teamDisplayName(match: Match, team: TeamSlot): string {
  return team === "A" ? match.teamAName : match.teamBName;
}

function pickSideInfo(
  match: Match,
  entry: VetoHistoryEntry
): { side?: Side; sideBy?: TeamSlot | "knife" } {
  const picked = match.pickedMaps.find(
    (p) => p.map === entry.map && p.pickedBy === entry.team
  );
  return {
    side: picked?.side ?? entry.side,
    sideBy: picked?.sideBy ?? entry.sideBy,
  };
}

export function formatSideStart(
  match: Match,
  sideBy: TeamSlot | "knife" | undefined,
  side: Side | undefined
): string | null {
  if (sideBy === "knife") return "knife round";
  if (!side || !sideBy) return null;
  return `${teamDisplayName(match, sideBy)} starts ${side}`;
}

/** Текстовая сводка пик/бан для трансляции и уведомления админа */
export function formatVetoBroadcast(match: Match): string {
  const lines = ["✅ Пик/бан завершен.", ""];

  for (const entry of match.history) {
    const team = teamDisplayName(match, entry.team);

    if (entry.action === "ban") {
      lines.push(`${team} BANS ${entry.map}`);
    } else if (entry.action === "pick") {
      const { side, sideBy } = pickSideInfo(match, entry);
      const sideLabel = formatSideStart(match, sideBy, side);
      if (sideLabel) {
        lines.push(`${team} PICKS ${entry.map} — ${sideLabel}`);
      } else {
        lines.push(`${team} PICKS ${entry.map}`);
      }
    } else if (entry.action === "decider") {
      lines.push(`Decider: ${entry.map} — knife round`);
    }
  }

  return lines.join("\n");
}

export function actionLabel(step: VetoStep, teamAName: string, teamBName: string): string {
  const teamName = step.team === "A" ? teamAName : teamBName;
  switch (step.action) {
    case "ban":
      return `${teamName} — бан`;
    case "pick":
      return `${teamName} — пик`;
    case "decider":
      return "Decider — ножевой раунд";
  }
}

export function isUserTurn(match: Match, userId: number): boolean {
  if (match.status === "waiting_teams") return false;

  if (match.status === "side_pick" && match.pendingSidePick) {
    const captain =
      match.pendingSidePick.sideBy === "A" ? match.captainA : match.captainB;
    return captain?.userId === userId;
  }

  if (match.status !== "veto") return false;

  const step = getCurrentVetoStep(match);
  if (!step || step.action === "decider") return false;

  const captain = step.team === "A" ? match.captainA : match.captainB;
  return captain?.userId === userId;
}

export function getUserTeam(match: Match, userId: number): TeamSlot | null {
  if (match.captainA?.userId === userId) return "A";
  if (match.captainB?.userId === userId) return "B";
  return null;
}

export function getPublicMatchView(match: Match, viewerUserId?: number) {
  const step = getCurrentVetoStep(match);
  const userTeam = viewerUserId ? getUserTeam(match, viewerUserId) : null;

  return {
    id: match.id,
    format: match.format,
    formatLabel: formatLabel(match.format),
    teamAName: match.teamAName,
    teamBName: match.teamBName,
    status: match.status,
    captainA: match.captainA,
    captainB: match.captainB,
    firstBanTeam: match.firstBanTeam,
    currentStep: match.currentStep,
    remainingMaps: match.remainingMaps,
    pickedMaps: match.pickedMaps,
    history: match.history,
    pendingSidePick: match.pendingSidePick,
    currentAction: step
      ? {
          ...step,
          label: actionLabel(step, match.teamAName, match.teamBName),
        }
      : null,
    userTeam,
    isUserTurn: viewerUserId ? isUserTurn(match, viewerUserId) : false,
    maps: CS2_MAPS,
  };
}
