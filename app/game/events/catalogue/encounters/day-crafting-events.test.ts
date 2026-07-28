import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";

import { DAY_CRAFTABLE_WEAPON_IDS, DAY_CRAFTING_EVENTS } from "./day-crafting-events";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const;

function requireEvent(id: string): EventDefinition {
  const event = DAY_CRAFTING_EVENTS.find((definition) => definition.id === id);

  if (!event) {
    throw new Error(`Missing crafting event "${id}".`);
  }

  return event;
}

describe("Day weapon crafting", () => {
  it("registers the four naturally plausible weapons", () => {
    expect(DAY_CRAFTABLE_WEAPON_IDS).toEqual(["knife", "club", "hand-axe", "bow"]);
    expect(DAY_CRAFTING_EVENTS).toHaveLength(4);
  });

  it("acquires a crafted weapon on success", () => {
    const actor = createAuthoringTestTribute({
      id: "actor",
      stats: {
        brains: 5,
        brawn: 1,
        luck: 5,
      },
    });
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent("day-make-knife");
    const context: EventResolutionContext = {
      eventId: "test:day-make-knife",
      state,
      round: DAY_TWO,
      livingTributes: [actor],
      participantsByRole: {
        actor: [actor],
      },
      random: () => 0.5,
    };
    const resolution = definition.resolve(context);

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "acquire-item",
        tributeId: actor.id,
        acquisitionSource: "crafted",
        item: expect.objectContaining({
          definitionId: "knife",
        }),
      }),
    );
  });
});
