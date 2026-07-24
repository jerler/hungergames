import { describe, expect, it, vi } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { compileItemRestChanges } from "~/game/items/item-rest-engine";

const NIGHT = {
  day: 2,
  period: "night",
} as const;

describe("item rest compilation", () => {
  it("supports guaranteed reusable rest", () => {
    const tribute = createAuthoringTestTribute();

    const blanket = createInventoryItemInstance("blanket-rest", tribute.id, "blanket", NIGHT);

    const random = vi.fn(() => 0);

    const changes = compileItemRestChanges({
      eventId: "blanket-rest",
      round: NIGHT,
      random,

      actingTribute: tribute,
      owner: tribute,
      item: blanket,
    });

    expect(random).not.toHaveBeenCalled();

    expect(changes).toEqual([
      {
        type: "record-night-rest",
        tributeId: tribute.id,
        round: NIGHT,
        quality: "comfortable",
      },

      expect.objectContaining({
        type: "use-item",
        tributeId: tribute.id,
        itemInstanceId: blanket.id,
      }),
    ]);
  });

  it("supports checked consumable rest", () => {
    const tribute = createAuthoringTestTribute({
      stats: {
        brains: 5,
        brawn: 3,
        luck: 3,
      },
    });

    const matches = createInventoryItemInstance("matches-rest", tribute.id, "matches", NIGHT);

    const changes = compileItemRestChanges({
      eventId: "matches-rest",
      round: NIGHT,
      random: () => 0.99,

      actingTribute: tribute,
      owner: tribute,
      item: matches,
    });

    expect(changes[0]).toMatchObject({
      type: "record-night-rest",
      quality: "sheltered",
    });

    expect(changes[1]).toMatchObject({
      type: "consume-item",
      tributeId: tribute.id,
      itemInstanceId: matches.id,
    });
  });

  it("records failed checked rest as unsheltered", () => {
    const tribute = createAuthoringTestTribute({
      stats: {
        brains: 1,
        brawn: 3,
        luck: 3,
      },
    });

    const matches = createInventoryItemInstance(
      "failed-matches-rest",
      tribute.id,
      "matches",
      NIGHT,
    );

    const changes = compileItemRestChanges({
      eventId: "failed-matches-rest",

      round: NIGHT,
      random: () => 0,

      actingTribute: tribute,
      owner: tribute,
      item: matches,
    });

    expect(changes[0]).toMatchObject({
      type: "record-night-rest",
      quality: "unsheltered",
    });

    expect(changes[1].type).toBe("consume-item");
  });
});
