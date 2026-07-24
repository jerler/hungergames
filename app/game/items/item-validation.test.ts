import { describe, expect, it } from "vitest";

import { ITEM_CATALOGUE } from "~/game/items/item-catalogue";
import type { ItemDefinition } from "~/game/items/item-schema";
import { validateItemCatalogue, validateItemDefinition } from "~/game/items/item-validation";

const BASE_ITEM: ItemDefinition = {
  id: "rope",
  label: "Test item",
  description: "Test item.",
  origin: "manufactured",
  tags: ["tool"],
};

describe("item validation", () => {
  it("accepts the production catalogue", () => {
    expect(() => validateItemCatalogue(ITEM_CATALOGUE)).not.toThrow();
  });

  it("rejects invalid minimum stats", () => {
    expect(() =>
      validateItemDefinition({
        ...BASE_ITEM,

        minimumStats: {
          brawn: 6 as never,
        },
      }),
    ).toThrow(/invalid minimum brawn/i);
  });

  it("rejects unknown status references", () => {
    expect(() =>
      validateItemDefinition({
        ...BASE_ITEM,

        useEffects: [
          {
            type: "grant-status",
            statusId: "missing-status" as never,
            severity: 1,
          },
        ],
      }),
    ).toThrow(/unknown status/i);
  });

  it("rejects need effects without matching tags", () => {
    expect(() =>
      validateItemDefinition({
        ...BASE_ITEM,
        maxUses: 1,
        tags: ["consumable", "tool"],

        useEffects: [
          {
            type: "satisfy-need",
            need: "food",
          },
        ],
      }),
    ).toThrow(/without the "food" tag/i);
  });

  it("rejects rest without shelter or comfort", () => {
    expect(() =>
      validateItemDefinition({
        ...BASE_ITEM,

        rest: {
          quality: "sheltered",
        },
      }),
    ).toThrow(/shelter or comfort/i);
  });

  it("rejects contradictory status effects", () => {
    expect(() =>
      validateItemDefinition({
        ...BASE_ITEM,

        useEffects: [
          {
            type: "remove-status",
            statusIds: ["hunted"],
          },
          {
            type: "grant-status",
            statusId: "hunted",
            severity: 1,
          },
        ],
      }),
    ).toThrow(/both removes and grants/i);
  });

  it("rejects active effects without a supported mechanism", () => {
    expect(() =>
      validateItemDefinition({
        ...BASE_ITEM,
        tags: ["weapon"],

        useEffects: [
          {
            type: "grant-status",
            statusId: "inspired",
            severity: 1,
          },
        ],
      }),
    ).toThrow(/supported use mechanism/i);
  });
});
