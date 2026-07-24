import type { EventCategory, EventSelectionContext } from "~/game/events/event-schema";
import { getInventoryBonus } from "~/game/items/inventory-engine";
import { getStatusModifier } from "~/game/statuses/status-engine";
import type { GameTribute } from "~/game/types/game-state";
import { getEffectiveStats } from "~/game/engine/effective-stats";
import { getNightAwarenessItemBonus } from "~/game/items/item-contextual-capabilities";
import type { RoundReference } from "~/game/types/game-state";

export function getCombatScore(tribute: GameTribute): number {
  const { brains, brawn, luck } = getEffectiveStats(tribute);

  const baseScore = brawn * 0.55 + brains * 0.25 + luck * 0.2;

  return Math.max(
    0.25,
    baseScore + getInventoryBonus(tribute, "combatBonus") + getStatusModifier(tribute, "combat"),
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
  return Math.max(0.25, 6 - getSurvivalScore(tribute));
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
  return Math.min(6, Math.max(1, Math.ceil(livingTributeCount / 3)));
}

export function getDefinitionPopulationMultiplier(context: EventSelectionContext): number {
  return context.livingTributes.length <= 4 ? 1.2 : 1;
}
