import {
  createAttemptedKillChange,
  createEliminationChange,
  createKillCreditChange,
} from "~/game/events/event-change-builders";
import type {
  EventResolutionContext,
  EventSelectionProfile,
  EventSpecificityReason,
} from "~/game/events/event-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { isMedicalStatusId } from "~/game/statuses/medical-statuses";
import { getActiveTruceForTribute, getLivingTruceMembers } from "~/game/truces/truce-engine";
import type {
  GameChange,
  GameState,
  GameTribute,
  InventoryItem,
  Truce,
} from "~/game/types/game-state";

export const MELEE_WEAPON_IDS = [
  "knife",
  "spear",
  "axe",
  "short-sword",
  "rapier",
  "longsword",
  "greatsword",
  "pike",
  "trident",
  "hand-axe",
  "club",
  "warhammer",
] as const satisfies readonly ItemDefinitionId[];

export const TRUCE_EVENT_SIZES = [2, 3, 4, 5, 6] as const;
export type TruceEventSize = (typeof TRUCE_EVENT_SIZES)[number];

export function isLowBrawn(tribute: GameTribute): boolean {
  return tribute.snapshot.stats.brawn <= 2;
}

export function isHighBrawn(tribute: GameTribute): boolean {
  return tribute.snapshot.stats.brawn >= 4;
}

export function isLowBrains(tribute: GameTribute): boolean {
  return tribute.snapshot.stats.brains <= 2;
}

export function isHighBrains(tribute: GameTribute): boolean {
  return tribute.snapshot.stats.brains >= 4;
}

export function isLowLuck(tribute: GameTribute): boolean {
  return tribute.snapshot.stats.luck <= 2;
}

export function hasStatus(tribute: GameTribute, statusId: string): boolean {
  return tribute.statuses.some((status) => status.definitionId === statusId);
}

export function hasTreatableMedicalStatus(tribute: GameTribute): boolean {
  return tribute.statuses.some((status) => isMedicalStatusId(status.definitionId));
}

export function statSelectionProfile(
  specificityScore: number,
  additionalReasons: readonly EventSpecificityReason[] = [],
): EventSelectionProfile {
  return {
    specificityScore,
    specificityReasons: ["stat-requirement", ...additionalReasons],
  };
}

export function requireSelectedItem(
  context: EventResolutionContext,
  roleId: string,
): InventoryItem {
  const item = context.itemsByRole?.[roleId]?.[0]?.item;

  if (!item) {
    throw new Error(
      `Stat-gated event "${context.eventId}" is missing selected item role "${roleId}".`,
    );
  }

  return item;
}

export function getLowercaseItemLabel(item: InventoryItem): string {
  return getItemDefinition(item.definitionId).label.toLowerCase();
}

export function chooseTextVariant(
  random: EventResolutionContext["random"],
  variants: readonly string[],
): string {
  if (variants.length === 0) {
    throw new Error("Cannot choose from an empty text-variant list.");
  }

  const index = Math.min(variants.length - 1, Math.floor(random() * variants.length));

  return variants[index] ?? variants[0] ?? "";
}

export function createFatalWithoutLoot(
  victim: GameTribute,
  killer: GameTribute,
  causeId: string,
  causeLabel: string,
  summary: string,
): GameChange[] {
  return [
    createEliminationChange(victim, causeId, causeLabel, summary, [killer.id]),
    createAttemptedKillChange(killer),
    createKillCreditChange(killer),
  ];
}

export function getActiveTruceOfSize(
  state: GameState,
  tributeId: string,
  size: TruceEventSize,
): Truce | null {
  const truce = getActiveTruceForTribute(state, tributeId);

  /*
   * Stat-gated truce events using this helper are authored for temporary
   * standard truces. Romantic truces have their own permanent lifecycle
   * and may only end through accidental separation.
   */
  if (!truce || truce.kind !== "standard") {
    return null;
  }

  return getLivingTruceMembers(state, truce).length === size ? truce : null;
}

export function getParticipantShapeForSize(
  size: TruceEventSize,
): "pair" | "trio" | "group-four-plus" {
  if (size === 2) {
    return "pair";
  }

  if (size === 3) {
    return "trio";
  }

  return "group-four-plus";
}
