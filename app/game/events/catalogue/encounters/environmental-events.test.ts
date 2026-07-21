import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import type { RandomSource } from "~/game/engine/random";
import { EVENT_CATALOGUE } from "~/game/events/catalogue/index";
import type {
  EventDefinition,
  EventResolution,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { createTruceInstance } from "~/game/truces/truce-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";
import type { TributeStats } from "~/game/types/tribute";

import { ENVIRONMENTAL_EVENTS } from "./environmental-events";

const ROUND = {
  day: 1,
  period: "day",
} as const;

const NEXT_ROUND = {
  day: 1,
  period: "night",
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

      seed: "environmental-events-tests",

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

function withItem(tribute: GameTribute, itemId: ItemDefinitionId): GameTribute {
  return {
    ...tribute,

    inventory: [
      ...tribute.inventory,

      createInventoryItemInstance(`setup-${itemId}`, tribute.id, itemId, ROUND),
    ],
  };
}

function replaceTributes(game: GameState, replacements: readonly GameTribute[]): GameState {
  const replacementsById = new Map(replacements.map((tribute) => [tribute.id, tribute]));

  return {
    ...game,

    tributes: game.tributes.map((tribute) => replacementsById.get(tribute.id) ?? tribute),
  };
}

function addTruce(game: GameState, members: readonly GameTribute[]): GameState {
  const truce = createTruceInstance(
    "environmental-test-truce",
    members.map((member) => member.id),
    ROUND,
    NEXT_ROUND,
  );

  return {
    ...game,
    truces: [...game.truces, truce],
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
  const definition = ENVIRONMENTAL_EVENTS.find((candidate) => candidate.id === eventId);

  if (!definition) {
    throw new Error(`Missing environmental event ` + `"${eventId}".`);
  }

  return definition;
}

function resolveEvent(
  definition: EventDefinition,
  game: GameState,
  participantsByRole: ParticipantsByRole,
  randomValues: readonly number[],
  unavailableItemInstanceIds: ReadonlySet<string> = new Set<string>(),
): EventResolution {
  return definition.resolve({
    state: game,
    round: ROUND,

    livingTributes: game.tributes.filter((tribute) => tribute.isAlive),

    eventId: `test:${definition.id}`,

    random: createSequenceRandom(randomValues),

    participantsByRole,

    unavailableItemInstanceIds,
  });
}

function getAppliedStatuses(resolution: EventResolution) {
  return resolution.changes.flatMap((change) =>
    change.type === "apply-status" ? [change.status] : [],
  );
}

describe("environmental events", () => {
  it("includes every event in the main catalogue", () => {
    expect(
      ENVIRONMENTAL_EVENTS.every((event) =>
        EVENT_CATALOGUE.some((candidate) => candidate.id === event.id),
      ),
    ).toBe(true);
  });

  it("applies exhaustion after losing a prolonged goose confrontation", () => {
    const game = createTestGame();

    const tribute = withStats(game.tributes[0], BALANCED_STATS);

    const resolution = resolveEvent(
      requireEvent("arena-goose"),
      game,
      {
        tribute: [tribute],
      },
      [0.3],
    );

    expect(getAppliedStatuses(resolution)).toEqual([
      expect.objectContaining({
        definitionId: "exhausted",
      }),
    ]);
  });

  it("lets the goose steal the tribute's own food", () => {
    const originalGame = createTestGame();

    const tribute = withItem(withStats(originalGame.tributes[0], BALANCED_STATS), "food");

    const game = replaceTributes(originalGame, [tribute]);

    const food = tribute.inventory.find((item) => item.definitionId === "food");

    const resolution = resolveEvent(
      requireEvent("arena-goose"),
      game,
      {
        tribute: [tribute],
      },
      [0],
    );

    expect(getAppliedStatuses(resolution)).toEqual([
      expect.objectContaining({
        definitionId: "hunted",
        severity: 2,
      }),
    ]);

    expect(resolution.changes).toContainEqual({
      type: "consume-item",
      tributeId: tribute.id,
      itemInstanceId: food?.id,
      uses: 1,
      reason: "arena-goose-theft",
    });
  });

  it("lets the goose steal food owned by a truce partner", () => {
    const originalGame = createTestGame();

    const tribute = withStats(originalGame.tributes[0], BALANCED_STATS);

    const itemOwner = withItem(withStats(originalGame.tributes[1], BALANCED_STATS), "food");

    const game = addTruce(replaceTributes(originalGame, [tribute, itemOwner]), [
      tribute,
      itemOwner,
    ]);

    const food = itemOwner.inventory.find((item) => item.definitionId === "food");

    const resolution = resolveEvent(
      requireEvent("arena-goose"),
      game,
      {
        tribute: [tribute],
      },
      [0],
    );

    expect(resolution.changes).toContainEqual({
      type: "consume-item",

      /*
       * The user was `tribute`, but the
       * physical owner is `itemOwner`.
       */
      tributeId: itemOwner.id,

      itemInstanceId: food?.id,
      uses: 1,
      reason: "arena-goose-theft",
    });
  });

  it("does not reuse food already reserved by another event", () => {
    const originalGame = createTestGame();

    const tribute = withStats(originalGame.tributes[0], BALANCED_STATS);

    const itemOwner = withItem(withStats(originalGame.tributes[1], BALANCED_STATS), "food");

    const game = addTruce(replaceTributes(originalGame, [tribute, itemOwner]), [
      tribute,
      itemOwner,
    ]);

    const food = itemOwner.inventory.find((item) => item.definitionId === "food");

    if (!food) {
      throw new Error("Test truce partner has no food.");
    }

    const resolution = resolveEvent(
      requireEvent("arena-goose"),
      game,
      {
        tribute: [tribute],
      },
      [0],
      new Set([food.id]),
    );

    expect(resolution.changes.some((change) => change.type === "consume-item")).toBe(false);
  });

  it("lets personal protective equipment reduce brushfire severity", () => {
    const originalGame = createTestGame();

    const unprotectedTribute = withStats(originalGame.tributes[0], BALANCED_STATS);

    const protectedTribute = withItem(
      withStats(originalGame.tributes[1], BALANCED_STATS),
      "shield",
    );

    const game = replaceTributes(originalGame, [unprotectedTribute, protectedTribute]);

    const event = requireEvent("brushfire-supply-run");

    const unprotectedResolution = resolveEvent(
      event,
      game,
      {
        tribute: [unprotectedTribute],
      },
      [0.14],
    );

    const protectedResolution = resolveEvent(
      event,
      game,
      {
        tribute: [protectedTribute],
      },
      [0.14],
    );

    expect(getAppliedStatuses(unprotectedResolution)[0]).toMatchObject({
      definitionId: "burned",
      severity: 2,
    });

    expect(getAppliedStatuses(protectedResolution)[0]).toMatchObject({
      definitionId: "burned",
      severity: 1,
    });
  });

  it("lets a tribute use a truce partner's shield for brushfire protection", () => {
    const originalGame = createTestGame();

    const tribute = withStats(originalGame.tributes[0], BALANCED_STATS);

    const itemOwner = withItem(withStats(originalGame.tributes[1], BALANCED_STATS), "shield");

    const game = addTruce(replaceTributes(originalGame, [tribute, itemOwner]), [
      tribute,
      itemOwner,
    ]);

    const shield = itemOwner.inventory.find((item) => item.definitionId === "shield");

    const resolution = resolveEvent(
      requireEvent("brushfire-supply-run"),
      game,
      {
        tribute: [tribute],
      },
      [0.14],
    );

    expect(getAppliedStatuses(resolution)[0]).toMatchObject({
      definitionId: "burned",
      severity: 1,
    });

    expect(resolution.changes).toContainEqual({
      type: "use-item",
      tributeId: itemOwner.id,
      itemInstanceId: shield?.id,
      reason: "brushfire-protection",
    });
  });
});
