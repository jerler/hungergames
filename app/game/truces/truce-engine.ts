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

export function getTruceFormationPopulationMultiplier(state: GameState): number {
  const livingCount = state.tributes.filter((tribute) => tribute.isAlive).length;

  if (livingCount <= 3) {
    return 0;
  }

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

function hasTruceExpired(truce: Truce, completedRound: RoundReference): boolean {
  if (!truce.expiresAfterRound) {
    return false;
  }

  return getRoundSequence(completedRound) >= getRoundSequence(truce.expiresAfterRound);
}

export function expireTrucesAfterRound(state: GameState): GameState {
  const completedRound = state.currentRound;

  if (!completedRound) {
    return state;
  }

  const expiredTruces = state.truces.filter((truce) => hasTruceExpired(truce, completedRound));

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
      id: `truce-expiry:` + `${completedRound.period}:` + `${completedRound.day}:` + truce.id,

      definitionId: "truce-expired",

      resolutionMode: "standard",

      round: {
        ...completedRound,
      },

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
