import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import type { RandomSource } from "~/game/engine/random";
import { EVENT_CATALOGUE } from "~/game/events/event-catalogue";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { TOOL_AND_WEAPON_EVENTS } from "~/game/events/tool-and-weapon-events";
import type {
  EventDefinition,
  EventResolution,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute, ResolvedEvent } from "~/game/types/game-state";
import type { TributeStats } from "~/game/types/tribute";

const ROUND = {
  day: 1,
  period: "day",
} as const;

const BALANCED_STATS = {
  brains: 3,
  brawn: 3,
  luck: 3,
} satisfies TributeStats;

const EVENT_ITEM_CASES = [
  {
    eventId: "trap-kit-instructions-missing",
    itemId: "trap-kit",
  },
  {
    eventId: "fishing-gear-enormous-fish",
    itemId: "fishing-gear",
  },
  {
    eventId: "axe-based-shelter-renovation",
    itemId: "axe",
  },
  {
    eventId: "slingshot-trick-shot",
    itemId: "slingshot",
  },
  {
    eventId: "shield-used-for-everything-else",
    itemId: "shield",
  },
] satisfies readonly {
  eventId: string;
  itemId: ItemDefinitionId;
}[];

const OUTCOME_RANDOM_VALUES = [0, 0.2, 0.6, 0.999] as const;

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
      seed: "tool-and-weapon-event-tests",
      now: "2026-07-20T12:00:00.000Z",
    },
  );
}

function withStats(tribute: GameTribute, stats: TributeStats): GameTribute {
  return {
    ...tribute,

    snapshot: {
      ...tribute.snapshot,
      stats,
    },
  };
}

function withItem(tribute: GameTribute, itemId: ItemDefinitionId): GameTribute {
  return {
    ...tribute,

    inventory: [
      ...tribute.inventory,

      createInventoryItemInstance(`setup-${itemId}`, tribute.id, itemId, ROUND),
    ],
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
  const definition = TOOL_AND_WEAPON_EVENTS.find((candidate) => candidate.id === eventId);

  if (!definition) {
    throw new Error(`Missing tool or weapon event "${eventId}".`);
  }

  return definition;
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

function getAppliedStatusIds(resolution: EventResolution) {
  return resolution.changes.flatMap((change) =>
    change.type === "apply-status" ? [change.status.definitionId] : [],
  );
}

function getAcquiredItemIds(resolution: EventResolution) {
  return resolution.changes.flatMap((change) =>
    change.type === "acquire-item" ? [change.item.definitionId] : [],
  );
}

describe("tool and weapon events", () => {
  it("includes every event in the main catalogue", () => {
    expect(
      TOOL_AND_WEAPON_EVENTS.every((event) =>
        EVENT_CATALOGUE.some((candidate) => candidate.id === event.id),
      ),
    ).toBe(true);
  });

  it.each(EVENT_ITEM_CASES)("$eventId requires a usable $itemId", ({ eventId, itemId }) => {
    const game = createTestGame();

    const definition = requireEvent(eventId);

    const tributeWithoutItem = withStats(game.tributes[0], BALANCED_STATS);

    const withoutItem = selectEventParticipants(
      definition,
      {
        state: game,
        round: ROUND,
        livingTributes: [tributeWithoutItem],
      },
      () => 0.5,
      new Set(),
    );

    expect(withoutItem).toBeNull();

    const tributeWithItem = withItem(tributeWithoutItem, itemId);

    const withRequiredItem = selectEventParticipants(
      definition,
      {
        state: game,
        round: ROUND,
        livingTributes: [tributeWithItem],
      },
      () => 0.5,
      new Set(),
    );

    expect(withRequiredItem?.participantTributeIds).toEqual([tributeWithItem.id]);
  });

  it.each(EVENT_ITEM_CASES)(
    "$eventId can reach all four outcome branches",
    ({ eventId, itemId }) => {
      const game = createTestGame();

      const tribute = withItem(withStats(game.tributes[0], BALANCED_STATS), itemId);

      const definition = requireEvent(eventId);

      const texts = OUTCOME_RANDOM_VALUES.map(
        (randomValue) =>
          resolveEvent(
            definition,
            game,
            {
              tribute: [tribute],
            },
            [randomValue],
          ).text,
      );

      expect(new Set(texts).size).toBe(4);
    },
  );

  it.each(EVENT_ITEM_CASES)(
    "$eventId is deterministic for an identical random source",
    ({ eventId, itemId }) => {
      const game = createTestGame();

      const tribute = withItem(withStats(game.tributes[0], BALANCED_STATS), itemId);

      const definition = requireEvent(eventId);

      const firstResolution = resolveEvent(
        definition,
        game,
        {
          tribute: [tribute],
        },
        [0.6],
      );

      const secondResolution = resolveEvent(
        definition,
        game,
        {
          tribute: [tribute],
        },
        [0.6],
      );

      expect(secondResolution).toEqual(firstResolution);
    },
  );

  it.each(EVENT_ITEM_CASES)("$eventId consumes one use of $itemId", ({ eventId, itemId }) => {
    const game = createTestGame();

    const tribute = withItem(withStats(game.tributes[0], BALANCED_STATS), itemId);

    const item = tribute.inventory.find((candidate) => candidate.definitionId === itemId);

    const resolution = resolveEvent(
      requireEvent(eventId),
      game,
      {
        tribute: [tribute],
      },
      [0.6],
    );

    expect(resolution.changes).toContainEqual({
      type: "consume-item",
      tributeId: tribute.id,
      itemInstanceId: item?.id,
      uses: 1,
      reason: eventId,
    });
  });

  it("the trap kit can produce food and inspiration", () => {
    const game = createTestGame();

    const tribute = withItem(withStats(game.tributes[0], BALANCED_STATS), "trap-kit");

    const resolution = resolveEvent(
      requireEvent("trap-kit-instructions-missing"),
      game,
      {
        tribute: [tribute],
      },
      [0.999],
    );

    expect(getAcquiredItemIds(resolution)).toEqual(["food"]);

    expect(getAppliedStatusIds(resolution)).toEqual(["inspired"]);
  });

  it("the enormous fish can injure and exhaust a tribute", () => {
    const game = createTestGame();

    const tribute = withItem(withStats(game.tributes[0], BALANCED_STATS), "fishing-gear");

    const resolution = resolveEvent(
      requireEvent("fishing-gear-enormous-fish"),
      game,
      {
        tribute: [tribute],
      },
      [0],
    );

    expect(getAppliedStatusIds(resolution)).toEqual(["injured", "exhausted"]);
  });

  it("successful shelter renovation applies concealed", () => {
    const game = createTestGame();

    const tribute = withItem(withStats(game.tributes[0], BALANCED_STATS), "axe");

    const resolution = resolveEvent(
      requireEvent("axe-based-shelter-renovation"),
      game,
      {
        tribute: [tribute],
      },
      [0.6],
    );

    expect(getAppliedStatusIds(resolution)).toEqual(["concealed"]);
  });

  it("a failed slingshot shot applies hunted", () => {
    const game = createTestGame();

    const tribute = withItem(withStats(game.tributes[0], BALANCED_STATS), "slingshot");

    const resolution = resolveEvent(
      requireEvent("slingshot-trick-shot"),
      game,
      {
        tribute: [tribute],
      },
      [0.2],
    );

    expect(getAppliedStatusIds(resolution)).toEqual(["hunted"]);
  });

  it("an exceptional shield experiment finds food and water", () => {
    const game = createTestGame();

    const tribute = withItem(withStats(game.tributes[0], BALANCED_STATS), "shield");

    const resolution = resolveEvent(
      requireEvent("shield-used-for-everything-else"),
      game,
      {
        tribute: [tribute],
      },
      [0.999],
    );

    expect(getAcquiredItemIds(resolution)).toEqual(["food", "water"]);
  });

  it("only creates valid item and status definitions", () => {
    for (const { eventId, itemId } of EVENT_ITEM_CASES) {
      const game = createTestGame();

      const tribute = withItem(withStats(game.tributes[0], BALANCED_STATS), itemId);

      const definition = requireEvent(eventId);

      for (const randomValue of OUTCOME_RANDOM_VALUES) {
        const resolution = resolveEvent(
          definition,
          game,
          {
            tribute: [tribute],
          },
          [randomValue],
        );

        for (const change of resolution.changes) {
          if (change.type === "acquire-item") {
            expect(() => getItemDefinition(change.item.definitionId)).not.toThrow();
          }

          if (change.type === "apply-status") {
            expect(() => getStatusDefinition(change.status.definitionId)).not.toThrow();
          }
        }
      }
    }
  });

  it("applies rewards and item consumption to game state", () => {
    const originalGame = createTestGame();

    const equippedTribute = withItem(
      withStats(originalGame.tributes[0], BALANCED_STATS),
      "slingshot",
    );

    const game = {
      ...originalGame,

      tributes: originalGame.tributes.map((tribute) =>
        tribute.id === equippedTribute.id ? equippedTribute : tribute,
      ),
    };

    const definition = requireEvent("slingshot-trick-shot");

    const resolution = resolveEvent(
      definition,
      game,
      {
        tribute: [equippedTribute],
      },
      [0.6],
    );

    const resolvedEvent: ResolvedEvent = {
      id: `test:${definition.id}`,

      definitionId: definition.id,

      resolutionMode: "standard",

      round: ROUND,

      participantTributeIds: [equippedTribute.id],

      ...resolution,
    };

    const nextState = applyResolvedEvent(game, resolvedEvent);

    const nextTribute = nextState.tributes.find((tribute) => tribute.id === equippedTribute.id);

    expect(nextTribute?.inventory.find((item) => item.definitionId === "food")).toBeDefined();

    expect(
      nextTribute?.inventory.find((item) => item.definitionId === "slingshot")?.usesRemaining,
    ).toBe(getItemDefinition("slingshot").maxUses - 1);

    expect(nextState.itemTransactions.map((transaction) => transaction.type)).toEqual([
      "acquired",
      "consumed",
    ]);
  });
});
