import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  HIGH_LUCK_CORNUCOPIA_FATAL_TARGET_PROFILES,
  HIGH_LUCK_CORNUCOPIA_FLAVOUR_EVENTS,
  HIGH_LUCK_FLEE_EVENTS,
  HIGH_LUCK_OPENING_EVENTS,
} from "~/game/events/catalogue/bloodbath/high-luck-opening-events";
import {
  STAT_GATED_BLOODBATH_EVENTS,
  STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES,
  STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
  STAT_GATED_FLEE_EVENTS,
} from "~/game/events/catalogue/bloodbath/stat-gated-events";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";
import { CORNUCOPIA_PROVISIONS_ITEM_ID } from "~/game/items/deprivation-protection";
import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const satisfies RoundReference;

function withStats(
  tribute: GameTribute,
  stats: {
    luck?: 1 | 2 | 3 | 4 | 5;
    brawn?: 1 | 2 | 3 | 4 | 5;
  },
): GameTribute {
  return {
    ...tribute,
    snapshot: {
      ...tribute.snapshot,
      stats: {
        ...tribute.snapshot.stats,
        ...stats,
      },
    },
  };
}

function requireEvent(id: string): EventDefinition {
  const definition = HIGH_LUCK_OPENING_EVENTS.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing High-Luck opening event "${id}".`);
  }

  return definition;
}

function context(
  definition: EventDefinition,
  state: GameState,
  participantsByRole: EventResolutionContext["participantsByRole"],
  randomValue = 0.35,
): EventResolutionContext {
  return {
    eventId: `test:${definition.id}`,
    state: {
      ...state,
      currentRound: DAY_ONE,
    },
    round: DAY_ONE,
    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    participantsByRole,
    random: () => randomValue,
    unavailableItemInstanceIds: new Set<string>(),
  };
}

describe("High-Luck opening batch", () => {
  it("registers ten unique concepts in every required aggregate", () => {
    expect(HIGH_LUCK_CORNUCOPIA_FLAVOUR_EVENTS).toHaveLength(4);
    expect(HIGH_LUCK_CORNUCOPIA_FATAL_TARGET_PROFILES).toHaveLength(4);
    expect(HIGH_LUCK_FLEE_EVENTS).toHaveLength(2);
    expect(HIGH_LUCK_OPENING_EVENTS).toHaveLength(10);
    expect(new Set(HIGH_LUCK_OPENING_EVENTS.map((event) => event.id)).size).toBe(10);

    expect(
      HIGH_LUCK_CORNUCOPIA_FLAVOUR_EVENTS.every((event) =>
        STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS.includes(event),
      ),
    ).toBe(true);
    expect(
      HIGH_LUCK_CORNUCOPIA_FATAL_TARGET_PROFILES.every((profile) =>
        STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES.includes(profile),
      ),
    ).toBe(true);
    expect(HIGH_LUCK_FLEE_EVENTS.every((event) => STAT_GATED_FLEE_EVENTS.includes(event))).toBe(
      true,
    );
    expect(
      HIGH_LUCK_OPENING_EVENTS.every((event) => STAT_GATED_BLOODBATH_EVENTS.includes(event)),
    ).toBe(true);
  });

  it("limits every actor to luck four or five", () => {
    const lucky = withStats(createAuthoringTestTribute({ id: "lucky" }), { luck: 5, brawn: 3 });
    const ordinary = withStats(createAuthoringTestTribute({ id: "ordinary" }), {
      luck: 3,
      brawn: 3,
    });
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([lucky, ordinary, target]);
    const roleContext = {
      state,
      round: DAY_ONE,
      livingTributes: state.tributes,
      participantsByRole: {},
    };

    for (const definition of HIGH_LUCK_OPENING_EVENTS) {
      const primaryRole = definition.roles.find(
        (role) => role.id === "actor" || role.id === "tribute",
      );

      expect(primaryRole?.isEligible, definition.id).toBeDefined();
      expect(primaryRole?.isEligible?.(lucky, roleContext), definition.id).toBe(true);
      expect(primaryRole?.isEligible?.(ordinary, roleContext), definition.id).toBe(false);
    }
  });

  it("guarantees the authored Cornucopia haul sizes", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { luck: 5 });
    const state = createAuthoringTestGame([actor]);

    const cases = [
      {
        id: "cornucopia-high-luck-raining-supplies",
        acquisitions: 3,
      },
      {
        id: "cornucopia-high-luck-trip-to-victory",
        acquisitions: 2,
      },
      {
        id: "cornucopia-high-luck-crate-escape",
        acquisitions: 2,
      },
      {
        id: "cornucopia-high-luck-falling-inventory",
        acquisitions: 3,
      },
    ] as const;

    for (const testCase of cases) {
      const definition = requireEvent(testCase.id);
      const resolution = definition.resolve(
        context(definition, state, {
          tribute: [actor],
        }),
      );
      const acquisitions = resolution.changes.filter((change) => change.type === "acquire-item");

      expect(acquisitions, testCase.id).toHaveLength(testCase.acquisitions);
      expect(
        new Set(
          acquisitions.map((change) => (change.type === "acquire-item" ? change.item.id : "")),
        ).size,
        testCase.id,
      ).toBe(testCase.acquisitions);
    }
  });

  it("lets fortunate Butterfingers keep the killing knife", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { luck: 4 });
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent("cornucopia-high-luck-butterfingers-fortunate");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        target: [target],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: target.id,
        killerTributeIds: [actor.id],
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "acquire-item",
        tributeId: actor.id,
        item: expect.objectContaining({
          definitionId: "knife",
        }),
      }),
    );
  });

  it("credits the sneeze victim to the attacking target", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { luck: 4 });
    const target = createAuthoringTestTribute({ id: "target" });
    const bystander = createAuthoringTestTribute({ id: "bystander" });
    const state = createAuthoringTestGame([actor, target, bystander]);
    const definition = requireEvent("cornucopia-high-luck-perfectly-timed-sneeze-fortunate");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        target: [target],
        bystander: [bystander],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: bystander.id,
        killerTributeIds: [target.id],
      }),
    );
    expect(
      resolution.changes.some(
        (change) => change.type === "eliminate-tribute" && change.tributeId === actor.id,
      ),
    ).toBe(false);
  });

  it("records both friendly-fire kills without awarding loot to the actor", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { luck: 5 });
    const target = withAuthoringTestItem(createAuthoringTestTribute({ id: "target" }), "map");
    const bystander = withAuthoringTestItem(
      createAuthoringTestTribute({ id: "bystander" }),
      "knife",
    );
    const state = createAuthoringTestGame([actor, target, bystander]);
    const definition = requireEvent("cornucopia-high-luck-friendly-fire");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        target: [target],
        bystander: [bystander],
      }),
    );

    expect(resolution.changes.filter((change) => change.type === "eliminate-tribute")).toHaveLength(
      2,
    );
    expect(resolution.changes.some((change) => change.type === "transfer-item")).toBe(false);
  });

  it("transfers Shoelace Assassin death loot to the lucky actor", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { luck: 4 });
    const target = withAuthoringTestItem(createAuthoringTestTribute({ id: "target" }), "map");
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent("bloodbath-flee-high-luck-shoelace-assassin");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        target: [target],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: target.id,
        killerTributeIds: [actor.id],
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "transfer-item",
        fromTributeId: target.id,
        toTributeId: actor.id,
        reason: "death-loot",
      }),
    );
  });

  it("grants real Cornucopia provisions during the dramatic getaway", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { luck: 4 });
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent("bloodbath-flee-high-luck-dramatic-getaway");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "acquire-item",
        tributeId: actor.id,
        acquisitionSource: "cornucopia",
        item: expect.objectContaining({
          definitionId: CORNUCOPIA_PROVISIONS_ITEM_ID,
        }),
      }),
    );
    expect(resolution.changes).toContainEqual({
      type: "satisfy-survival-need",
      tributeId: actor.id,
      need: "food",
    });
    expect(resolution.changes).toContainEqual({
      type: "satisfy-survival-need",
      tributeId: actor.id,
      need: "water",
    });
  });
});
