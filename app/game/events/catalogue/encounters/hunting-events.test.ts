import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import {
  getAcquiredItemIds,
  getAppliedStatusIds,
  hasSurvivalCredit,
  requireEventDefinition,
  selectAndResolveEvent,
} from "~/game/events/testing/event-test-helpers";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import { HUNTING_EVENTS } from "./hunting-events";

const HUNTING_CASES = [
  {
    eventId: "trap-kit-rabbit-hunt",

    foodId: "rabbit",

    equipmentId: "trap-kit",
  },

  {
    eventId: "slingshot-chicken-hunt",

    foodId: "chicken",

    equipmentId: "slingshot",
  },

  {
    eventId: "fishing-gear-catch",

    foodId: "fish",

    equipmentId: "fishing-gear",
  },

  {
    eventId: "bird-whistle-nest-search",

    foodId: "eggs",

    equipmentId: "bird-whistle",
  },

  {
    eventId: "raids-nest-for-eggs",

    foodId: "eggs",

    equipmentId: null,
  },
] as const satisfies readonly {
  eventId: string;
  foodId: ItemDefinitionId;
  equipmentId: ItemDefinitionId | null;
}[];

function createHunter(equipmentId: ItemDefinitionId | null) {
  const baseHunter = createAuthoringTestTribute({
    id: "hunter",

    name: "Fern",

    stats: {
      brains: 3,
      brawn: 3,
      luck: 3,
    },
  });

  return equipmentId ? withAuthoringTestItem(baseHunter, equipmentId) : baseHunter;
}

describe("hunting event content", () => {
  it("contains each planned hunted-food event", () => {
    expect(HUNTING_EVENTS.map((event) => event.id)).toEqual(
      HUNTING_CASES.map(({ eventId }) => eventId),
    );
  });

  it.each(HUNTING_CASES)(
    "$eventId acquires $foodId with natural-foraging provenance",
    ({ eventId, foodId, equipmentId }) => {
      const hunter = createHunter(equipmentId);

      const state = createAuthoringTestGame([hunter]);

      const definition = requireEventDefinition(HUNTING_EVENTS, eventId);

      const { resolution } = selectAndResolveEvent({
        definition,
        state,

        livingTributes: [hunter],

        randomValues: [0.6],
      });

      expect(getAcquiredItemIds(resolution)).toEqual([foodId]);

      expect(resolution.changes).toContainEqual(
        expect.objectContaining({
          type: "acquire-item",

          acquisitionSource: "natural-foraging",

          item: expect.objectContaining({
            definitionId: foodId,
          }),
        }),
      );

      expect(hasSurvivalCredit(resolution, hunter.id)).toBe(true);
    },
  );

  it("makes exceptional hunting well fed", () => {
    const hunter = createHunter("fishing-gear");

    const state = createAuthoringTestGame([hunter]);

    const definition = requireEventDefinition(HUNTING_EVENTS, "fishing-gear-catch");

    const { resolution } = selectAndResolveEvent({
      definition,
      state,

      livingTributes: [hunter],

      randomValues: [0.999],
    });

    expect(getAcquiredItemIds(resolution)).toEqual(["fish"]);

    expect(getAppliedStatusIds(resolution)).toEqual(["well-fed"]);
  });

  it("uses the physical hunting equipment exactly once", () => {
    const hunter = createHunter("trap-kit");

    const trapKit = hunter.inventory[0];

    if (!trapKit) {
      throw new Error("Expected a trap-kit fixture.");
    }

    const state = createAuthoringTestGame([hunter]);

    const definition = requireEventDefinition(HUNTING_EVENTS, "trap-kit-rabbit-hunt");

    const { selection, resolution } = selectAndResolveEvent({
      definition,
      state,

      livingTributes: [hunter],

      randomValues: [0.6],
    });

    expect(selection.selectedItemInstanceIds).toEqual([trapKit.id]);

    expect(
      resolution.changes.filter(
        (change) => change.type === "consume-item" && change.itemInstanceId === trapKit.id,
      ),
    ).toEqual([
      {
        type: "consume-item",

        tributeId: hunter.id,

        itemInstanceId: trapKit.id,

        uses: 1,

        reason: "trap-kit-rabbit-hunt",
      },
    ]);
  });
});
