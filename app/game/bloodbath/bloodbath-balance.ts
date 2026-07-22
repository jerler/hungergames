import type { RandomSource } from "~/game/engine/random";
import type { GameChange } from "~/game/types/game-state";

/*
 * This is the sequencer's planning target, not a guaranteed
 * final death rate.
 *
 * It is slightly higher than the desired 45–50% observed
 * fatality rate because:
 *
 * - some Cornucopia entrants flee their individual conflict;
 * - some conflict outcomes are nonfatal;
 * - the Cornucopia quota may not contain enough participants
 *   to reach the target;
 * - the sequencer never rerolls an outcome merely to add deaths.
 */
const MIN_PLANNED_FATALITY_PROPORTION = 0.48;
const MAX_PLANNED_FATALITY_PROPORTION = 0.54;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Determines a seeded soft fatality target for the Bloodbath.
 *
 * Averaging two random values produces a central tendency while
 * preserving quieter and more violent tails.
 */
export function determineBloodbathFatalityTarget(
  startingTributeCount: number,
  random: RandomSource,
): number {
  if (!Number.isInteger(startingTributeCount) || startingTributeCount < 2) {
    throw new Error("Bloodbath fatality planning requires at least two tributes.");
  }

  const centeredRandom = (random() + random()) / 2;

  const plannedProportion =
    MIN_PLANNED_FATALITY_PROPORTION +
    centeredRandom * (MAX_PLANNED_FATALITY_PROPORTION - MIN_PLANNED_FATALITY_PROPORTION);

  return clamp(
    Math.round(startingTributeCount * plannedProportion),

    1,

    /*
     * The Bloodbath may never plan to eliminate
     * the complete starting roster.
     */
    startingTributeCount - 1,
  );
}

export function countPlannedEliminations(changes: readonly GameChange[]): number {
  return changes.filter((change) => change.type === "eliminate-tribute").length;
}
