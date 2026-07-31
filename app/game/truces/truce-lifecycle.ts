import { getRoundSequence } from "~/game/engine/rounds";
import type { GameState, RoundReference, Truce } from "~/game/types/game-state";

export const STANDARD_TRUCE_MAX_LIVING_SHARE = 0.3;

const FORMATION_TIMING_MULTIPLIERS = new Map<number, number>([
  [1, 1],
  [2, 0.9],
  [3, 0.65],
  [4, 0.15],
]);

const BREAKUP_AGE_MULTIPLIERS = new Map<number, number>([
  [0, 0],
  [1, 0.05],
  [2, 0.1],
  [3, 0.2],
  [4, 0.55],
  [5, 0.9],
  [6, 1.3],
]);

export function getLivingTributeCount(state: GameState): number {
  return state.tributes.filter((tribute) => tribute.isAlive).length;
}

export function getLivingTruceMemberCount(state: GameState, truce: Truce): number {
  const livingTributeIds = new Set(
    state.tributes.filter((tribute) => tribute.isAlive).map((tribute) => tribute.id),
  );

  return truce.tributeIds.filter((tributeId) => livingTributeIds.has(tributeId)).length;
}

export function getStandardTruceLivingShare(state: GameState, truce: Truce): number {
  const livingTributeCount = getLivingTributeCount(state);

  if (truce.kind !== "standard" || livingTributeCount === 0) {
    return 0;
  }

  return getLivingTruceMemberCount(state, truce) / livingTributeCount;
}

export function canFormStandardTruce(
  proposedGroupSize: number,
  livingTributeCount: number,
): boolean {
  if (proposedGroupSize < 2 || livingTributeCount < proposedGroupSize) {
    return false;
  }

  return proposedGroupSize / livingTributeCount <= STANDARD_TRUCE_MAX_LIVING_SHARE;
}

export function isStandardTruceOversized(state: GameState, truce: Truce): boolean {
  return (
    truce.kind === "standard" &&
    getStandardTruceLivingShare(state, truce) > STANDARD_TRUCE_MAX_LIVING_SHARE
  );
}

export function getOversizedStandardTruces(state: GameState): Truce[] {
  return state.truces
    .filter((truce) => truce.kind === "standard" && isStandardTruceOversized(state, truce))
    .sort(
      (first, second) =>
        getRoundSequence(first.createdRound) - getRoundSequence(second.createdRound) ||
        first.id.localeCompare(second.id),
    );
}

export function getStandardTruceAgeInRounds(truce: Truce, round: RoundReference): number {
  return Math.max(0, getRoundSequence(round) - getRoundSequence(truce.createdRound));
}

export function canStandardTruceVoluntarilyEnd(truce: Truce, round: RoundReference): boolean {
  return truce.kind === "standard" && getStandardTruceAgeInRounds(truce, round) > 0;
}

export function getStandardTruceBreakupAgeMultiplier(truce: Truce, round: RoundReference): number {
  const age = getStandardTruceAgeInRounds(truce, round);

  return BREAKUP_AGE_MULTIPLIERS.get(age) ?? (age >= 7 ? 1.75 : 0);
}

export function getStandardTruceBreakupEventMultiplier({
  state,
  round,
  groupSize,
}: {
  state: GameState;
  round: RoundReference;
  groupSize?: number;
}): number {
  const eligibleMultipliers = state.truces.flatMap((truce) => {
    if (
      truce.kind !== "standard" ||
      (groupSize !== undefined && truce.tributeIds.length !== groupSize) ||
      isStandardTruceOversized(state, truce) ||
      !canStandardTruceVoluntarilyEnd(truce, round)
    ) {
      return [];
    }

    return [getStandardTruceBreakupAgeMultiplier(truce, round)];
  });

  return eligibleMultipliers.length === 0 ? 0 : Math.max(...eligibleMultipliers);
}

export function getStandardTruceFormationTimingMultiplier(round: RoundReference): number {
  return FORMATION_TIMING_MULTIPLIERS.get(round.day) ?? 0.05;
}
