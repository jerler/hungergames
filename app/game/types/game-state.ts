import type { TributeAssignmentMode } from "~/game/tributes/tribute-drafts";
import type { GameConfig } from "~/game/types/game-config";
import type { TributeStats } from "~/game/types/tribute";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";

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
  definitionId: StatusEffectId;

  severity: 1 | 2 | 3;
  remainingRounds: number;

  sourceEventId: string;
  appliedRound: RoundReference;
}

export interface InventoryItem {
  id: string;
  definitionId: ItemDefinitionId;
  usesRemaining: number;

  sourceEventId: string;
  acquiredRound: RoundReference;
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

export interface ApplyStatusChange {
  type: "apply-status";
  tributeId: string;
  status: StatusEffect;
}

export interface RemoveStatusChange {
  type: "remove-status";
  tributeId: string;
  statusId: string;
}

export interface AcquireInventoryItemChange {
  type: "acquire-item";
  tributeId: string;
  item: InventoryItem;
}

export interface ConsumeInventoryItemChange {
  type: "consume-item";
  tributeId: string;
  itemInstanceId: string;
  uses: number;
  reason: string;
}

export type InventoryTransactionType = "acquired" | "consumed";

export interface InventoryTransaction {
  id: string;
  type: InventoryTransactionType;

  tributeId: string;
  itemInstanceId: string;
  definitionId: ItemDefinitionId;

  uses: number;
  round: RoundReference;
  sourceId: string;
}

export type GameChange =
  | EliminateTributeChange
  | IncrementStatisticChange
  | ApplyStatusChange
  | RemoveStatusChange
  | AcquireInventoryItemChange
  | ConsumeInventoryItemChange;

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

  itemTransactions: InventoryTransaction[];

  victorTributeId: string | null;
  engine: EngineState;

  createdAt: string;
  updatedAt: string;
}
