import { describe, expect, it } from "vitest";

import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import { compileItemUseEffectChanges } from "./item-effect-engine";

describe("dual-purpose item effects", () => {
  it("satisfies both needs with one physical consumption", () => {
    const tribute = withAuthoringTestItem(createAuthoringTestTribute(), "food");

    const item = tribute.inventory[0];

    if (!item) {
      throw new Error("Expected a test item.");
    }

    const changes = compileItemUseEffectChanges({
      eventId: "dual-purpose-test",

      round: AUTHORING_TEST_ROUND,

      actingTribute: tribute,
      owner: tribute,
      item,

      effects: [
        {
          type: "satisfy-need",
          need: "hydration",
        },
        {
          type: "satisfy-need",
          need: "food",
        },
      ],
    });

    expect(changes.filter((change) => change.type === "satisfy-survival-need")).toEqual([
      {
        type: "satisfy-survival-need",

        tributeId: tribute.id,
        need: "water",
      },
      {
        type: "satisfy-survival-need",

        tributeId: tribute.id,
        need: "food",
      },
    ]);

    expect(
      changes.filter((change) => change.type === "consume-item" || change.type === "use-item"),
    ).toEqual([
      {
        type: "consume-item",

        tributeId: tribute.id,
        itemInstanceId: item.id,

        uses: 1,
        reason: "dual-purpose-test",
      },
    ]);
  });
});
