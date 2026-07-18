import type { TributeAssignmentMode } from "~/game/tributes/tribute-drafts";
import type { GameConfig } from "~/game/types/game-config";
import type { TributeStats } from "~/game/types/tribute";

export type GamePhase =
  | "opening"
  | "round-intro"
  | "round-events"
  | "gift-selection"
  | "gift-voting"
  | "recipient-voting"
  | "gift-result"
  | "victory"
  | "statistics";

export interface RoundReference {
  day: number;
  period: "day" | "night";
}

export interface TributeDeath {
  round: RoundReference;
  causeId: string;
  causeLabel: string;
  summary: string;
  killerTributeIds: string[];
  resolvedEventId: string;
}

export interface StatusEffect {
  id: string;
  type: string;
  severity: 1 | 2 | 3;
  remainingRounds: number | null;
}

export interface InventoryItem {
  id: string;
  definitionId: string;
  quantity: number;
  usesRemaining: number | null;
}

export interface TributeStatistics {
  kills: number;
  attemptedKills: number;
  giftsReceived: number;
  eventsSurvived: number;
}

export interface GameTribute {
  id: string;
  sourceDefinitionId: string | null;

  district: number;
  districtPosition: 1 | 2;

  snapshot: {
    name: string;
    portraitUrl: string | null;
    stats: TributeStats;
  };

  isAlive: boolean;
  death: TributeDeath | null;
  statuses: StatusEffect[];
  inventory: InventoryItem[];
  allianceId: string | null;
  statistics: TributeStatistics;
}

export interface GameState {
  schemaVersion: 1;

  id: string;
  seed: string;
  phase: GamePhase;
  assignmentMode: TributeAssignmentMode;

  config: GameConfig;
  currentRound: RoundReference | null;
  tributes: GameTribute[];

  recentEvents: [];
  victorTributeId: string | null;

  createdAt: string;
  updatedAt: string;
}
