import { describe, expect, it } from "vitest";

import { EVENT_CATALOGUE } from "./index";

describe("event catalogue", () => {
  it("contains every event definition exactly once", () => {
    const eventIds = EVENT_CATALOGUE.map((event) => event.id);

    const duplicateIds = eventIds.filter(
      (eventId, index) => eventIds.indexOf(eventId) !== index,
    );

    expect(duplicateIds).toEqual([]);
  });
});