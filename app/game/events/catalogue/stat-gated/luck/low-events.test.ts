import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import type { RandomSource } from "~/game/engine/random";
import { EVENT_CATALOGUE } from "~/game/events/catalogue";
import type {
  EventDefinition,
  EventResolution,
  ParticipantSelectionContext,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";
import type { TributeStatValue } from "~/game/types/tribute";

import { LOW_LUCK_EVENTS } from "./low-events";

const ROUND = {
  day: 1,
  period: "day",
} as const;

function createTestGame(): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,

    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),

    "random",

    {
      createId: () => {
        nextId += 1;

        return `test-id-${nextId}`;
      },

      seed: "low-luck-event-tests",
      now: "2026-07-19T12:00:00.000Z",
    },
  );
}

function withLuck(tribute: GameTribute, luck: TributeStatValue, name: string): GameTribute {
  return {
    ...tribute,

    snapshot: {
      ...tribute.snapshot,
      name,

      stats: {
        ...tribute.snapshot.stats,
        luck,
      },
    },
  };
}

function requireLowLuckEvent(eventId: string): EventDefinition {
  const event = LOW_LUCK_EVENTS.find((candidate) => candidate.id === eventId);

  if (!event) {
    throw new Error(`Missing low-Luck event "${eventId}".`);
  }

  return event;
}

function createSequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;

  const fallback = values[values.length - 1] ?? 0.5;

  return () => {
    const value = values[index] ?? fallback;

    index += 1;

    return value;
  };
}

function resolveEvent(
  definition: EventDefinition,
  game: GameState,
  participantsByRole: ParticipantsByRole,
  randomValues: readonly number[],
): EventResolution {
  return definition.resolve({
    state: game,
    round: ROUND,

    livingTributes: game.tributes.filter((tribute) => tribute.isAlive),

    eventId: `test:${definition.id}`,

    random: createSequenceRandom(randomValues),

    participantsByRole,
  });
}

function getAcquiredItemIds(changes: EventResolution["changes"]): string[] {
  return changes.flatMap((change) =>
    change.type === "acquire-item" ? [change.item.definitionId] : [],
  );
}

describe("low-Luck events", () => {
  it("includes every low-Luck event in the main catalogue", () => {
    expect(LOW_LUCK_EVENTS.every((event) => EVENT_CATALOGUE.includes(event))).toBe(true);
  });

  it("only accepts tributes with low Luck", () => {
    const game = createTestGame();

    const unluckyTribute = withLuck(game.tributes[0], 1, "Murphy");

    const averageTribute = withLuck(game.tributes[1], 3, "Average");

    const context: ParticipantSelectionContext = {
      state: game,
      round: ROUND,
      livingTributes: game.tributes,
      participantsByRole: {},
    };

    const role = requireLowLuckEvent("runaway-vending-machine").roles[0];

    expect(role.isEligible?.(unluckyTribute, context)).toBe(true);

    expect(role.isEligible?.(averageTribute, context)).toBe(false);
  });

  it("injures a critically unlucky vending-machine tribute", () => {
    const game = createTestGame();

    const tribute = withLuck(game.tributes[0], 1, "Murphy");

    const resolution = resolveEvent(
      requireLowLuckEvent("runaway-vending-machine"),

      game,

      {
        tribute: [tribute],
      },

      [0.05],
    );

    expect(resolution.changes).toEqual([
      expect.objectContaining({
        type: "apply-status",
        tributeId: tribute.id,

        status: expect.objectContaining({
          definitionId: "injured",
          severity: 2,
        }),
      }),
    ]);
  });

  it("allows an unlucky vending-machine tribute to hit the jackpot", () => {
    const game = createTestGame();

    const tribute = withLuck(game.tributes[0], 2, "Murphy");

    const resolution = resolveEvent(
      requireLowLuckEvent("runaway-vending-machine"),

      game,

      {
        tribute: [tribute],
      },

      [0.95],
    );

    expect(getAcquiredItemIds(resolution.changes)).toEqual(["medicine", "matches"]);
  });
});
