import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { TributeStats, TributeStatValue } from "~/game/types/tribute";

export type ItemDefinitionId =
  // Natural resources
  | "water"
  | "food"

  // Manufactured food and drinks
  | "soup"
  | "burger-and-fries"
  | "pizza-box"
  | "bottled-water"
  | "coffee"
  | "coca-cola"
  | "energy-drink"
  | "hot-chocolate"
  | "herbal-tea"

  // Medical supplies
  | "med-kit"
  | "bandages"
  | "painkillers"
  | "burn-kit"
  | "antidote"

  // Shelter and utility
  | "blanket"
  | "matches"
  | "rope"
  | "map"
  | "trap-kit"
  | "camouflage-net"
  | "fishing-gear"

  // Equipment
  | "knife"
  | "spear"
  | "bow"
  | "shield"
  | "axe"
  | "slingshot";

export type ItemOrigin = "natural-resource" | "manufactured";

export type ItemAcquisitionSource = "cornucopia" | "natural-foraging" | "sponsor";

export const ITEM_TAGS = [
  "consumable",
  "water",
  "food",
  "medicine",
  "shelter",
  "comfort",
  "fire",
  "tool",
  "weapon",
  "defense",
  "navigation",
  "trap",
  "camouflage",
  "hunting",
  "fishing",
] as const;
export type ItemTag = (typeof ITEM_TAGS)[number];

export type ItemUseNeed = "food" | "hydration";

export interface SatisfyNeedItemEffect {
  type: "satisfy-need";
  need: ItemUseNeed;
}

export interface RemoveStatusItemEffect {
  type: "remove-status";
  statusIds: readonly StatusEffectId[];
}

export interface RemoveMedicalStatusesItemEffect {
  type: "remove-medical-statuses";
}

export interface ChanceToGrantStatusItemEffect {
  type: "chance-to-grant-status";

  statusId: StatusEffectId;
  severity: 1 | 2 | 3;

  /**
   * Inclusive lower bound, exclusive upper bound:
   *
   * random() < chance
   */
  chance: number;

  durationRounds?: number;
}

export interface GrantStatusItemEffect {
  type: "grant-status";
  statusId: StatusEffectId;
  severity: 1 | 2 | 3;
  durationRounds?: number;
}

export type ItemUseEffect =
  | SatisfyNeedItemEffect
  | RemoveStatusItemEffect
  | RemoveMedicalStatusesItemEffect
  | GrantStatusItemEffect
  | ChanceToGrantStatusItemEffect;

export type ItemRestCheckStat = "brains" | "luck" | "brains-or-luck";

export interface ItemRestCriticalFailureStatus {
  statusId: StatusEffectId;
  severity: 1 | 2 | 3;
  durationRounds?: number;
}

export interface ItemRestCapability {
  quality: "comfortable" | "sheltered";

  check?: {
    stat: ItemRestCheckStat;
    difficulty: TributeStatValue;

    criticalFailureStatus?: ItemRestCriticalFailureStatus;
  };
}

export interface ItemContextualCapabilities {
  nightAwarenessBonus?: number;
  hostileDefenseBonus?: number;
  hostileTargetWeightMultiplier?: number;
}

export type ItemMinimumStats = Partial<Record<keyof TributeStats, TributeStatValue>>;

export interface ItemDefinition {
  id: ItemDefinitionId;
  label: string;
  description: string;

  origin: ItemOrigin;
  tags: readonly ItemTag[];

  maxUses?: number;

  minimumStats?: ItemMinimumStats;

  combatBonus?: number;
  survivalBonus?: number;
  awarenessBonus?: number;
  foragingBonus?: number;

  useEffects?: readonly ItemUseEffect[];

  rest?: ItemRestCapability;

  contextual?: ItemContextualCapabilities;
}
