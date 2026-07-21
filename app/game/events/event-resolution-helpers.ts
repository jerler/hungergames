import type { RandomSource } from "~/game/engine/random";
import {
  resolveStatCheck,
  type EventStat,
  type StatCheckOutcome,
} from "~/game/events/event-outcomes";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { findUsableInventoryItem } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { GameTribute, InventoryItem } from "~/game/types/game-state";
import type { TributeStatValue } from "~/game/types/tribute";

export function clampStatCheckDifficulty(difficulty: number): TributeStatValue {
  return Math.max(1, Math.min(5, Math.round(difficulty))) as TributeStatValue;
}

function getLuckDifficultyAdjustment(luck: TributeStatValue): number {
  if (luck >= 4) {
    return -1;
  }

  if (luck <= 2) {
    return 1;
  }

  return 0;
}

export function resolveLuckAdjustedStatCheck(
  tribute: GameTribute,
  stat: EventStat,
  baseDifficulty: TributeStatValue,
  random: RandomSource,
  difficultyReduction = 0,
): StatCheckOutcome {
  const difficulty = clampStatCheckDifficulty(
    baseDifficulty + getLuckDifficultyAdjustment(tribute.snapshot.stats.luck) - difficultyReduction,
  );

  return resolveStatCheck({
    stats: tribute.snapshot.stats,
    stat,
    difficulty,
    random,
  });
}

export function getItemLabel(itemId: ItemDefinitionId): string {
  return getItemDefinition(itemId).label.toLowerCase();
}

export function requireEventItem(
  tribute: GameTribute,
  itemId: ItemDefinitionId,
  eventId: string,
): InventoryItem {
  const item = findUsableInventoryItem(tribute, {
    definitionIds: [itemId],
  });

  if (!item) {
    throw new Error(
      `Event "${eventId}" selected tribute ` +
        `"${tribute.id}" without a usable ` +
        `"${itemId}" item.`,
    );
  }

  return item;
}
