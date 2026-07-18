import type { TributeAssignmentMode } from "~/game/tributes/tribute-drafts";
import type { GameConfig } from "~/game/types/game-config";
import type { TributeStats } from "~/game/types/tribute";

export type GamePhase = "opening" | "round-events" | "round-complete" | "victory" | "statistics";

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

export type TributeStatisticKey = keyof TributeStatistics;

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

export interface EliminateTributeChange {
  type: "eliminate-tribute";
  tributeId: string;
  causeId: string;
  causeLabel: string;
  summary: string;
  killerTributeIds: string[];
}

export interface IncrementStatisticChange {
  type: "increment-statistic";
  tributeId: string;
  statistic: TributeStatisticKey;
  amount: number;
}

export interface AddStatusChange {
  type: "add-status";
  tributeId: string;
  status: StatusEffect;
}

export interface RemoveStatusChange {
  type: "remove-status";
  tributeId: string;
  statusId: string;
}

export interface AddInventoryItemChange {
  type: "add-inventory-item";
  tributeId: string;
  item: InventoryItem;
}

export interface RemoveInventoryItemChange {
  type: "remove-inventory-item";
  tributeId: string;
  itemId: string;
}

export type GameChange =
  | EliminateTributeChange
  | IncrementStatisticChange
  | AddStatusChange
  | RemoveStatusChange
  | AddInventoryItemChange
  | RemoveInventoryItemChange;

export type EventResolutionMode = "standard" | "safety";

export interface ResolvedEvent {
  id: string;
  definitionId: string;
  resolutionMode: EventResolutionMode;

  round: RoundReference;
  participantTributeIds: string[];

  text: string;
  changes: GameChange[];
}

export interface EngineState {
  consecutiveNonEliminationRounds: number;
  forcedResolutionCount: number;
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

  roundEvents: ResolvedEvent[];
  revealedEventCount: number;
  eventHistory: ResolvedEvent[];

  victorTributeId: string | null;
  engine: EngineState;

  createdAt: string;
  updatedAt: string;
}
