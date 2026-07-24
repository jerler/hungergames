import { getEffectiveStats } from "~/game/engine/effective-stats";
import type { RandomSource } from "~/game/engine/random";
import { resolveScoreCheck, type StatCheckOutcome } from "~/game/events/event-outcomes";
import type { GameTribute } from "~/game/types/game-state";

export const NATURAL_SHELTER_DIFFICULTY = 3;

/**
 * Natural shelter primarily rewards planning and
 * environmental awareness.
 *
 * Brains: 45%
 * Luck:   40%
 * Brawn:  15%
 */
export function getNaturalShelterScore(tribute: GameTribute): number {
  const { brains, brawn, luck } = getEffectiveStats(tribute);

  return brains * 0.45 + luck * 0.4 + brawn * 0.15;
}

export function resolveNaturalShelterCheck(
  tribute: GameTribute,
  random: RandomSource,
): StatCheckOutcome {
  return resolveScoreCheck({
    score: getNaturalShelterScore(tribute),

    difficulty: NATURAL_SHELTER_DIFFICULTY,

    random,
  });
}
