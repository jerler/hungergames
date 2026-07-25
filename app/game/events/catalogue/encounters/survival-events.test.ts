import { describe, expect, it } from "vitest";

import type {
  EventDefinition,
  EventResolution,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { RandomSource } from "~/game/engine/random";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";
import type { TributeStats } from "~/game/types/tribute";
import { SURVIVAL_EVENTS } from "./survival-events";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { getSurvivalSelectionWeight } from "~/game/engine/stat-formulas";

const ROUND = {
  day: 1,
  period: "day",
} as const;

const BALANCED_STATS = {
  brains: 3,
  brawn: 3,
  luck: 3,
} satisfies TributeStats;

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
      seed: "survival-events-tests",
      now: "2026-07-19T12:00:00.000Z",
    },
  );
}

function withStats(
  tribute: GameTribute,
  stats: TributeStats,
  name = tribute.snapshot.name,
): GameTribute {
  return {
    ...tribute,

    snapshot: {
      ...tribute.snapshot,
      name,
      stats,
    },
  };
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

function requireEvent(eventId: string): EventDefinition {
  const definition = SURVIVAL_EVENTS.find((candidate) => candidate.id === eventId);

  if (!definition) {
    throw new Error(`Missing survival event "${eventId}".`);
  }

  return definition;
}

function resolveEvent(
  definition: EventDefinition,
  game: GameState,
  participantsByRole: ParticipantsByRole,
  randomValues: readonly number[],
): EventResolution {
  const livingTributes = Object.values(participantsByRole).flat();

  const selection = selectEventParticipants(
    definition,
    {
      state: game,
      round: ROUND,
      livingTributes,
    },
    () => 0,
    new Set(),
    new Set(),
  );

  return definition.resolve({
    state: game,
    round: ROUND,

    livingTributes,

    eventId: `test:${definition.id}`,

    random: createSequenceRandom(randomValues),

    participantsByRole,

    itemsByRole: selection?.itemsByRole,

    unavailableItemInstanceIds: new Set(),
  });
}

function getAppliedStatuses(resolution: EventResolution) {
  return resolution.changes.flatMap((change) =>
    change.type === "apply-status" ? [change.status] : [],
  );
}

describe("survival events", () => {
  it("applies disoriented after a critical map failure", () => {
    const originalGame = createTestGame();

    const originalTribute = withStats(originalGame.tributes[0], BALANCED_STATS);

    const map = createInventoryItemInstance("map-test-setup", originalTribute.id, "map", ROUND);

    const tribute = {
      ...originalTribute,
      inventory: [map],
    };

    const game: GameState = {
      ...originalGame,

      tributes: originalGame.tributes.map((candidate) =>
        candidate.id === tribute.id ? tribute : candidate,
      ),
    };

    const resolution = resolveEvent(
      requireEvent("upside-down-map"),
      game,
      {
        tribute: [tribute],
      },
      [0],
    );

    expect(getAppliedStatuses(resolution)).toEqual([
      expect.objectContaining({
        definitionId: "disoriented",
        severity: 2,
      }),
    ]);

    expect(resolution.changes).toContainEqual({
      type: "consume-item",

      tributeId: tribute.id,

      itemInstanceId: map.id,

      uses: 1,

      reason: "upside-down-map",
    });
  });

  it.each([
    {
      randomValue: 0,
      expectedItemId: "wild-fruit",
      expectedTextFragment: "gathers enough for a meal",
    },
    {
      randomValue: 0.999,
      expectedItemId: "water",
      expectedTextFragment: "collects water",
    },
  ] as const)(
    "forages-for-resources gathers $expectedItemId",
    ({ randomValue, expectedItemId, expectedTextFragment }) => {
      const game = createTestGame();
      const tribute = withStats(game.tributes[0], BALANCED_STATS);

      const resolution = resolveEvent(
        requireEvent("forages-for-resources"),
        game,
        {
          tribute: [tribute],
        },
        [randomValue],
      );

      expect(resolution.text).toContain(expectedTextFragment);

      expect(resolution.changes).toContainEqual(
        expect.objectContaining({
          type: "acquire-item",
          tributeId: tribute.id,
          acquisitionSource: "natural-foraging",

          item: expect.objectContaining({
            definitionId: expectedItemId,
          }),
        }),
      );

      expect(resolution.changes).toContainEqual({
        type: "increment-statistic",
        tributeId: tribute.id,
        statistic: "eventsSurvived",
        amount: 1,
      });
    },
  );

  it("treats finds-hiding-place as concealment rather than rest", () => {
    const game = createTestGame();

    const tribute = withStats(game.tributes[0], BALANCED_STATS, "Hazel");

    const definition = requireEvent("finds-hiding-place");

    expect(definition).toMatchObject({
      id: "finds-hiding-place",

      category: "survival",

      tags: ["survival", "status"],

      periods: ["day", "night"],

      baseWeight: 8,

      roles: [
        {
          id: "tribute",

          count: 1,
        },
      ],
    });

    expect(definition.roles[0]?.getWeight).toBe(getSurvivalSelectionWeight);

    const resolution = resolveEvent(
      definition,
      game,

      {
        tribute: [tribute],
      },

      [0.5],
    );

    expect(resolution.text).toBe(
      "Hazel slips into dense undergrowth and remains hidden from the other tributes.",
    );

    expect(getAppliedStatuses(resolution)).toEqual([
      expect.objectContaining({
        definitionId: "hidden",

        severity: 1,
      }),
    ]);

    expect(resolution.changes).toContainEqual({
      type: "increment-statistic",

      tributeId: tribute.id,

      statistic: "eventsSurvived",

      amount: 1,
    });
  });
});
