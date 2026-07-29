// Phase 3 production recovery metadata tests.
import { describe, expect, it } from "vitest";

import { HUNTING_EVENTS } from "./hunting-events";
import { ITEM_USE_EVENTS } from "./item-use-events";
import { NIGHT_EVENTS } from "./night-events";
import { SURVIVAL_EVENTS } from "./survival-events";

function requireEvent(
  events: readonly {
    id: string;
    recoveryProfile?: unknown;
  }[],
  id: string,
) {
  const event = events.find((candidate) => candidate.id === id);

  if (!event) {
    throw new Error(`Missing production event "${id}".`);
  }

  return event;
}

describe("production recovery priority metadata", () => {
  it("marks immediate food and water findings", () => {
    expect(requireEvent(SURVIVAL_EVENTS, "forages-for-resources").recoveryProfile).toEqual({
      targets: [
        {
          kind: "survival-need",
          roleId: "tribute",
          need: "food",
        },
        {
          kind: "survival-need",
          roleId: "tribute",
          need: "water",
        },
      ],
    });
  });

  it("marks every hunted-food event as food recovery", () => {
    expect(HUNTING_EVENTS.length).toBeGreaterThan(0);

    for (const event of HUNTING_EVENTS) {
      expect(event.recoveryProfile).toEqual({
        targets: [
          {
            kind: "survival-need",
            roleId: "tribute",
            need: "food",
          },
        ],
      });
    }
  });

  it("marks natural wound treatment as injured recovery", () => {
    expect(requireEvent(NIGHT_EVENTS, "night-natural-wound-treatment").recoveryProfile).toEqual({
      targets: [
        {
          kind: "status",
          roleId: "actor",
          statusIds: ["injured"],
        },
      ],
    });
  });

  it("marks item-assisted food and water attempts", () => {
    expect(requireEvent(ITEM_USE_EVENTS, "slingshot-trick-shot").recoveryProfile).toEqual({
      targets: [
        {
          kind: "survival-need",
          roleId: "tribute",
          need: "food",
        },
      ],
    });

    expect(
      requireEvent(ITEM_USE_EVENTS, "shield-used-for-everything-else").recoveryProfile,
    ).toEqual({
      targets: [
        {
          kind: "survival-need",
          roleId: "tribute",
          need: "food",
        },
        {
          kind: "survival-need",
          roleId: "tribute",
          need: "water",
        },
      ],
    });
  });
});
