import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { TributeStats, TributeStatValue } from "~/game/types/tribute";

export type ItemDefinitionId =
  | "water"
  | "medicine"
  | "blanket"
  | "matches"
  | "rope"
  | "knife"
  | "spear"
  | "bow"
  | "food"
  | "shield"
  | "axe"
  | "map"
  | "trap-kit"
  | "camouflage-net"
  | "fishing-gear"
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
  | GrantStatusItemEffect;

export interface ItemRestCapability {
  quality: "comfortable" | "sheltered";

  check?: {
    stat: "brains" | "luck";
    difficulty: TributeStatValue;
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
