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
import { getVulnerabilityWeight } from "~/game/engine/stat-formulas";

import { ENVIRONMENTAL_EVENTS } from "./environmental-events";
import { selectEventParticipants } from "~/game/events/participant-selection";

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

const SIMPLE_STATUS_EVENT_CASES = [
  {
    eventId: "rough-terrain",
    tags: ["hazard", "status", "environment"],
    periods: ["day"],
    weight: 6,
    text: "is injured while crossing rough terrain.",
    statusId: "injured",
    severity: 1,
  },
  {
    eventId: "contaminated-water",
    tags: ["hazard", "status", "environment"],
    periods: ["day"],
    weight: 5,
    text: "drinks contaminated water and becomes dehydrated.",
    statusId: "dehydrated",
    severity: 2,
  },
  {
    eventId: "cold-rain",
    tags: ["hazard", "status", "environment"],
    periods: ["night"],
    weight: 6,
    text: "is caught without shelter in freezing rain.",
    statusId: "exposed",
    severity: 2,
  },
  {
    eventId: "deep-cut",
    tags: ["hazard", "status"],
    periods: ["day", "night"],
    weight: 4,
    text: "suffers a deep cut and begins bleeding.",
    statusId: "bleeding",
    severity: 2,
  },
] as const;

const FATAL_EVENT_CASES = [
  {
    eventId: "poisonous-berries",
    periods: ["day"],
    weight: 2,
    causeLabel: "Poisoned",
    expectedText: "Hazel mistakes poisonous berries for food.",
  },
  {
    eventId: "river-current",
    periods: ["day"],
    weight: 2,
    causeLabel: "Drowned",
    expectedText: "Hazel is swept away while crossing a violent river.",
  },
  {
    eventId: "freezing-night",
    periods: ["night"],
    weight: 2.25,
    causeLabel: "Froze",
    expectedText: "Hazel is unable to find shelter and freezes during the night.",
  },
  {
    eventId: "fallen-cliff",
    periods: ["day", "night"],
    weight: 2,
    causeLabel: "Fell",
    expectedText: "Hazel loses their footing near a cliff and falls to their death.",
  },
] as const;

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
  unavailableItemInstanceIds: ReadonlySet<string> = new Set(),
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
    unavailableItemInstanceIds,
  );

  if (!selection) {
    throw new Error(`Could not select participants for "${definition.id}".`);
  }

  return definition.resolve({
    state: game,
    round: ROUND,
    livingTributes,
    eventId: `test:${definition.id}`,
    random: createSequenceRandom(randomValues),
    participantsByRole,
    itemsByRole: selection.itemsByRole,
    unavailableItemInstanceIds,
  });
}

function getAppliedStatuses(resolution: EventResolution) {
  return resolution.changes.flatMap((change) =>
    change.type === "apply-status" ? [change.status] : [],
  );
}

describe("environmental events", () => {
  it.each(SIMPLE_STATUS_EVENT_CASES)(
    "$eventId preserves its authored catalogue contract",
    ({ eventId, tags, periods, weight, text, statusId, severity }) => {
      const game = createTestGame();
      const tribute = withStats(game.tributes[0], BALANCED_STATS, "Hazel");
      const definition = requireEvent(eventId);

      expect(definition).toMatchObject({
        id: eventId,
        category: "hazard",
        tags,
        periods,
        baseWeight: weight,
        roles: [{ id: "tribute", count: 1 }],
      });

      expect(definition.roles[0]?.getWeight).toBe(getVulnerabilityWeight);

      const resolution = resolveEvent(definition, game, { tribute: [tribute] }, [0.5]);

      expect(resolution.text).toBe(`Hazel ${text}`);

      expect(resolution.changes).toEqual([
        expect.objectContaining({
          type: "apply-status",
          tributeId: tribute.id,
          status: expect.objectContaining({
            definitionId: statusId,
            severity,
          }),
        }),
      ]);
    },
  );

  it.each(FATAL_EVENT_CASES)(
    "$eventId preserves its environmental fatality contract",
    ({ eventId, periods, weight, causeLabel, expectedText }) => {
      const game = createTestGame();

      const victim = withStats(game.tributes[0], BALANCED_STATS, "Hazel");

      const definition = requireEvent(eventId);

      expect(definition).toMatchObject({
        id: eventId,
        category: "fatal",
        tags: ["fatal", "hazard"],
        periods,
        baseWeight: weight,

        roles: [
          {
            id: "victim",
            count: 1,
          },
        ],
      });

      const resolution = resolveEvent(
        definition,
        game,
        {
          victim: [victim],
        },
        [0.5],
      );

      expect(resolution).toEqual({
        text: expectedText,

        changes: [
          {
            type: "eliminate-tribute",
            tributeId: victim.id,
            causeId: eventId,
            causeLabel,
            summary: expectedText,
            killerTributeIds: [],
          },
        ],
      });
    },
  );

  it.each([
    {
      eventId: "poisonous-berries",
      stat: "brains",
    },
    {
      eventId: "river-current",
      stat: "brawn",
    },
    {
      eventId: "freezing-night",
      stat: "brawn",
    },
  ] as const)("$eventId retains its maximum-$stat eligibility", ({ eventId, stat }) => {
    const game = createTestGame();
    const definition = requireEvent(eventId);
    const role = definition.roles[0];

    const eligible = withStats(game.tributes[0], {
      ...BALANCED_STATS,
      [stat]: 4,
    });

    const ineligible = withStats(game.tributes[1], {
      ...BALANCED_STATS,
      [stat]: 5,
    });

    const context = {
      state: game,
      round: ROUND,
      livingTributes: [eligible, ineligible],
      participantsByRole: {},
    };

    expect(role.isEligible?.(eligible, context)).toBe(true);

    expect(role.isEligible?.(ineligible, context)).toBe(false);
  });

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

  it("brushfire prefers water over lower-priority protection", () => {
    const originalGame = createTestGame();

    const tribute = withItem(
      withItem(withStats(originalGame.tributes[0], BALANCED_STATS), "shield"),
      "water",
    );

    const game = replaceTributes(originalGame, [tribute]);

    const selection = selectEventParticipants(
      requireEvent("brushfire-supply-run"),
      {
        state: game,
        round: ROUND,
        livingTributes: [tribute],
      },
      () => 0,
      new Set(),
      new Set(),
    );

    expect(selection?.itemsByRole.tribute?.[0]?.item.definitionId).toBe("water");
  });

  it("brushfire records natural acquisition provenance", () => {
    const game = createTestGame();
    const tribute = withStats(game.tributes[0], BALANCED_STATS);

    const resolution = resolveEvent(
      requireEvent("brushfire-supply-run"),
      game,
      { tribute: [tribute] },
      [0.999, 0.999],
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "acquire-item",
        tributeId: tribute.id,
        acquisitionSource: "natural-foraging",
        item: expect.objectContaining({
          definitionId: "water",
        }),
      }),
    );
  });
});
