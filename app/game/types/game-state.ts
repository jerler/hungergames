import type { TributeAssignmentMode } from "~/game/tributes/tribute-drafts";
import type { PronounSetId } from "~/game/tributes/pronouns";
import type { GameConfig } from "~/game/types/game-config";
import type { PortraitPosition, TributeStats } from "~/game/types/tribute";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";

export type GamePhase = "opening" | "round-events" | "round-complete" | "victory" | "statistics";

export interface RoundReference {
  day: number;
  period: "day" | "night";
}

export type TruceKind = "standard" | "romantic";

export type TruceBreakReason = "expired" | "amicable" | "accidental" | "betrayal";

export interface Truce {
  id: string;
  kind: TruceKind;
  tributeIds: string[];

  createdRound: RoundReference;
  expiresAfterRound: RoundReference | null;
}

export type VendettaKind = "standard" | "romantic";

export interface Vendetta {
  id: string;

  hunterTributeId: string;
  targetTributeId: string;

  kind: VendettaKind;

  sourceEventId: string;
  createdRound: RoundReference;
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

  /**
   * Null represents reusable equipment.
   * A number represents the remaining uses
   * of a limited-use item.
   */
  usesRemaining: number | null;

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
    pronouns: PronounSetId;
    portraitUrl: string | null;
    portraitPosition?: PortraitPosition;
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

export interface UseInventoryItemChange {
  type: "use-item";

  tributeId: string;
  itemInstanceId: string;
  reason: string;
}

export interface TransferInventoryItemChange {
  type: "transfer-item";

  itemInstanceId: string;
  fromTributeId: string;
  toTributeId: string;

  reason: string;
}

export interface SoleVictoryOutcome {
  kind: "sole";
  victorTributeIds: [string];
  sourceEventId: string | null;
}

export interface JointVictoryOutcome {
  kind: "joint";
  victorTributeIds: [string, string];
  sourceEventId: string;
  reason: "poisonous-berries";
}

export type VictoryOutcome = SoleVictoryOutcome | JointVictoryOutcome;

export interface FormTruceChange {
  type: "form-truce";
  truce: Truce;
}

export interface BreakTruceChange {
  type: "break-truce";
  truceId: string;
  reason: TruceBreakReason;
}

export interface FormVendettaChange {
  type: "form-vendetta";
  vendetta: Vendetta;
}

export interface DeclareVictoryChange {
  type: "declare-victory";
  outcome: VictoryOutcome;
}

export type InventoryTransactionType = "acquired" | "consumed" | "transferred";

interface InventoryTransactionBase {
  id: string;
  type: InventoryTransactionType;

  /**
   * For acquisitions and consumption,
   * this is the tribute performing the
   * transaction.
   *
   * For transfers, this remains the new
   * owner for compatibility with existing
   * transaction consumers.
   */
  tributeId: string;

  itemInstanceId: string;
  definitionId: ItemDefinitionId;

  uses: number | null;
  round: RoundReference;
  sourceId: string;
}

export interface AcquiredInventoryTransaction extends InventoryTransactionBase {
  type: "acquired";
}

export interface ConsumedInventoryTransaction extends InventoryTransactionBase {
  type: "consumed";
  uses: number;
}

export interface TransferredInventoryTransaction extends InventoryTransactionBase {
  type: "transferred";

  fromTributeId: string;
  toTributeId: string;
}

export type InventoryTransaction =
  AcquiredInventoryTransaction | ConsumedInventoryTransaction | TransferredInventoryTransaction;

export type GameChange =
  | EliminateTributeChange
  | IncrementStatisticChange
  | ApplyStatusChange
  | RemoveStatusChange
  | AcquireInventoryItemChange
  | UseInventoryItemChange
  | ConsumeInventoryItemChange
  | TransferInventoryItemChange
  | FormTruceChange
  | BreakTruceChange
  | FormVendettaChange
  | DeclareVictoryChange;

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
  truces: Truce[];
  vendettas: Vendetta[];

  roundEvents: ResolvedEvent[];
  revealedEventCount: number;
  eventHistory: ResolvedEvent[];
  itemTransactions: InventoryTransaction[];

  victoryOutcome: VictoryOutcome | null;
  engine: EngineState;

  createdAt: string;
  updatedAt: string;
}
