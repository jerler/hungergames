import { describe, expect, it } from "vitest";

import { ITEM_CATALOGUE, getItemDefinition } from "./item-catalogue";
import { LEGACY_FOOD_WATER_ITEM_IDS } from "~/game/survival/survival-resource-schema";

describe("item catalogue treatments", () => {
  it("contains valid unique item definitions", () => {
    const ids = ITEM_CATALOGUE.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const item of ITEM_CATALOGUE) {
      expect(item.label.trim()).not.toBe("");
      expect(item.description.trim()).not.toBe("");
      expect(item.tags.length).toBeGreaterThan(0);
      expect(new Set(item.tags).size).toBe(item.tags.length);
      expect(getItemDefinition(item.id)).toBe(item);
    }
  });

  it("does not expose food or water resources as inventory", () => {
    const ids = ITEM_CATALOGUE.map((item) => item.id);

    for (const legacyId of LEGACY_FOOD_WATER_ITEM_IDS) {
      expect(ids).not.toContain(legacyId);
      expect(() => getItemDefinition(legacyId as never)).toThrow(/unknown item definition/i);
    }

    expect(
      ITEM_CATALOGUE.some(
        (item) => item.tags.includes("food" as never) || item.tags.includes("water" as never),
      ),
    ).toBe(false);
  });

  it("keeps harmful forage as tactical consumable inventory", () => {
    for (const itemId of [
      "hallucinogenic-berries",
      "poison-berries",
      "hallucinogenic-mushrooms",
      "poison-mushrooms",
    ] as const) {
      const definition = getItemDefinition(itemId);

      expect(definition.origin).toBe("natural-resource");
      expect(definition.tags).toContain("consumable");
      expect(definition.useEffects).toBeDefined();
    }
  });

  it("keeps real resource-producing equipment", () => {
    expect(getItemDefinition("fishing-gear")).toMatchObject({
      tags: expect.arrayContaining(["tool", "fishing"]),
      foragingBonus: 0.7,
    });
    expect(getItemDefinition("trap-kit")).toMatchObject({
      tags: expect.arrayContaining(["tool", "trap"]),
      foragingBonus: 0.55,
    });
    expect(getItemDefinition("slingshot")).toMatchObject({
      tags: expect.arrayContaining(["weapon", "hunting"]),
      foragingBonus: 0.25,
    });
  });

  it("keeps medicine, shelter, and combat equipment", () => {
    expect(getItemDefinition("med-kit").maxUses).toBe(3);
    expect(getItemDefinition("blanket").maxUses).toBeUndefined();
    expect(getItemDefinition("shield").defense).toBeDefined();
    expect(getItemDefinition("knife").offense).toBeDefined();
  });
});
