import { getEffectiveStats } from "~/game/engine/effective-stats";

import type {
  EventCategory,
  EventItemSelection,
  EventSelectionContext,
} from "~/game/events/event-schema";

import { getItemDefinition } from "~/game/items/item-catalogue";

import { getNightAwarenessItemBonus } from "~/game/items/item-contextual-capabilities";

import { getInventoryBonus } from "~/game/items/inventory-engine";

import { isItemUsableBy } from "~/game/items/item-usability";

import { getStatusModifier } from "~/game/statuses/status-engine";

import type { GameTribute, InventoryItem, RoundReference } from "~/game/types/game-state";

/**
 * Computes combat ability from the tribute's own effective
 * stats and active statuses.
 *
 * Equipment is intentionally excluded.
 */
export function getBaseCombatScore(tribute: GameTribute): number {
  const { brains, brawn, luck } = getEffectiveStats(tribute);

  const baseScore = brawn * 0.55 + brains * 0.25 + luck * 0.2;

  return Math.max(
    0.25,

    baseScore + getStatusModifier(tribute, "combat"),
  );
}

/**
 * Returns the direct-combat bonus supplied by one exact
 * physical weapon when used by this tribute.
 *
 * Item usability is evaluated using the acting tribute's
 * effective stats, regardless of who owns the item.
 */
export function getDirectWeaponAttackBonus(tribute: GameTribute, item: InventoryItem): number {
  if (!isItemUsableBy(tribute, item)) {
    return 0;
  }

  const offense = getItemDefinition(item.definitionId).offense;

  if (offense?.strategy !== "direct") {
    return 0;
  }

  return offense.attackBonus;
}

/**
 * Used for general combat weighting outside a specific
 * attack event.
 *
 * Only the strongest usable owned direct weapon applies.
 * Carrying several weapons therefore does not stack them.
 */
export function getStrongestUsableDirectWeaponBonus(tribute: GameTribute): number {
  return tribute.inventory.reduce(
    (strongestBonus, item) =>
      Math.max(
        strongestBonus,

        getDirectWeaponAttackBonus(tribute, item),
      ),

    0,
  );
}

/**
 * General current combat strength.
 *
 * Used by:
 *
 * - attacker selection;
 * - Bloodbath combat weighting;
 * - theft strength comparisons;
 * - other non-event-specific combat calculations.
 *
 * This includes only the tribute's strongest usable owned
 * direct weapon.
 */
export function getCombatScore(tribute: GameTribute): number {
  return Math.max(
    0.25,

    getBaseCombatScore(tribute) + getStrongestUsableDirectWeaponBonus(tribute),
  );
}

/**
 * Computes attack strength for one actual selected weapon.
 *
 * Unlike getCombatScore(), this does not inspect every item
 * owned by the attacker. It uses only the item chosen during
 * participant selection.
 *
 * A borrowed weapon therefore contributes its own attack
 * bonus while the acting tribute supplies the stats.
 */
export function getSelectedDirectAttackScore(
  attacker: GameTribute,
  weapon: EventItemSelection,
): number {
  if (!isItemUsableBy(attacker, weapon.item)) {
    throw new Error(
      `Tribute "${attacker.id}" cannot use selected weapon ` + `"${weapon.item.definitionId}".`,
    );
  }

  const offense = getItemDefinition(weapon.item.definitionId).offense;

  if (offense?.strategy !== "direct") {
    throw new Error(`Item "${weapon.item.definitionId}" is not an ordinary direct-combat weapon.`);
  }

  return Math.max(
    0.25,

    getBaseCombatScore(attacker) + offense.attackBonus,
  );
}

export function getSurvivalScore(tribute: GameTribute): number {
  const { brains, brawn, luck } = getEffectiveStats(tribute);

  const baseScore = brains * 0.4 + brawn * 0.25 + luck * 0.35;

  return Math.max(
    0.25,

    baseScore +
      getInventoryBonus(tribute, "survivalBonus") +
      getStatusModifier(tribute, "survival"),
  );
}

export function getAwarenessScore(tribute: GameTribute, round?: RoundReference): number {
  const { brains, luck } = getEffectiveStats(tribute);

  const baseScore = brains * 0.65 + luck * 0.35;

  return Math.max(
    0.25,

    baseScore +
      getInventoryBonus(tribute, "awarenessBonus") +
      getNightAwarenessItemBonus(tribute, round) +
      getStatusModifier(tribute, "awareness"),
  );
}

export function getForagingScore(tribute: GameTribute): number {
  const { brains, brawn, luck } = getEffectiveStats(tribute);

  const baseScore = brains * 0.45 + luck * 0.4 + brawn * 0.15;

  return Math.max(
    0.25,

    baseScore +
      getInventoryBonus(tribute, "foragingBonus") +
      getStatusModifier(tribute, "foraging"),
  );
}

export function getVulnerabilityWeight(tribute: GameTribute): number {
  return Math.max(
    0.25,

    6 - getSurvivalScore(tribute),
  );
}

export function getCombatSelectionWeight(tribute: GameTribute): number {
  return getCombatScore(tribute);
}

export function getSurvivalSelectionWeight(tribute: GameTribute): number {
  return getSurvivalScore(tribute);
}

export function getEventCategoryMultiplier(
  category: EventCategory,
  livingTributeCount: number,
): number {
  if (category === "survival") {
    return 1;
  }

  if (category === "hazard") {
    return livingTributeCount <= 6 ? 1.2 : 1;
  }

  if (livingTributeCount <= 2) {
    return 3;
  }

  if (livingTributeCount <= 6) {
    return 2.2;
  }

  if (livingTributeCount <= 12) {
    return 1.5;
  }

  return 1.15;
}

export function getRoundEventTargetCount(livingTributeCount: number): number {
  return Math.min(
    6,

    Math.max(1, Math.ceil(livingTributeCount / 3)),
  );
}

export function getDefinitionPopulationMultiplier(context: EventSelectionContext): number {
  return context.livingTributes.length <= 4 ? 1.2 : 1;
}
