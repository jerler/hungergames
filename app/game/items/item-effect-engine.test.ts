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
  it("compiles harmful forage as an item-side status effect", () => {
    const tribute = createAuthoringTestTribute();
    const berries = createInventoryItemInstance("berry-event", tribute.id, "poison-berries", ROUND);

    const changes = compileItemUseEffects({
      eventId: "use-poison-berries",
      round: ROUND,
      actingTribute: tribute,
      owner: tribute,
      item: berries,
    });

    expect(changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: tribute.id,
        status: expect.objectContaining({
          definitionId: "poisoned",
        }),
      }),
    );
    expect(changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",
        itemInstanceId: berries.id,
      }),
    );
    expect(changes.some((change) => change.type === "satisfy-survival-need")).toBe(false);
  });

  it("removes only medical statuses", () => {
    const tribute = createAuthoringTestTribute();
    const actingTribute = {
      ...tribute,
      statuses: [
        createStatusEffectInstance("injury", tribute.id, "injured", 1, ROUND),
        createStatusEffectInstance("poison", tribute.id, "poisoned", 1, ROUND),
        createStatusEffectInstance("hunt", tribute.id, "hunted", 1, ROUND),
        createStatusEffectInstance("hunger", tribute.id, "hungry", 1, ROUND),
        createStatusEffectInstance("thirst", tribute.id, "thirsty", 1, ROUND),
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
    expect(removedStatusIds).not.toContain(actingTribute.statuses[3].id);
    expect(removedStatusIds).not.toContain(actingTribute.statuses[4].id);
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
