import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  getAcquiredItemIds,
  hasSurvivalCredit,
  requireEventDefinition,
  selectAndResolveEvent,
} from "~/game/events/testing/event-test-helpers";

import { FLEE_EVENTS } from "./flee-events";

const RESOURCE_FLEE_CASES = [
  {
    eventId: "bloodbath-flee-stream",
    need: "water",
    textPattern: /drinks deeply/i,
  },
  {
    eventId: "bloodbath-flee-forage",
    need: "food",
    textPattern: /eats a quick meal/i,
  },
] as const;

function createFleeingTribute() {
  return createAuthoringTestTribute({
    id: "fleeing-tribute",
    name: "Fern",
    stats: {
      brains: 3,
      brawn: 3,
      luck: 3,
    },
  });
}

describe("Bloodbath flee resource events", () => {
  it.each(RESOURCE_FLEE_CASES)(
    "$eventId immediately satisfies $need on success",
    ({ eventId, need, textPattern }) => {
      const tribute = createFleeingTribute();
      const { resolution } = selectAndResolveEvent({
        definition: requireEventDefinition(FLEE_EVENTS, eventId),
        state: createAuthoringTestGame([tribute]),
        livingTributes: [tribute],
        randomValues: [0.6],
      });

      expect(resolution.text).toMatch(textPattern);
      expect(resolution.changes).toContainEqual({
        type: "satisfy-survival-need",
        tributeId: tribute.id,
        need,
      });
      expect(getAcquiredItemIds(resolution)).toEqual([]);
      expect(hasSurvivalCredit(resolution, tribute.id)).toBe(true);
    },
  );

  it.each(RESOURCE_FLEE_CASES)("$eventId does not reset history on failure", ({ eventId }) => {
    const tribute = createFleeingTribute();
    const { resolution } = selectAndResolveEvent({
      definition: requireEventDefinition(FLEE_EVENTS, eventId),
      state: createAuthoringTestGame([tribute]),
      livingTributes: [tribute],
      randomValues: [0.2],
    });

    expect(resolution.changes.some((change) => change.type === "satisfy-survival-need")).toBe(
      false,
    );
  });
});
