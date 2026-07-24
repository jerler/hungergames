import { describe, expect, it } from "vitest";

import { ITEM_CATALOGUE, getItemDefinition } from "./item-catalogue";
import type { ItemDefinitionId, ItemOrigin } from "./item-schema";

const NATURAL_RESOURCE_ITEM_IDS = ["water", "food"] satisfies readonly ItemDefinitionId[];

const MANUFACTURED_ITEM_IDS = [
  "medicine",
  "blanket",
  "matches",
  "rope",
  "map",
  "camouflage-net",
  "fishing-gear",
  "trap-kit",
  "shield",
  "knife",
  "slingshot",
  "spear",
  "axe",
  "bow",
] satisfies readonly ItemDefinitionId[];

const EXPECTED_ITEM_IDS = [
  ...NATURAL_RESOURCE_ITEM_IDS,
  ...MANUFACTURED_ITEM_IDS,
] satisfies readonly ItemDefinitionId[];

describe("item catalogue treatments", () => {
  it("contains every planned item", () => {
    const actualItemIds = ITEM_CATALOGUE.map((item) => item.id).sort();

    const expectedItemIds = [...EXPECTED_ITEM_IDS].sort();

    expect(actualItemIds).toEqual(expectedItemIds);
  });

  it.each([
    {
      origin: "natural-resource",
      itemIds: NATURAL_RESOURCE_ITEM_IDS,
    },
    {
      origin: "manufactured",
      itemIds: MANUFACTURED_ITEM_IDS,
    },
  ] satisfies readonly {
    origin: ItemOrigin;
    itemIds: readonly ItemDefinitionId[];
  }[])("classifies $origin items correctly", ({ origin, itemIds }) => {
    for (const itemId of itemIds) {
      expect(getItemDefinition(itemId).origin).toBe(origin);
    }
  });

  it.each(EXPECTED_ITEM_IDS)("resolves the %s definition", (itemId) => {
    expect(getItemDefinition(itemId).id).toBe(itemId);
  });

  it("contains valid item definitions", () => {
    for (const item of ITEM_CATALOGUE) {
      expect(item.label.trim()).not.toBe("");

      expect(item.description.trim()).not.toBe("");

      expect(["natural-resource", "manufactured"]).toContain(item.origin);

      expect(item.tags.length).toBeGreaterThan(0);

      expect(new Set(item.tags).size).toBe(item.tags.length);

      if (item.maxUses !== undefined) {
        expect(Number.isInteger(item.maxUses)).toBe(true);

        expect(item.maxUses).toBeGreaterThan(0);
      }
    }
  });

  it("does not contain duplicate item IDs", () => {
    const itemIds = ITEM_CATALOGUE.map((item) => item.id);

    expect(new Set(itemIds).size).toBe(itemIds.length);
  });

  it("gives each specialized item its intended bonuses", () => {
    expect(getItemDefinition("shield")).toMatchObject({
      combatBonus: 0.45,
      survivalBonus: 0.55,
    });

    expect(getItemDefinition("axe")).toMatchObject({
      combatBonus: 1.45,
      foragingBonus: 0.3,
    });

    expect(getItemDefinition("trap-kit")).toMatchObject({
      awarenessBonus: 0.2,
      foragingBonus: 0.55,
    });

    expect(getItemDefinition("fishing-gear")).toMatchObject({
      survivalBonus: 0.15,
      foragingBonus: 0.7,
    });

    expect(getItemDefinition("slingshot")).toMatchObject({
      combatBonus: 0.65,
      foragingBonus: 0.25,
    });
  });

  it("defines data-driven item effects", () => {
    expect(getItemDefinition("water").useEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "satisfy-need",
          need: "hydration",
        }),
      ]),
    );

    expect(getItemDefinition("medicine").useEffects).toContainEqual({
      type: "remove-medical-statuses",
    });

    expect(getItemDefinition("camouflage-net").useEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "grant-status",
          statusId: "hidden",
          severity: 2,
        }),
      ]),
    );
  });

  it("defines reusable and limited rest capabilities", () => {
    const blanket = getItemDefinition("blanket");

    expect(blanket).toMatchObject({
      rest: {
        quality: "comfortable",
      },
    });

    expect(blanket.maxUses).toBeUndefined();

    expect(getItemDefinition("matches")).toMatchObject({
      maxUses: 2,

      rest: {
        quality: "sheltered",

        check: {
          stat: "brains",
          difficulty: 2,
        },
      },
    });
  });

  it("defines only the planned contextual capabilities", () => {
    expect(getItemDefinition("matches").contextual).toEqual({
      nightAwarenessBonus: 0.35,
    });

    expect(getItemDefinition("camouflage-net").contextual).toEqual({
      hostileTargetWeightMultiplier: 0.5,
    });

    expect(getItemDefinition("shield").contextual).toEqual({
      hostileDefenseBonus: 0.75,
    });
  });

  it("distinguishes reusable and limited-use items", () => {
    expect(getItemDefinition("knife").maxUses).toBeUndefined();

    expect(getItemDefinition("shield").maxUses).toBeUndefined();

    expect(getItemDefinition("medicine").maxUses).toBe(1);

    expect(getItemDefinition("water").maxUses).toBe(1);
  });

  it("declares the spear's minimum Brawn requirement", () => {
    expect(getItemDefinition("spear").minimumStats).toEqual({
      brawn: 2,
    });
  });
});
