import { getRoundSequence } from "~/game/engine/rounds";
import type {
  GameState,
  GameTribute,
  RoundReference,
  Truce,
  TruceKind,
} from "~/game/types/game-state";

import {
  canFormStandardTruce,
  canStandardTruceVoluntarilyEnd,
  getStandardTruceFormationTimingMultiplier,
} from "~/game/truces/truce-lifecycle";

export const STANDARD_TRUCE_END_DAY = 4;
export const STANDARD_TRUCE_MINIMUM_LIVING_COUNT = 6;

export const STANDARD_TRUCE_EXPIRY_ROUND = {
  day: STANDARD_TRUCE_END_DAY,
  period: "day",
} as const satisfies RoundReference;

/*
 * expiresAfterRound remains part of the persisted Truce shape for
 * backwards compatibility, but it no longer drives standard-truce
 * breakup. New lifecycle policy uses createdRound, population share,
 * and authored separation or betrayal events instead.
 *
 * Older catalogue definitions still pass the historical Day 4 marker.
 * When one of those definitions forms a late truce, preserve a valid
 * future metadata value rather than allowing the marker to point
 * before the truce's creation round.
 */
function createStandardTruceCompatibilityExpiryRound(createdRound: RoundReference): RoundReference {
  return {
    day: createdRound.day + 3,
    period: createdRound.period,
  };
}

export function canStandardTrucePersist(
  state: GameState,
  round: RoundReference | null = state.currentRound,
): boolean {
  if (round === null || getStandardTruceFormationTimingMultiplier(round) <= 0) {
    return false;
  }

  const livingTributeCount = state.tributes.filter((tribute) => tribute.isAlive).length;

  /*
   * Legacy day and night catalogue events use this helper only when
   * proposing a two-person standard truce. Preserve their API while
   * enforcing the same 30% formation cap as the dedicated formation
   * catalogue.
   */
  return canFormStandardTruce(2, livingTributeCount);
}

export function canStandardTruceEnd(
  state: GameState,
  round: RoundReference | null = state.currentRound,
  truce?: Truce,
): boolean {
  if (!round) {
    return false;
  }

  if (truce) {
    return canStandardTruceVoluntarilyEnd(truce, round);
  }

  return state.truces.some(
    (candidate) =>
      candidate.kind === "standard" && canStandardTruceVoluntarilyEnd(candidate, round),
  );
}

export function createTruceInstance(
  eventId: string,
  tributeIds: readonly string[],
  createdRound: RoundReference,
  expiresAfterRound: RoundReference | null,
  kind: TruceKind = "standard",
): Truce {
  if (tributeIds.length < 2) {
    throw new Error("A truce requires at least two tributes.");
  }

  if (new Set(tributeIds).size !== tributeIds.length) {
    throw new Error("A truce cannot contain duplicate tribute IDs.");
  }

  if (kind === "romantic" && tributeIds.length !== 2) {
    throw new Error("A romantic truce must contain exactly two tributes.");
  }

  if (kind === "romantic" && expiresAfterRound !== null) {
    throw new Error("A romantic truce cannot have an automatic expiry.");
  }

  if (kind === "standard" && expiresAfterRound === null) {
    throw new Error("A standard truce requires an expiry round.");
  }

  const normalizedExpiresAfterRound =
    kind === "standard" &&
    expiresAfterRound !== null &&
    getRoundSequence(expiresAfterRound) < getRoundSequence(createdRound)
      ? createStandardTruceCompatibilityExpiryRound(createdRound)
      : expiresAfterRound;

  return {
    id: `${eventId}:truce`,
    kind,
    tributeIds: [...tributeIds],

    createdRound: {
      ...createdRound,
    },

    expiresAfterRound: normalizedExpiresAfterRound
      ? {
          ...normalizedExpiresAfterRound,
        }
      : null,
  };
}

export function getActiveTruceForTribute(state: GameState, tributeId: string): Truce | null {
  return state.truces.find((truce) => truce.tributeIds.includes(tributeId)) ?? null;
}

export function areTributesInSameTruce(
  state: GameState,
  firstTributeId: string,
  secondTributeId: string,
): boolean {
  const truce = getActiveTruceForTribute(state, firstTributeId);

  return truce?.tributeIds.includes(secondTributeId) ?? false;
}

export function getLivingTruceMembers(state: GameState, truce: Truce): GameTribute[] {
  return truce.tributeIds.flatMap((tributeId) => {
    const tribute = state.tributes.find(
      (candidate) => candidate.id === tributeId && candidate.isAlive,
    );

    return tribute ? [tribute] : [];
  });
}

export function getTruceFormationPopulationMultiplier(
  _state: GameState,
  round: RoundReference | null = _state.currentRound,
): number {
  return round ? getStandardTruceFormationTimingMultiplier(round) : 1;
}
