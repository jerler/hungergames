import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { SurvivalNeed } from "~/game/survival/survival-schema";
import type { TributeStats, TributeStatValue } from "~/game/types/tribute";

export type ItemDefinitionId =
  // Persistent survival supplies
  | "cornucopia-provisions"

  // Status-effect consumables
  | "burger-and-fries"
  | "coffee"
  | "coca-cola"
  | "energy-drink"
  | "hot-chocolate"
  | "herbal-tea"

  // Harmful natural forage
  | "hallucinogenic-berries"
  | "poison-berries"
  | "hallucinogenic-mushrooms"
  | "poison-mushrooms"

  // Natural utility
  | "kindling"

  // Medical supplies
  | "med-kit"
  | "bandages"
  | "painkillers"
  | "burn-kit"
  | "antidote"

  // Comfort
  | "blanket"
  | "sleeping-bag"
  | "thermal-blanket"
  | "pillow"

  // Shelter and fire
  | "tarp"
  | "tent"
  | "matches"
  | "lighter"
  | "flint-stone"

  // Navigation and utility
  | "map"
  | "foraging-guidebook"
  | "bird-whistle"
  | "binoculars"
  | "camouflage-net"
  | "camouflage-paint"
  | "night-vision-goggles"
  | "trap-kit"
  | "fishing-gear"

  // Equipment
  | "knife"
  | "spear"
  | "bow"
  | "shield"
  | "axe"
  | "slingshot"
  | "short-sword"
  | "rapier"
  | "longsword"
  | "greatsword"
  | "pike"
  | "trident"
  | "longbow"
  | "crossbow"
  | "blowgun"
  | "hand-axe"
  | "club"
  | "warhammer"
  | "poison-vial"
  | "bear-trap"
  | "tripwire"
  | "firebomb"
  | "helmet"
  | "padded-armour"
  | "reinforced-armour";

export const PERSISTENT_NATURAL_RESOURCE_ITEM_IDS = [
  "hallucinogenic-berries",
  "poison-berries",
  "hallucinogenic-mushrooms",
  "poison-mushrooms",
  "kindling",
] as const satisfies readonly ItemDefinitionId[];

export type PersistentNaturalResourceItemId = (typeof PERSISTENT_NATURAL_RESOURCE_ITEM_IDS)[number];

const PERSISTENT_NATURAL_RESOURCE_ITEM_ID_SET = new Set<string>(
  PERSISTENT_NATURAL_RESOURCE_ITEM_IDS,
);

export function isPersistentNaturalResourceItemId(
  value: unknown,
): value is PersistentNaturalResourceItemId {
  return typeof value === "string" && PERSISTENT_NATURAL_RESOURCE_ITEM_ID_SET.has(value);
}

export type ItemOrigin = "natural-resource" | "manufactured";

export type ItemAcquisitionSource = "cornucopia" | "natural-foraging" | "sponsor";

export const ITEM_TAGS = [
  "consumable",
  "provisions",
  "medicine",
  "shelter",
  "comfort",
  "fire",
  "tool",
  "weapon",
  "direct-weapon",
  "tactical",
  "defense",
  "navigation",
  "trap",
  "camouflage",
  "hunting",
  "fishing",
] as const;
export type ItemTag = (typeof ITEM_TAGS)[number];

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

export type ItemOffenseCapability =
  | {
      strategy: "direct";
      attackBonus: number;
    }
  | {
      strategy: "poison" | "trap" | "risky-area";
    };

export interface ItemDefenseCapability {
  /**
   * Added to the defender's score during a checked attack.
   */
  checkedAttackBonus: number;

  /**
   * Multiplies the tribute's hostile-target selection weight.
   *
   * Lower values make the tribute less likely to be selected.
   */
  hostileTargetWeightMultiplier: number;
}

export interface ItemContextualCapabilities {
  nightAwarenessBonus?: number;

  /**
   * Multiplies hostile target-selection weight only
   * during a night event tagged as an ambush.
   */
  nightAmbushTargetWeightMultiplier?: number;
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

  offense?: ItemOffenseCapability;
  defense?: ItemDefenseCapability;

  survivalBonus?: number;
  awarenessBonus?: number;
  foragingBonus?: number;

  deprivationProtection?: readonly SurvivalNeed[];

  useEffects?: readonly ItemUseEffect[];

  rest?: ItemRestCapability;

  contextual?: ItemContextualCapabilities;
}
