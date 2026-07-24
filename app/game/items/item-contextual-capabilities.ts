import { getItemDefinition } from "~/game/items/item-catalogue";
import { isItemUsableBy } from "~/game/items/item-usability";
import type { GameTribute, RoundReference } from "~/game/types/game-state";

export function getNightAwarenessItemBonus(tribute: GameTribute, round?: RoundReference): number {
  if (round?.period !== "night") {
    return 0;
  }

  return tribute.inventory.reduce((total, item) => {
    if (!isItemUsableBy(tribute, item)) {
      return total;
    }

    const definition = getItemDefinition(item.definitionId);

    return total + (definition.contextual?.nightAwarenessBonus ?? 0);
  }, 0);
}

export function getHostileDefenseItemBonus(tribute: GameTribute): number {
  return tribute.inventory.reduce((total, item) => {
    if (!isItemUsableBy(tribute, item)) {
      return total;
    }

    const definition = getItemDefinition(item.definitionId);

    return total + (definition.contextual?.hostileDefenseBonus ?? 0);
  }, 0);
}

export function getHostileItemTargetWeightMultiplier(tribute: GameTribute): number {
  return tribute.inventory.reduce((multiplier, item) => {
    if (!isItemUsableBy(tribute, item)) {
      return multiplier;
    }

    const definition = getItemDefinition(item.definitionId);

    return multiplier * (definition.contextual?.hostileTargetWeightMultiplier ?? 1);
  }, 1);
}
