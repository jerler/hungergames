import type { GameTribute, RoundReference } from "~/game/types/game-state";

export const UNSHELTERED_NIGHT_TARGET_WEIGHT_MULTIPLIER = 1.5;

export interface NightRestTargetingContext {
  round: RoundReference;
  isHostileTarget: boolean;
  isEnvironmentalHazard: boolean;
}

function hasCurrentNightRest(tribute: GameTribute, round: RoundReference): boolean {
  const rest = tribute.survival.lastNightRest;

  return (
    round.period === "night" &&
    rest !== null &&
    rest.round.day === round.day &&
    rest.round.period === round.period
  );
}

/**
 * Unsheltered rest only changes participant
 * selection during the same night.
 *
 * It applies when the role represents:
 *
 * - an ordinary hostile target; or
 * - a participant in an environmental hazard.
 *
 * It does not affect neutral survival events,
 * daytime selection, stale rest results, or
 * already planned events.
 */
export function getNightRestTargetingWeightMultiplier(
  tribute: GameTribute,
  { round, isHostileTarget, isEnvironmentalHazard }: NightRestTargetingContext,
): number {
  if (!isHostileTarget && !isEnvironmentalHazard) {
    return 1;
  }

  if (!hasCurrentNightRest(tribute, round)) {
    return 1;
  }

  return tribute.survival.lastNightRest?.quality === "unsheltered"
    ? UNSHELTERED_NIGHT_TARGET_WEIGHT_MULTIPLIER
    : 1;
}
