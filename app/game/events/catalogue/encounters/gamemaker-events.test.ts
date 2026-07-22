import { describe, expect, it } from "vitest";

import { EVENT_CATALOGUE } from "~/game/events/catalogue/index";

import { GAMEMAKER_EVENTS } from "./gamemaker-events";

describe("Gamemaker events", () => {
  it("contains no events with illegal item-acquisition premises", () => {
    expect(GAMEMAKER_EVENTS).toEqual([]);
  });

  it("includes every Gamemaker event in the main catalogue", () => {
    expect(GAMEMAKER_EVENTS.every((event) => EVENT_CATALOGUE.includes(event))).toBe(true);
  });
});
