import { describe, expect, it } from "vitest";

import { ITEM_CATALOGUE, getItemDefinition } from "./item-catalogue";
import type { ItemDefinitionId, ItemOrigin } from "./item-schema";

const SAFE_NATURAL_FOOD_ITEM_IDS = [
  "wild-fruit-and-berries",
  "mushrooms",
  "eggs",
  "rabbit",
  "chicken",
  "fish",
] satisfies readonly ItemDefinitionId[];

const HARMFUL_FORAGE_ITEM_IDS = [
  "hallucinogenic-berries",
  "poison-berries",
  "hallucinogenic-mushrooms",
  "poison-mushrooms",
] satisfies readonly ItemDefinitionId[];

const NATURAL_RESOURCE_ITEM_IDS = [
  "water",

  ...SAFE_NATURAL_FOOD_ITEM_IDS,
  ...HARMFUL_FORAGE_ITEM_IDS,

  "kindling",
] satisfies readonly ItemDefinitionId[];

const MANUFACTURED_ITEM_IDS = [
  // Manufactured food and drinks
  "soup",
  "burger-and-fries",
  "pizza-box",
  "bottled-water",
  "coffee",
  "coca-cola",
  "energy-drink",
  "hot-chocolate",
  "herbal-tea",

  // Medical supplies
  "med-kit",
  "bandages",
  "painkillers",
  "burn-kit",
  "antidote",

  // Comfort
  "blanket",
  "sleeping-bag",
  "thermal-blanket",
  "pillow",

  // Shelter and fire
  "tarp",
  "tent",
  "matches",
  "lighter",
  "flint-stone",

  // Navigation and utility
  "map",
  "foraging-guidebook",
  "bird-whistle",
  "binoculars",
  "camouflage-net",
  "camouflage-paint",
  "night-vision-goggles",
  "trap-kit",
  "fishing-gear",

  // Equipment
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

  it("does not expose the retired generic food item", () => {
    expect(ITEM_CATALOGUE.map(({ id }) => id)).not.toContain("food");
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

  it("presents natural water as fresh water", () => {
    expect(getItemDefinition("water")).toMatchObject({
      label: "Fresh water",

      origin: "natural-resource",

      tags: ["consumable", "water"],
    });
  });

  it.each(SAFE_NATURAL_FOOD_ITEM_IDS)("%s is a single-use natural food", (itemId) => {
    const definition = getItemDefinition(itemId);

    expect(definition).toMatchObject({
      origin: "natural-resource",

      maxUses: 1,
    });

    expect(definition.tags).toEqual(expect.arrayContaining(["consumable", "food"]));

    expect(definition.useEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "satisfy-need",

          need: "food",
        }),
      ]),
    );
  });

  it.each([
    {
      itemId: "hallucinogenic-berries",

      statusId: "disoriented",
    },
    {
      itemId: "poison-berries",

      statusId: "poisoned",
    },
    {
      itemId: "hallucinogenic-mushrooms",

      statusId: "disoriented",
    },
    {
      itemId: "poison-mushrooms",

      statusId: "poisoned",
    },
  ] as const)("$itemId is harmful forage rather than automatic food", ({ itemId, statusId }) => {
    const definition = getItemDefinition(itemId);

    expect(definition.origin).toBe("natural-resource");

    expect(definition.tags).toContain("consumable");

    expect(definition.tags).not.toContain("food");

    expect(definition.useEffects).toContainEqual({
      type: "grant-status",

      statusId,

      severity: 1,
    });
  });

  it("defines kindling as a limited natural rest resource", () => {
    expect(getItemDefinition("kindling")).toMatchObject({
      origin: "natural-resource",

      maxUses: 1,

      rest: {
        quality: "sheltered",

        check: {
          stat: "brains-or-luck",

          difficulty: 4,
        },
      },
    });
  });

  it("defines the foraging guidebook as a reusable manufactured tool", () => {
    expect(getItemDefinition("foraging-guidebook")).toMatchObject({
      origin: "manufactured",

      tags: ["tool"],

      foragingBonus: 0.5,
    });

    expect(getItemDefinition("foraging-guidebook").maxUses).toBeUndefined();
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
      maxUses: 1,

      rest: {
        quality: "sheltered",

        check: {
          stat: "brains-or-luck",
          difficulty: 2,

          criticalFailureStatus: {
            statusId: "burned",
            severity: 1,
          },
        },
      },
    });
  });

  it("defines only the planned contextual capabilities", () => {
    expect(getItemDefinition("night-vision-goggles").contextual).toEqual({
      nightAwarenessBonus: 0.75,

      nightAmbushTargetWeightMultiplier: 0.55,
    });

    expect(getItemDefinition("shield").contextual).toEqual({
      hostileDefenseBonus: 0.75,
    });

    expect(getItemDefinition("matches").contextual).toBeUndefined();

    expect(getItemDefinition("camouflage-net").contextual).toBeUndefined();
  });

  it("distinguishes reusable and limited-use items", () => {
    expect(getItemDefinition("knife").maxUses).toBeUndefined();

    expect(getItemDefinition("shield").maxUses).toBeUndefined();

    expect(getItemDefinition("med-kit").maxUses).toBe(3);

    expect(getItemDefinition("water").maxUses).toBe(1);
  });

  it("declares the spear's minimum Brawn requirement", () => {
    expect(getItemDefinition("spear").minimumStats).toEqual({
      brawn: 2,
    });
  });

  it("removes rope and defers smoke bombs", () => {
    const itemIds = ITEM_CATALOGUE.map(({ id }) => id);

    expect(itemIds).not.toContain("rope");

    expect(itemIds).not.toContain("smoke-bomb");
  });
});
