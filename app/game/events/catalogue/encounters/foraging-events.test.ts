import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import {
  getAcquiredItemIds,
  getAppliedStatusIds,
  requireEventDefinition,
  selectAndResolveEvent,
} from "~/game/events/testing/event-test-helpers";

import { FORAGING_EVENTS } from "./foraging-events";

describe("foraging event content", () => {
  it("contains berry and mushroom identification events", () => {
    expect(FORAGING_EVENTS.map((event) => event.id)).toEqual([
      "identifies-wild-berries",
      "identifies-wild-mushrooms",
    ]);
  });

  it.each([
    {
      eventId: "identifies-wild-berries",

      safeItemId: "wild-fruit-and-berries",
    },

    {
      eventId: "identifies-wild-mushrooms",

      safeItemId: "mushrooms",
    },
  ] as const)("$eventId acquires its safe resource", ({ eventId, safeItemId }) => {
    const tribute = createAuthoringTestTribute();

    const { resolution } = selectAndResolveEvent({
      definition: requireEventDefinition(FORAGING_EVENTS, eventId),

      state: createAuthoringTestGame([tribute]),

      livingTributes: [tribute],

      randomValues: [0.1, 0.6],
    });

    expect(getAcquiredItemIds(resolution)).toEqual([safeItemId]);
  });

  it("failed berry identification can cause disorientation", () => {
    const tribute = createAuthoringTestTribute();

    const { resolution } = selectAndResolveEvent({
      definition: requireEventDefinition(FORAGING_EVENTS, "identifies-wild-berries"),

      state: createAuthoringTestGame([tribute]),

      livingTributes: [tribute],

      randomValues: [0.6, 0],
    });

    expect(getAppliedStatusIds(resolution)).toEqual(["disoriented"]);
  });

  it("failed mushroom identification can cause poisoning", () => {
    const tribute = createAuthoringTestTribute();

    const { resolution } = selectAndResolveEvent({
      definition: requireEventDefinition(FORAGING_EVENTS, "identifies-wild-mushrooms"),

      state: createAuthoringTestGame([tribute]),

      livingTributes: [tribute],

      randomValues: [0.9, 0],
    });

    expect(getAppliedStatusIds(resolution)).toEqual(["poisoned"]);
  });
});
