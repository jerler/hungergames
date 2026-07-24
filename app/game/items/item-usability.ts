import { getEffectiveStats } from "~/game/engine/effective-stats";
import { getItemDefinition } from "~/game/items/item-catalogue";
import type { GameTribute, InventoryItem } from "~/game/types/game-state";
import type { TributeStats } from "~/game/types/tribute";

const ITEM_USABILITY_STATS = [
  "brains",
  "brawn",
  "luck",
] as const satisfies readonly (keyof TributeStats)[];

const STAT_LABELS = {
  brains: "Brains",
  brawn: "Brawn",
  luck: "Luck",
} satisfies Record<keyof TributeStats, string>;

export interface ItemUsability {
  usable: boolean;
  reasons: readonly string[];
}

/**
 * Determines whether the acting tribute can use one
 * exact physical item instance.
 *
 * Ownership is intentionally irrelevant here. Borrowed
 * items are evaluated using the acting tribute's stats.
 */
export function getItemUsability(tribute: GameTribute, item: InventoryItem): ItemUsability {
  const definition = getItemDefinition(item.definitionId);

  const reasons: string[] = [];

  if (item.usesRemaining !== null && item.usesRemaining <= 0) {
    reasons.push("No uses remain.");
  }

  const effectiveStats = getEffectiveStats(tribute);

  for (const stat of ITEM_USABILITY_STATS) {
    const minimumValue = definition.minimumStats?.[stat];

    if (minimumValue === undefined || effectiveStats[stat] >= minimumValue) {
      continue;
    }

    reasons.push(
      `Requires ${STAT_LABELS[stat]} ` +
        `${minimumValue}; ` +
        `${tribute.snapshot.name} has ` +
        `${effectiveStats[stat]}.`,
    );
  }

  return {
    usable: reasons.length === 0,
    reasons,
  };
}

export function isItemUsableBy(tribute: GameTribute, item: InventoryItem): boolean {
  return getItemUsability(tribute, item).usable;
}
