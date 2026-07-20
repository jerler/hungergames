import { describe, expect, it } from "vitest";

import type {
  EventDefinition,
  EventResolution,
  ParticipantSelectionContext,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { EVENT_CATALOGUE } from "~/game/events/event-catalogue";
import { LUCK_EVENTS } from "~/game/events/luck-events";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import type { RandomSource } from "~/game/engine/random";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";
import type { TributeStatValue } from "~/game/types/tribute";

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
      seed: "luck-event-tests",
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

function requireLuckEvent(eventId: string): EventDefinition {
  const event = LUCK_EVENTS.find((candidate) => candidate.id === eventId);

  if (!event) {
    throw new Error(`Missing Luck event "${eventId}".`);
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
) {
  const livingTributes = Object.values(participantsByRole).flat();

  return definition.resolve({
    state: game,
    round: ROUND,
    livingTributes,
    eventId: `test:${definition.id}`,
    random: createSequenceRandom(randomValues),
    participantsByRole,
  });
}

function getAcquiredItemIds(changes: EventResolution["changes"]) {
  return changes.flatMap((change) =>
    change.type === "acquire-item" ? [change.item.definitionId] : [],
  );
}

describe("Luck events", () => {
  it("is included in the main event catalogue", () => {
    expect(LUCK_EVENTS.every((event) => EVENT_CATALOGUE.includes(event))).toBe(true);
  });

  it("restricts high- and low-Luck events", () => {
    const game = createTestGame();

    const luckyTribute = withLuck(game.tributes[0], 5, "Fortuna");

    const averageTribute = withLuck(game.tributes[1], 3, "Average");

    const unluckyTribute = withLuck(game.tributes[2], 1, "Murphy");

    const context: ParticipantSelectionContext = {
      state: game,

      round: {
        day: 1,
        period: "day",
      },

      livingTributes: game.tributes,

      participantsByRole: {},
    };

    const sponsorRole = requireLuckEvent("sponsor-drone-malfunction").roles[0];

    const vendingRole = requireLuckEvent("runaway-vending-machine").roles[0];

    expect(sponsorRole.isEligible?.(luckyTribute, context)).toBe(true);

    expect(sponsorRole.isEligible?.(averageTribute, context)).toBe(false);

    expect(vendingRole.isEligible?.(unluckyTribute, context)).toBe(true);

    expect(vendingRole.isEligible?.(averageTribute, context)).toBe(false);
  });

  it("gives an exceptionally lucky tribute a sponsor jackpot", () => {
    const game = createTestGame();

    const tribute = withLuck(game.tributes[0], 4, "Fortuna");

    const resolution = resolveEvent(
      requireLuckEvent("sponsor-drone-malfunction"),
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

  it("injures a critically unlucky vending-machine tribute", () => {
    const game = createTestGame();

    const tribute = withLuck(game.tributes[0], 1, "Murphy");

    const resolution = resolveEvent(
      requireLuckEvent("runaway-vending-machine"),
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
      requireLuckEvent("runaway-vending-machine"),
      game,
      {
        tribute: [tribute],
      },
      [0.95],
    );

    expect(getAcquiredItemIds(resolution.changes)).toEqual(["medicine", "matches"]);
  });

  it("resolves each prize-crate participant independently", () => {
    const game = createTestGame();

    const luckyTribute = withLuck(game.tributes[0], 5, "Fortuna");

    const unluckyTribute = withLuck(game.tributes[1], 1, "Murphy");

    const resolution = resolveEvent(
      requireLuckEvent("capitol-prize-crate"),
      game,
      {
        tributes: [luckyTribute, unluckyTribute],
      },
      [0.6, 0.05, 0],
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "acquire-item",
        tributeId: luckyTribute.id,
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: unluckyTribute.id,
        status: expect.objectContaining({
          definitionId: "injured",
        }),
      }),
    );
  });
});
