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
    equipmentId: "trap-kit",
  },
  {
    eventId: "slingshot-chicken-hunt",
    equipmentId: "slingshot",
  },
  {
    eventId: "fishing-gear-catch",
    equipmentId: "fishing-gear",
  },
  {
    eventId: "bird-whistle-nest-search",
    equipmentId: "bird-whistle",
  },
  {
    eventId: "raids-nest-for-eggs",
    equipmentId: null,
  },
] as const satisfies readonly {
  eventId: string;
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

  it.each(HUNTING_CASES)("$eventId immediately satisfies food", ({ eventId, equipmentId }) => {
    const hunter = createHunter(equipmentId);
    const { resolution } = selectAndResolveEvent({
      definition: requireEventDefinition(HUNTING_EVENTS, eventId),
      state: createAuthoringTestGame([hunter]),
      livingTributes: [hunter],
      randomValues: [0.6],
    });

    expect(getAcquiredItemIds(resolution)).toEqual([]);
    expect(resolution.changes).toContainEqual({
      type: "satisfy-survival-need",
      tributeId: hunter.id,
      need: "food",
    });
    expect(hasSurvivalCredit(resolution, hunter.id)).toBe(true);
  });

  it("makes exceptional hunting well fed", () => {
    const hunter = createHunter("fishing-gear");
    const { resolution } = selectAndResolveEvent({
      definition: requireEventDefinition(HUNTING_EVENTS, "fishing-gear-catch"),
      state: createAuthoringTestGame([hunter]),
      livingTributes: [hunter],
      randomValues: [0.999],
    });

    expect(getAcquiredItemIds(resolution)).toEqual([]);
    expect(getAppliedStatusIds(resolution)).toEqual(["well-fed"]);
  });

  it("uses physical hunting equipment exactly once", () => {
    const hunter = createHunter("trap-kit");
    const trapKit = hunter.inventory[0];

    if (!trapKit) {
      throw new Error("Expected a trap-kit fixture.");
    }

    const { selection, resolution } = selectAndResolveEvent({
      definition: requireEventDefinition(HUNTING_EVENTS, "trap-kit-rabbit-hunt"),
      state: createAuthoringTestGame([hunter]),
      livingTributes: [hunter],
      randomValues: [0.6],
    });

    expect(selection.selectedItemInstanceIds).toEqual([trapKit.id]);
    expect(resolution.changes).toContainEqual({
      type: "consume-item",
      tributeId: hunter.id,
      itemInstanceId: trapKit.id,
      uses: 1,
      reason: "trap-kit-rabbit-hunt",
    });
  });
});
