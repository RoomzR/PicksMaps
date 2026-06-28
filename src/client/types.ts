export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

export interface PublicMatch {
  id: string;
  format: string;
  formatLabel: string;
  teamAName: string;
  teamBName: string;
  status: "waiting_teams" | "veto" | "side_pick" | "finished";
  captainA: { userId: number; username?: string; firstName?: string } | null;
  captainB: { userId: number; username?: string; firstName?: string } | null;
  firstBanTeam: "A" | "B" | null;
  currentStep: number;
  remainingMaps: string[];
  pickedMaps: {
    map: string;
    pickedBy: "A" | "B";
    side?: "CT" | "T";
    sideBy?: "A" | "B" | "knife";
  }[];
  history: {
    step: number;
    action: "ban" | "pick" | "decider";
    team: "A" | "B";
    map: string;
    side?: "CT" | "T";
    sideBy?: "A" | "B" | "knife";
    timestamp: number;
  }[];
  pendingSidePick: { map: string; sideBy: "A" | "B" } | null;
  currentAction: {
    action: "ban" | "pick" | "decider";
    team: "A" | "B";
    label: string;
    sideBy?: "opponent" | "knife";
  } | null;
  userTeam: "A" | "B" | null;
  isUserTurn: boolean;
  maps: string[];
}

export type MatchFormat = "bo1" | "bo2" | "bo3" | "bo5";
