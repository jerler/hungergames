import { describe, expect, it } from "vitest";

import { ITEM_CATALOGUE, getItemDefinition } from "./item-catalogue";
import type { ItemDefinitionId } from "./item-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";

interface ExpectedTreatment {
  itemId: ItemDefinitionId;
  statusId: StatusEffectId;
}

const EXPECTED_TREATMENTS = [
  {
    itemId: "water",
    statusId: "dehydrated",
  },
  {
    itemId: "medicine",
    statusId: "injured",
  },
  {
    itemId: "medicine",
    statusId: "bleeding",
  },
  {
    itemId: "medicine",
    statusId: "sick",
  },
  {
    itemId: "medicine",
    statusId: "poisoned",
  },
  {
    itemId: "medicine",
    statusId: "burned",
  },
  {
    itemId: "blanket",
    statusId: "exposed",
  },
  {
    itemId: "matches",
    statusId: "exposed",
  },
  {
    itemId: "food",
    statusId: "exhausted",
  },
  {
    itemId: "map",
    statusId: "disoriented",
  },
  {
    itemId: "camouflage-net",
    statusId: "hunted",
  },
] satisfies readonly ExpectedTreatment[];

const EXPECTED_ITEM_IDS = [
  "water",
  "food",
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

describe("item catalogue treatments", () => {
  it.each(EXPECTED_TREATMENTS)("$itemId treats $statusId", ({ itemId, statusId }) => {
    const item = getItemDefinition(itemId);

    expect(item.treatments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          statusId,
        }),
      ]),
    );
  });

  it("contains every planned item", () => {
    const actualItemIds = ITEM_CATALOGUE.map((item) => item.id).sort();

    const expectedItemIds = [...EXPECTED_ITEM_IDS].sort();

    expect(actualItemIds).toEqual(expectedItemIds);
  });

  it.each(EXPECTED_ITEM_IDS)("resolves the %s definition", (itemId) => {
    expect(getItemDefinition(itemId).id).toBe(itemId);
  });

  it("contains valid item definitions", () => {
    for (const item of ITEM_CATALOGUE) {
      expect(item.label.trim()).not.toBe("");

      expect(item.description.trim()).not.toBe("");

      expect(item.tags.length).toBeGreaterThan(0);

      expect(new Set(item.tags).size).toBe(item.tags.length);

      expect(Number.isInteger(item.maxUses)).toBe(true);

      expect(item.maxUses).toBeGreaterThan(0);
    }
  });

  it("does not contain duplicate item IDs", () => {
    const itemIds = ITEM_CATALOGUE.map((item) => item.id);

    expect(new Set(itemIds).size).toBe(itemIds.length);
  });

  it("only references valid status definitions", () => {
    for (const item of ITEM_CATALOGUE) {
      for (const treatment of item.treatments ?? []) {
        expect(() => getStatusDefinition(treatment.statusId)).not.toThrow();
      }
    }
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
});
