import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import type { RandomSource } from "~/game/engine/random";
import { EVENT_CATALOGUE } from "~/game/events/catalogue";
import type {
  EventDefinition,
  EventResolution,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";
import type { TributeStatValue } from "~/game/types/tribute";

import { HIGH_LUCK_EVENTS } from "./high-events";

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

      seed: "high-luck-event-tests",
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

function requireHighLuckEvent(eventId: string): EventDefinition {
  const event = HIGH_LUCK_EVENTS.find((candidate) => candidate.id === eventId);

  if (!event) {
    throw new Error(`Missing high-Luck event "${eventId}".`);
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

describe("high-Luck events", () => {
  it("includes every high-Luck event in the main catalogue", () => {
    expect(HIGH_LUCK_EVENTS.every((event) => EVENT_CATALOGUE.includes(event))).toBe(true);
  });

  it("only accepts tributes with high Luck", () => {
    const game = createTestGame();

    const luckyTribute = withLuck(game.tributes[0], 5, "Fortuna");

    const averageTribute = withLuck(game.tributes[1], 3, "Average");

    for (const event of HIGH_LUCK_EVENTS) {
      const role = event.roles[0];

      expect(role.isEligible?.(luckyTribute)).toBe(true);

      expect(role.isEligible?.(averageTribute)).toBe(false);
    }
  });

  it("gives an exceptionally lucky tribute a sponsor jackpot", () => {
    const game = createTestGame();

    const tribute = withLuck(game.tributes[0], 4, "Fortuna");

    const resolution = resolveEvent(
      requireHighLuckEvent("sponsor-drone-malfunction"),

      game,

      {
        tribute: [tribute],
      },

      [0.95],
    );

    expect(getAcquiredItemIds(resolution.changes)).toEqual(["medicine", "bow"]);

    expect(resolution.changes).toContainEqual({
      type: "increment-statistic",
      tributeId: tribute.id,
      statistic: "giftsReceived",
      amount: 2,
    });
  });

  it("applies inspired after an exceptional pep talk", () => {
    const game = createTestGame();

    const tribute = withLuck(game.tributes[0], 5, "Fortuna");

    const resolution = resolveEvent(
      requireHighLuckEvent("unexpected-pep-talk"),

      game,

      {
        tribute: [tribute],
      },

      [0.999],
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: tribute.id,

        status: expect.objectContaining({
          definitionId: "inspired",
          severity: 2,
        }),
      }),
    );
  });
});
