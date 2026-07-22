import { describe, expect, it } from "vitest";

import { EVENT_CATALOGUE } from "~/game/events/catalogue";

import { LOW_LUCK_EVENTS } from "./low-events";

describe("low-Luck events", () => {
  it("contains no events with illegal item-acquisition premises", () => {
    expect(LOW_LUCK_EVENTS).toEqual([]);
  });

  it("includes every low-Luck event in the main catalogue", () => {
    expect(LOW_LUCK_EVENTS.every((event) => EVENT_CATALOGUE.includes(event))).toBe(true);
  });
});
