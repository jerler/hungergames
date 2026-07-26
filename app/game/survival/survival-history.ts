import { getRoundSequence } from "~/game/engine/rounds";
import type { GameTribute, RoundReference } from "~/game/types/game-state";
import { hasDeprivationProtection } from "~/game/items/deprivation-protection";

import type { SurvivalNeed } from "./survival-schema";

export const DEPRIVATION_THRESHOLD_ROUNDS = 4;

type DeprivationStatusId = "hungry" | "thirsty";

function getDeprivationStatusId(need: SurvivalNeed): DeprivationStatusId {
  return need === "food" ? "hungry" : "thirsty";
}

/**
 * Returns the number of arena rounds that have fully completed
 * before the supplied round begins.
 */
export function getCompletedRoundSequenceBefore(round: RoundReference): number {
  return Math.max(0, getRoundSequence(round) - 1);
}

export function getLastFoundNeedRound(
  tribute: GameTribute,
  need: SurvivalNeed,
): RoundReference | null {
  return need === "food"
    ? tribute.survival.lastFoundFoodRound
    : tribute.survival.lastFoundWaterRound;
}

export function hasSatisfiedNeedInArena(tribute: GameTribute, need: SurvivalNeed): boolean {
  return getLastFoundNeedRound(tribute, need) !== null;
}

/**
 * Arena entry is sequence zero. A null last-found round therefore
 * means the tribute has gone without the resource since entering.
 *
 * Only fully completed rounds count. A resource obtained during the
 * current event cannot make the tribute overdue within that same round.
 */
export function getRoundsSinceNeedSatisfied(
  currentRound: RoundReference,
  lastFoundRound: RoundReference | null,
): number {
  const completedBeforeCurrentRound = getCompletedRoundSequenceBefore(currentRound);

  const lastSatisfiedSequence = lastFoundRound ? getRoundSequence(lastFoundRound) : 0;

  return Math.max(0, completedBeforeCurrentRound - lastSatisfiedSequence);
}

/**
 * The round is explicit because round preparation and event sequencing
 * operate on the upcoming round before GameState.currentRound advances.
 */
export function qualifiesForDeprivationEvent(
  round: RoundReference,
  tribute: GameTribute,
  need: SurvivalNeed,
): boolean {
  if (!tribute.isAlive) {
    return false;
  }

  const statusId = getDeprivationStatusId(need);

  if (tribute.statuses.some((status) => status.definitionId === statusId)) {
    return false;
  }

  return (
    getRoundsSinceNeedSatisfied(round, getLastFoundNeedRound(tribute, need)) >=
    DEPRIVATION_THRESHOLD_ROUNDS
  );
}

export function canReceiveDeprivationStatus(tribute: GameTribute, need: SurvivalNeed): boolean {
  return tribute.isAlive && !hasDeprivationProtection(tribute, need);
}

export function isEligibleForDeprivationStatusEvent(
  round: RoundReference,
  tribute: GameTribute,
  need: SurvivalNeed,
): boolean {
  return (
    canReceiveDeprivationStatus(tribute, need) && qualifiesForDeprivationEvent(round, tribute, need)
  );
}

export function qualifiesForHungerEvent(round: RoundReference, tribute: GameTribute): boolean {
  return qualifiesForDeprivationEvent(round, tribute, "food");
}

export function qualifiesForThirstEvent(round: RoundReference, tribute: GameTribute): boolean {
  return qualifiesForDeprivationEvent(round, tribute, "water");
}
