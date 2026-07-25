import { getEffectiveStats } from "~/game/engine/effective-stats";
import { getItemDefinition } from "~/game/items/item-catalogue";
import type { GameTribute, InventoryItem } from "~/game/types/game-state";
import type { TributeStats } from "~/game/types/tribute";
import type { ItemDefinitionId, ItemMinimumStats } from "~/game/items/item-schema";

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

function getMinimumStatRequirementReasons(
  tribute: GameTribute,
  minimumStats: ItemMinimumStats | undefined,
): string[] {
  const effectiveStats = getEffectiveStats(tribute);
  const reasons: string[] = [];

  for (const stat of ITEM_USABILITY_STATS) {
    const minimumValue = minimumStats?.[stat];

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

  return reasons;
}

export function getItemDefinitionUsability(
  tribute: GameTribute,
  itemDefinitionId: ItemDefinitionId,
): ItemUsability {
  const definition = getItemDefinition(itemDefinitionId);

  const reasons = getMinimumStatRequirementReasons(tribute, definition.minimumStats);

  return {
    usable: reasons.length === 0,
    reasons,
  };
}

export function isItemDefinitionUsableBy(
  tribute: GameTribute,
  itemDefinitionId: ItemDefinitionId,
): boolean {
  return getItemDefinitionUsability(tribute, itemDefinitionId).usable;
}

export function getItemUsability(tribute: GameTribute, item: InventoryItem): ItemUsability {
  const definition = getItemDefinition(item.definitionId);

  const reasons: string[] = [];

  if (item.usesRemaining !== null && item.usesRemaining <= 0) {
    reasons.push("No uses remain.");
  }

  reasons.push(...getMinimumStatRequirementReasons(tribute, definition.minimumStats));

  return {
    usable: reasons.length === 0,
    reasons,
  };
}

export function isItemUsableBy(tribute: GameTribute, item: InventoryItem): boolean {
  return getItemUsability(tribute, item).usable;
}
