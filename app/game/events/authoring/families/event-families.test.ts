import { describe, expect, it } from "vitest";

import {
  applyStatus,
  brains,
  createItemStatEvent,
  createImmediateResourceEvent,
  createSoloStatEvent,
  minimumStat,
  result,
} from "~/game/events/authoring";
import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { resolveAuthoredEvent } from "~/game/events/authoring/testing/resolve-authored-event";
import { getForagingScore } from "~/game/engine/stat-formulas";
import type { EventDefinition, EventResolution } from "~/game/events/event-schema";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { GameState, GameTribute } from "~/game/types/game-state";

function createStatOutcomes() {
  return {
    criticalFailure: result({
      text: "Critical failure.",
      effects: [applyStatus("tribute", "injured", 2)],
    }),

    failure: result({
      text: "Failure.",
      effects: [applyStatus("tribute", "injured", 1)],
    }),

    success: result({
      text: "Success.",
    }),

    exceptionalSuccess: result({
      text: "Exceptional success.",
    }),
  };
}

function withItem(tribute: GameTribute, itemId: ItemDefinitionId): GameTribute {
  return {
    ...tribute,

    inventory: [
      ...tribute.inventory,
      createInventoryItemInstance(
        `family-test-${itemId}`,
        tribute.id,
        itemId,
        AUTHORING_TEST_ROUND,
      ),
    ],
  };
}

function selectAndResolve(
  definition: EventDefinition,
  state: GameState,
  tribute: GameTribute,
  randomValue: number,
): EventResolution {
  const selection = selectEventParticipants(
    definition,
    {
      state,
      round: AUTHORING_TEST_ROUND,
      livingTributes: [tribute],
    },
    () => 0,
    new Set(),
    new Set(),
  );

  if (!selection) {
    throw new Error(`Expected event "${definition.id}" to select a participant.`);
  }

  return definition.resolve({
    state,
    round: AUTHORING_TEST_ROUND,
    livingTributes: [tribute],

    eventId: `test:${definition.id}`,
    random: () => randomValue,

    participantsByRole: selection.participantsByRole,
    itemsByRole: selection.itemsByRole,
    unavailableItemInstanceIds: new Set(),
  });
}

describe("createImmediateResourceEvent", () => {
  it("supplies immediate-resource defaults", () => {
    const definition = createImmediateResourceEvent("natural-defaults", {
      needs: ["food"],
      text: ({ tribute }) => `${tribute.name} eats.`,
    });

    expect(definition).toMatchObject({
      id: "natural-defaults",
      category: "survival",
      tags: ["survival", "resource"],
      periods: ["day"],
      baseWeight: 8,
      roles: [
        {
          id: "tribute",
          count: 1,
        },
      ],
    });
    expect(definition.roles[0]?.getWeight).toBe(getForagingScore);
  });

  it("satisfies the selected need and grants survival credit", () => {
    const tribute = createAuthoringTestTribute({
      id: "forager",
      name: "Fern",
    });
    const definition = createImmediateResourceEvent("natural-effects", {
      needs: ["food"],
      text: ({ tribute: character }) => `${character.name} eats.`,
    });
    const resolution = resolveAuthoredEvent(
      definition,
      createAuthoringTestGame([tribute]),
      {
        tribute: [tribute],
      },
      [0],
    );

    expect(resolution.changes).toContainEqual({
      type: "satisfy-survival-need",
      tributeId: tribute.id,
      need: "food",
    });
    expect(resolution.changes).toContainEqual({
      type: "increment-statistic",
      tributeId: tribute.id,
      statistic: "eventsSurvived",
      amount: 1,
    });
  });

  it("supports metadata and role overrides", () => {
    const getWeight = () => 12;
    const definition = createImmediateResourceEvent("natural-overrides", {
      needs: ["water"],
      text: ({ tribute }) => `${tribute.name} drinks.`,
      periods: ["night"],
      weight: 3,
      tags: ["environment"],
      roleOptions: { getWeight },
    });

    expect(definition.periods).toEqual(["night"]);
    expect(definition.baseWeight).toBe(3);
    expect(definition.tags).toEqual(["survival", "resource", "environment"]);
    expect(definition.roles[0]?.getWeight).toBe(getWeight);
  });

  it("resolves need and text deterministically", () => {
    const tribute = createAuthoringTestTribute();
    const state = createAuthoringTestGame([tribute]);
    const definition = createImmediateResourceEvent("deterministic-resource", {
      needs: ["food", "water"],
      text: (_context, need) => `Selected ${need}.`,
    });
    const resolve = () =>
      resolveAuthoredEvent(
        definition,
        state,
        {
          tribute: [tribute],
        },
        [0.999],
      );

    expect(resolve()).toEqual(resolve());
    expect(resolve().text).toBe("Selected water.");
  });
});

describe("createSoloStatEvent", () => {
  it("supplies valid solo stat defaults", () => {
    const definition = createSoloStatEvent("solo-stat-defaults", {
      check: brains(3),
      outcomes: createStatOutcomes(),
    });

    expect(definition).toMatchObject({
      category: "hazard",
      tags: ["hazard"],
      periods: ["day", "night"],
      baseWeight: 1,

      roles: [
        {
          id: "tribute",
          count: 1,
        },
      ],
    });
  });

  it("supports requirements and metadata overrides", () => {
    const definition = createSoloStatEvent("solo-stat-overrides", {
      check: brains(3),
      outcomes: createStatOutcomes(),

      requirements: [minimumStat("tribute", "brains", 4)],

      category: "survival",
      tags: ["status"],
      periods: ["night"],
      weight: 4,
    });

    expect(definition.category).toBe("survival");
    expect(definition.tags).toEqual(["survival", "status"]);
    expect(definition.periods).toEqual(["night"]);
    expect(definition.baseWeight).toBe(4);
    expect(definition.roles[0]?.isEligible).toBeTypeOf("function");
  });

  it("resolves deterministically", () => {
    const tribute = createAuthoringTestTribute();
    const state = createAuthoringTestGame([tribute]);

    const definition = createSoloStatEvent("solo-stat-determinism", {
      check: brains(3),
      outcomes: createStatOutcomes(),
    });

    const resolve = () =>
      resolveAuthoredEvent(
        definition,
        state,
        {
          tribute: [tribute],
        },
        [0.6],
      );

    expect(resolve()).toEqual(resolve());
    expect(resolve().text).toBe("Success.");
  });
});

describe("createItemStatEvent", () => {
  it("supplies the required-item role and accessible default", () => {
    const definition = createItemStatEvent("item-stat-defaults", {
      itemId: "map",
      check: brains(3),
      outcomes: createStatOutcomes(),
    });

    expect(definition.tags).toEqual(["hazard", "item"]);

    expect(definition.roles[0]).toMatchObject({
      id: "tribute",
      count: 1,
      requiredItemDefinitionIds: ["map"],
      itemAccess: "accessible",
    });
  });

  it("reserves the selected physical item", () => {
    const baseTribute = createAuthoringTestTribute({
      id: "map-owner",
    });

    const tribute = withItem(baseTribute, "map");
    const state = createAuthoringTestGame([tribute]);
    const item = tribute.inventory[0];

    const definition = createItemStatEvent("item-reservation", {
      itemId: "map",
      check: brains(3),
      outcomes: createStatOutcomes(),
    });

    const selection = selectEventParticipants(
      definition,
      {
        state,
        round: AUTHORING_TEST_ROUND,
        livingTributes: [tribute],
      },
      () => 0,
      new Set(),
      new Set(),
    );

    expect(selection?.selectedItemInstanceIds).toEqual([item.id]);
    expect(selection?.itemsByRole.tribute[0]?.item.id).toBe(item.id);
  });

  it("automatically uses reusable items", () => {
    const tribute = withItem(createAuthoringTestTribute(), "binoculars");

    const state = createAuthoringTestGame([tribute]);

    const definition = createItemStatEvent("automatic-reusable-use", {
      itemId: "binoculars",

      check: brains(3),

      outcomes: createStatOutcomes(),
    });

    const resolution = selectAndResolve(definition, state, tribute, 0.6);

    expect(resolution.changes).toContainEqual({
      type: "use-item",

      tributeId: tribute.id,

      itemInstanceId: tribute.inventory[0].id,

      reason: "automatic-reusable-use",
    });
  });

  it("automatically consumes limited-use items", () => {
    const tribute = withItem(createAuthoringTestTribute(), "fishing-gear");
    const state = createAuthoringTestGame([tribute]);

    const definition = createItemStatEvent("automatic-limited-use", {
      itemId: "fishing-gear",
      check: brains(3),
      outcomes: createStatOutcomes(),
    });

    const resolution = selectAndResolve(definition, state, tribute, 0.6);

    expect(resolution.changes).toContainEqual({
      type: "consume-item",
      tributeId: tribute.id,
      itemInstanceId: tribute.inventory[0].id,
      uses: 1,
      reason: "automatic-limited-use",
    });
  });

  it("supports outcome-specific item use", () => {
    const tribute = withItem(createAuthoringTestTribute(), "binoculars");

    const state = createAuthoringTestGame([tribute]);

    const definition = createItemStatEvent("outcome-specific-item-use", {
      itemId: "binoculars",

      check: brains(3),

      outcomes: createStatOutcomes(),

      itemEffectOutcomes: ["success", "exceptionalSuccess"],
    });

    const failure = selectAndResolve(definition, state, tribute, 0.2);

    const success = selectAndResolve(definition, state, tribute, 0.6);

    expect(failure.changes.some((change) => change.type === "use-item")).toBe(false);

    expect(success.changes.some((change) => change.type === "use-item")).toBe(true);
  });

  it("supports owned access", () => {
    const definition = createItemStatEvent("owned-item-stat", {
      itemId: "map",
      check: brains(3),
      outcomes: createStatOutcomes(),
      access: "owned",
    });

    expect(definition.roles[0]?.itemAccess).toBe("owned");
  });

  it("preserves an explicitly positioned item tag", () => {
    const definition = createItemStatEvent("item-tag-order", {
      itemId: "map",
      check: brains(3),
      outcomes: createStatOutcomes(),
      tags: ["tool", "item", "status"],
    });

    expect(definition.tags).toEqual(["hazard", "tool", "item", "status"]);
  });
});
