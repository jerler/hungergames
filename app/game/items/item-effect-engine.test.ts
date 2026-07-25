import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";
import { compileItemUseEffects } from "~/game/items/item-effect-engine";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";

const ROUND = {
  day: 2,
  period: "day",
} as const;

describe("item effect compilation", () => {
  it("applies natural food effects to the user and consumption to the owner", () => {
    const owner = createAuthoringTestTribute({
      id: "owner",
    });

    const actingTribute = {
      ...createAuthoringTestTribute({
        id: "acting-tribute",
      }),

      statuses: [createStatusEffectInstance("hunger-event", "acting-tribute", "hungry", 1, ROUND)],
    };

    const food = createInventoryItemInstance(
      "food-event",
      owner.id,
      "wild-fruit-and-berries",
      ROUND,
    );

    const changes = compileItemUseEffects({
      eventId: "use-natural-food",
      round: ROUND,

      actingTribute,
      owner,
      item: food,
    });

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "satisfy-survival-need",
          tributeId: actingTribute.id,
          need: "food",
        }),

        expect.objectContaining({
          type: "remove-status",
          tributeId: actingTribute.id,
        }),

        expect.objectContaining({
          type: "consume-item",
          tributeId: owner.id,
          itemInstanceId: food.id,
        }),
      ]),
    );
  });

  it("removes only medical statuses", () => {
    const tribute = createAuthoringTestTribute();

    const actingTribute = {
      ...tribute,

      statuses: [
        createStatusEffectInstance("injury", tribute.id, "injured", 1, ROUND),

        createStatusEffectInstance("poison", tribute.id, "poisoned", 1, ROUND),

        createStatusEffectInstance("hunt", tribute.id, "hunted", 1, ROUND),
      ],
    };

    const medKit = createInventoryItemInstance("med-kit-event", tribute.id, "med-kit", ROUND);

    const changes = compileItemUseEffects({
      eventId: "use-med-kit",
      round: ROUND,

      actingTribute,
      owner: tribute,
      item: medKit,
    });

    const removedStatusIds = changes.flatMap((change) =>
      change.type === "remove-status" ? [change.statusId] : [],
    );

    expect(removedStatusIds).toEqual(
      expect.arrayContaining([actingTribute.statuses[0].id, actingTribute.statuses[1].id]),
    );

    expect(removedStatusIds).not.toContain(actingTribute.statuses[2].id);
  });

  it("rejects utility items without generic active use effects", () => {
    const tribute = createAuthoringTestTribute();

    const map = createInventoryItemInstance("map-event", tribute.id, "map", ROUND);

    expect(() =>
      compileItemUseEffects({
        eventId: "use-map",

        round: ROUND,

        actingTribute: tribute,

        owner: tribute,

        item: map,
      }),
    ).toThrow('Item "map" does not define active use effects.');
  });
});
