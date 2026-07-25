import { getItemDefinition } from "~/game/items/item-catalogue";

import type { ItemDefinition } from "~/game/items/item-schema";

import { isItemUsableBy } from "~/game/items/item-usability";

import type { GameTribute, InventoryItem } from "~/game/types/game-state";

export interface SelectedDefense {
  item: InventoryItem;
  definition: ItemDefinition;
}

function compareDefenseSelections(first: SelectedDefense, second: SelectedDefense): number {
  const firstDefense = first.definition.defense;

  const secondDefense = second.definition.defense;

  if (!firstDefense || !secondDefense) {
    throw new Error("Cannot compare equipment without defense capabilities.");
  }

  /*
   * The largest checked-attack bonus is considered
   * the strongest ordinary defense.
   */
  const checkedAttackDifference =
    secondDefense.checkedAttackBonus - firstDefense.checkedAttackBonus;

  if (checkedAttackDifference !== 0) {
    return checkedAttackDifference;
  }

  /*
   * When checked bonuses match, the lower hostile
   * target multiplier is stronger.
   */
  const targetingDifference =
    firstDefense.hostileTargetWeightMultiplier - secondDefense.hostileTargetWeightMultiplier;

  if (targetingDifference !== 0) {
    return targetingDifference;
  }

  return (
    first.definition.id.localeCompare(second.definition.id) ||
    first.item.id.localeCompare(second.item.id)
  );
}

/**
 * Finds the strongest usable defense personally owned
 * by the tribute.
 *
 * Defensive equipment is never borrowed through a truce.
 */
export function getStrongestUsableDefense(tribute: GameTribute): SelectedDefense | null {
  const candidates = tribute.inventory.flatMap((item): SelectedDefense[] => {
    if (!isItemUsableBy(tribute, item)) {
      return [];
    }

    const definition = getItemDefinition(item.definitionId);

    if (!definition.defense) {
      return [];
    }

    return [
      {
        item,
        definition,
      },
    ];
  });

  return candidates.sort(compareDefenseSelections)[0] ?? null;
}

export function getCheckedAttackDefenseBonus(tribute: GameTribute): number {
  return getStrongestUsableDefense(tribute)?.definition.defense?.checkedAttackBonus ?? 0;
}

export function getDefenseTargetWeightMultiplier(tribute: GameTribute): number {
  return getStrongestUsableDefense(tribute)?.definition.defense?.hostileTargetWeightMultiplier ?? 1;
}
