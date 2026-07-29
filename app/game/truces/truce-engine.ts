import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { formatRoundLabel, getRoundSequence } from "~/game/engine/rounds";
import type {
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
  Truce,
  TruceKind,
} from "~/game/types/game-state";

import { createSeededRandom } from "~/game/engine/random";
import { createEvenTruceInventoryRedistributionChanges } from "~/game/truces/truce-inventory";

export const STANDARD_TRUCE_END_DAY = 4;
export const STANDARD_TRUCE_MINIMUM_LIVING_COUNT = 6;

export const STANDARD_TRUCE_EXPIRY_ROUND = {
  day: STANDARD_TRUCE_END_DAY,
  period: "day",
} as const satisfies RoundReference;

function getLivingTributeCount(state: GameState): number {
  return state.tributes.filter((tribute) => tribute.isAlive).length;
}

export function canStandardTrucePersist(
  state: GameState,
  round: RoundReference | null = state.currentRound,
): boolean {
  return (
    getLivingTributeCount(state) >= STANDARD_TRUCE_MINIMUM_LIVING_COUNT &&
    (round === null || round.day < STANDARD_TRUCE_END_DAY)
  );
}

export function canStandardTruceEnd(
  state: GameState,
  round: RoundReference | null = state.currentRound,
): boolean {
  return !canStandardTrucePersist(state, round);
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

  return {
    id: `${eventId}:truce`,
    kind,
    tributeIds: [...tributeIds],

    createdRound: {
      ...createdRound,
    },

    expiresAfterRound: expiresAfterRound
      ? {
          ...expiresAfterRound,
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
  state: GameState,
  round: RoundReference | null = state.currentRound,
): number {
  if (!canStandardTrucePersist(state, round)) {
    return 0;
  }

  const livingCount = getLivingTributeCount(state);
  const livingRatio = livingCount / state.tributes.length;

  if (livingRatio > 0.75) {
    return 1;
  }

  if (livingRatio > 0.5) {
    return 0.65;
  }

  if (livingRatio > 0.3) {
    return 0.25;
  }

  return 0.05;
}

function formatNameList(names: readonly string[]): string {
  if (names.length === 0) {
    return "Unknown tributes";
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ` + names[names.length - 1];
}

function hasTruceExpired(
  truce: Truce,
  completedRound: RoundReference,
  livingTributeCount: number,
): boolean {
  if (truce.kind !== "standard" || !truce.expiresAfterRound) {
    return false;
  }

  if (livingTributeCount < STANDARD_TRUCE_MINIMUM_LIVING_COUNT) {
    return true;
  }

  return getRoundSequence(completedRound) >= getRoundSequence(truce.expiresAfterRound);
}

export function expireTrucesAfterRound(state: GameState): GameState {
  const completedRound = state.currentRound;

  if (!completedRound) {
    return state;
  }

  const livingTributeCount = getLivingTributeCount(state);

  const expiredTruces = state.truces.filter((truce) =>
    hasTruceExpired(truce, completedRound, livingTributeCount),
  );

  if (expiredTruces.length === 0) {
    return state;
  }

  const expiryEvents: ResolvedEvent[] = expiredTruces.map((truce) => {
    const members = getLivingTruceMembers(state, truce);

    const names = members.map((tribute) => tribute.snapshot.name);

    const redistributionRandom = createSeededRandom(
      [state.seed, "truce-expiry", completedRound.period, completedRound.day, truce.id].join(":"),
    );

    const redistributionChanges = createEvenTruceInventoryRedistributionChanges(
      state,
      truce,
      redistributionRandom,
      "truce-expired-peacefully",
    );

    const text =
      `The temporary truce between ` +
      `${formatNameList(names)} expires ` +
      `peacefully after ` +
      `${formatRoundLabel(completedRound)}. ` +
      `They divide their remaining gear ` +
      `and go their separate ways.`;

    return {
      id: `truce-expiry:${completedRound.period}:${completedRound.day}:${truce.id}`,
      definitionId: "truce-expired",
      kind: "aftermath",
      resolutionMode: "standard",
      round: { ...completedRound },
      participantTributeIds: [...truce.tributeIds],
      text,
      changes: [
        ...redistributionChanges,
        {
          type: "break-truce",
          truceId: truce.id,
          reason: "expired",
        },
      ],
    };
  });

  let nextState = state;

  for (const expiryEvent of expiryEvents) {
    nextState = applyResolvedEvent(nextState, expiryEvent);
  }

  return {
    ...nextState,

    roundEvents: [...nextState.roundEvents, ...expiryEvents],

    revealedEventCount: nextState.revealedEventCount + expiryEvents.length,
  };
}
