import type { EventCategory, EventSelectionContext } from "~/game/events/event-schema";
import type { GameTribute } from "~/game/types/game-state";

export function getCombatScore(tribute: GameTribute): number {
  const { brains, brawn, luck } = tribute.snapshot.stats;

  return brawn * 0.55 + brains * 0.25 + luck * 0.2;
}

export function getSurvivalScore(tribute: GameTribute): number {
  const { brains, brawn, luck } = tribute.snapshot.stats;

  return brains * 0.4 + brawn * 0.25 + luck * 0.35;
}

export function getAwarenessScore(tribute: GameTribute): number {
  const { brains, luck } = tribute.snapshot.stats;

  return brains * 0.65 + luck * 0.35;
}

export function getForagingScore(tribute: GameTribute): number {
  const { brains, brawn, luck } = tribute.snapshot.stats;

  return brains * 0.45 + luck * 0.4 + brawn * 0.15;
}

export function getVulnerabilityWeight(tribute: GameTribute): number {
  return Math.max(0.25, 6 - getSurvivalScore(tribute));
}

export function getCombatSelectionWeight(tribute: GameTribute): number {
  return Math.max(0.25, getCombatScore(tribute));
}

export function getSurvivalSelectionWeight(tribute: GameTribute): number {
  return Math.max(0.25, getSurvivalScore(tribute));
}

export function getEventCategoryMultiplier(
  category: EventCategory,
  livingTributeCount: number,
): number {
  if (category === "survival") {
    return 1;
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
