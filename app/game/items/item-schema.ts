import type { StatusEffectId } from "~/game/statuses/status-schema";

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

export type ItemTag =
  | "consumable"
  | "water"
  | "food"
  | "medicine"
  | "shelter"
  | "fire"
  | "tool"
  | "weapon"
  | "defense"
  | "navigation"
  | "trap"
  | "camouflage"
  | "hunting"
  | "fishing";

export interface ItemTreatment {
  statusId: StatusEffectId;
  severityReduction: number;
  durationReduction: number;
  priority: number;
}

export interface ItemDefinition {
  id: ItemDefinitionId;
  label: string;
  description: string;

  origin: ItemOrigin;
  tags: readonly ItemTag[];

  maxUses?: number;

  combatBonus?: number;
  survivalBonus?: number;
  awarenessBonus?: number;
  foragingBonus?: number;

  treatments?: readonly ItemTreatment[];
}
