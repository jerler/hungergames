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

function getSatisfiedNeeds(
  changes: readonly {
    type: string;
    need?: string;
  }[],
): string[] {
  return changes.flatMap((change) =>
    change.type === "satisfy-survival-need" && change.need ? [change.need] : [],
  );
}

describe("foraging event content", () => {
  it("contains berry and mushroom identification events", () => {
    expect(FORAGING_EVENTS.map((event) => event.id)).toEqual([
      "identifies-wild-berries",
      "identifies-wild-mushrooms",
    ]);
  });

  it.each(["identifies-wild-berries", "identifies-wild-mushrooms"] as const)(
    "%s immediately satisfies food when forage is safe",
    (eventId) => {
      const tribute = createAuthoringTestTribute();
      const { resolution } = selectAndResolveEvent({
        definition: requireEventDefinition(FORAGING_EVENTS, eventId),
        state: createAuthoringTestGame([tribute]),
        livingTributes: [tribute],
        randomValues: [0.1, 0.6],
      });

      expect(getSatisfiedNeeds(resolution.changes)).toEqual(["food"]);
      expect(getAcquiredItemIds(resolution)).toEqual([]);
    },
  );

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
