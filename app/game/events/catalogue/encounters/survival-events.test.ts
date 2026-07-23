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
import { getDefinitionPopulationMultiplier } from "~/game/engine/stat-formulas";
import { createTruceInstance } from "~/game/truces/truce-engine";

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

function getAcquiredItemIds(resolution: EventResolution) {
  return resolution.changes.flatMap((change) =>
    change.type === "acquire-item" ? [change.item.definitionId] : [],
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
      type: "use-item",
      tributeId: tribute.id,
      itemInstanceId: map.id,
      reason: "upside-down-map",
    });
  });

  it("resolves foraging participants independently", () => {
    const game = createTestGame();

    const firstTribute = withStats(game.tributes[0], BALANCED_STATS, "Careful");

    const secondTribute = withStats(game.tributes[1], BALANCED_STATS, "Hungry");

    const resolution = resolveEvent(
      requireEvent("unfamiliar-foraging-ground"),
      game,
      {
        tributes: [firstTribute, secondTribute],
      },
      [0.999, 0],
    );

    expect(getAcquiredItemIds(resolution)).toEqual(["food", "water"]);

    expect(getAppliedStatuses(resolution)).toEqual([
      expect.objectContaining({
        definitionId: "poisoned",
      }),
    ]);
  });

  it("makes a failed picnic participant sick", () => {
    const game = createTestGame();

    const firstTribute = withStats(game.tributes[0], BALANCED_STATS);

    const secondTribute = withStats(game.tributes[1], BALANCED_STATS);

    const resolution = resolveEvent(
      requireEvent("unfamiliar-foraging-ground"),
      game,
      {
        tributes: [firstTribute, secondTribute],
      },
      [0.3, 0.3],
    );

    expect(getAppliedStatuses(resolution).map((status) => status.definitionId)).toEqual([
      "sick",
      "sick",
    ]);
  });

  it.each([
    {
      randomValue: 0,
      expectedItemId: "food",
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

  it("unfamiliar-foraging-ground preserves its cooperative metadata", () => {
    const definition = requireEvent("unfamiliar-foraging-ground");

    expect(definition).toMatchObject({
      id: "unfamiliar-foraging-ground",
      category: "hazard",

      tags: ["hazard", "item", "status", "resource"],

      periods: ["day"],
      baseWeight: 4,

      roles: [
        {
          id: "tributes",
          count: 2,
        },
      ],
    });

    expect(definition.getWeightMultiplier).toBe(getDefinitionPopulationMultiplier);
  });

  it("unfamiliar-foraging-ground preserves truce-aware cooperative weighting", () => {
    const originalGame = createTestGame();

    const firstTribute = originalGame.tributes[0];

    const partner = originalGame.tributes[1];

    const stranger = originalGame.tributes[2];

    const truce = createTruceInstance(
      "cooperative-foraging-truce",
      [firstTribute.id, partner.id],
      ROUND,
      {
        day: 1,
        period: "night",
      },
    );

    const game = {
      ...originalGame,
      truces: [truce],
    };

    const role = requireEvent("unfamiliar-foraging-ground").roles[0];

    const context = {
      state: game,
      round: ROUND,

      livingTributes: [firstTribute, partner, stranger],

      participantsByRole: {
        tributes: [firstTribute],
      },
    };

    expect(role.getWeight?.(partner, context)).toBe(5);

    expect(role.getWeight?.(stranger, context)).toBe(1);
  });

  it("unfamiliar-foraging-ground resolves both participants through central natural acquisition", () => {
    const game = createTestGame();

    const firstTribute = withStats(game.tributes[0], BALANCED_STATS, "Fern");

    const secondTribute = withStats(game.tributes[1], BALANCED_STATS, "Moss");

    const resolution = resolveEvent(
      requireEvent("unfamiliar-foraging-ground"),
      game,
      {
        tributes: [firstTribute, secondTribute],
      },
      [0.6, 0.6],
    );

    expect(resolution.text).toContain("Fern and Moss discover a lush clearing");

    expect(
      resolution.changes.filter(
        (change) =>
          change.type === "acquire-item" &&
          change.item.definitionId === "food" &&
          change.acquisitionSource === "natural-foraging",
      ),
    ).toHaveLength(2);

    expect(
      resolution.changes.filter(
        (change) => change.type === "increment-statistic" && change.statistic === "eventsSurvived",
      ),
    ).toEqual([
      expect.objectContaining({
        tributeId: firstTribute.id,
        amount: 1,
      }),

      expect.objectContaining({
        tributeId: secondTribute.id,
        amount: 1,
      }),
    ]);
  });

  it("finds-hiding-place preserves its authored catalogue contract", () => {
    const game = createTestGame();
    const tribute = withStats(game.tributes[0], BALANCED_STATS, "Shelter");

    const definition = requireEvent("finds-hiding-place");

    expect(definition).toMatchObject({
      id: "finds-hiding-place",
      category: "survival",
      tags: ["survival", "resource"],
      periods: ["day", "night"],
      baseWeight: 8,
      roles: [{ id: "tribute", count: 1 }],
    });

    expect(definition.roles[0]?.getWeight).toBe(getSurvivalSelectionWeight);

    const resolution = resolveEvent(definition, game, { tribute: [tribute] }, [0.5]);

    expect(resolution).toEqual({
      text: "Shelter finds a concealed place to rest.",
      changes: [
        {
          type: "increment-statistic",
          tributeId: tribute.id,
          statistic: "eventsSurvived",
          amount: 1,
        },
      ],
    });
  });
});
