import { describe, expect, it } from "vitest";

import { createSeededRandom } from "~/game/engine/random";

import { getItemDefinition } from "~/game/items/item-catalogue";

import type { ItemDefinitionId } from "~/game/items/item-schema";
import {
  CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS,
  CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS,
  CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS,
  CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS,
  CORNUCOPIA_PACK_ITEM_POOL,
  selectCornucopiaPackItem,
  selectDistinctCornucopiaBrainsOffenseItems,
  selectDistinctCornucopiaPackItems,
  type CornucopiaPackRarity,
} from "./cornucopia-item-pool";

const CONSUMABLE_IDS = [
  "soup",
  "burger-and-fries",
  "pizza-box",
  "bottled-water",
  "coffee",
  "coca-cola",
  "energy-drink",
  "hot-chocolate",
  "herbal-tea",
  "med-kit",
  "bandages",
  "painkillers",
  "burn-kit",
  "antidote",
] as const satisfies readonly ItemDefinitionId[];

const DIRECT_WEAPON_IDS = [
  "knife",
  "short-sword",
  "rapier",
  "longsword",
  "greatsword",
  "spear",
  "pike",
  "trident",
  "bow",
  "longbow",
  "crossbow",
  "hand-axe",
  "axe",
  "club",
  "warhammer",
] as const satisfies readonly ItemDefinitionId[];

const TACTICAL_ITEM_IDS = [
  "blowgun",
  "poison-vial",
  "bear-trap",
  "tripwire",
  "firebomb",
] as const satisfies readonly ItemDefinitionId[];

const DEFENSE_ITEM_IDS = [
  "shield",
  "helmet",
  "padded-armour",
  "reinforced-armour",
] as const satisfies readonly ItemDefinitionId[];

function selectSequence(seed: string): ItemDefinitionId[] {
  const random = createSeededRandom(seed);

  return Array.from(
    {
      length: 100,
    },

    () => selectCornucopiaPackItem(random),
  );
}

describe("Cornucopia item pool", () => {
  it("contains every manufactured consumable", () => {
    const poolItemIds = CORNUCOPIA_PACK_ITEM_POOL.map((entry) => entry.itemId);

    expect(poolItemIds).toEqual(expect.arrayContaining([...CONSUMABLE_IDS]));
  });

  it("contains unique manufactured items", () => {
    const itemIds = CORNUCOPIA_PACK_ITEM_POOL.map((entry) => entry.itemId);

    expect(new Set(itemIds).size).toBe(itemIds.length);

    for (const itemId of itemIds) {
      expect(getItemDefinition(itemId).origin).toBe("manufactured");
    }
  });

  it("produces the same sequence for the same seed", () => {
    expect(selectSequence("weighted-cornucopia")).toEqual(selectSequence("weighted-cornucopia"));
  });

  it("selects distinct items without replacement", () => {
    const selectedItemIds = selectDistinctCornucopiaPackItems(
      2,

      createSeededRandom("distinct-cornucopia"),
    );

    expect(selectedItemIds).toHaveLength(2);

    expect(new Set(selectedItemIds).size).toBe(2);
  });

  it("makes common items substantially more frequent than rare items", () => {
    const rarityByItemId = new Map<ItemDefinitionId, CornucopiaPackRarity>(
      CORNUCOPIA_PACK_ITEM_POOL.map((entry) => [entry.itemId, entry.rarity]),
    );

    const counts: Record<CornucopiaPackRarity, number> = {
      common: 0,
      standard: 0,
      uncommon: 0,
      rare: 0,
    };

    const random = createSeededRandom("cornucopia-rarity-distribution");

    const sampleSize = 20_000;

    for (let index = 0; index < sampleSize; index += 1) {
      const itemId = selectCornucopiaPackItem(random);

      const rarity = rarityByItemId.get(itemId);

      if (!rarity) {
        throw new Error(`Selected item "${itemId}" is missing from the rarity map.`);
      }

      counts[rarity] += 1;
    }

    expect(counts.common).toBeGreaterThan(counts.standard);

    expect(counts.standard).toBeGreaterThan(counts.uncommon);

    expect(counts.uncommon).toBeGreaterThan(counts.rare);

    expect(counts.common / sampleSize).toBeGreaterThan(0.4);

    expect(counts.rare / sampleSize).toBeLessThan(0.05);
  });

  it("makes the foraging guidebook an uncommon manufactured supply", () => {
    expect(CORNUCOPIA_PACK_ITEM_POOL).toContainEqual({
      itemId: "foraging-guidebook",

      rarity: "uncommon",
    });

    expect(getItemDefinition("foraging-guidebook").origin).toBe("manufactured");
  });

  it("makes every equipment item reachable", () => {
    const reachableItemIds = new Set<ItemDefinitionId>([
      ...CORNUCOPIA_PACK_ITEM_POOL.map((entry) => entry.itemId),

      ...CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS,
      ...CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS,
      ...CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS,
    ]);

    for (const itemId of [
      ...DIRECT_WEAPON_IDS,
      ...TACTICAL_ITEM_IDS,
      ...DEFENSE_ITEM_IDS,
      "slingshot",
    ] as const) {
      expect(
        reachableItemIds.has(itemId),
        `Expected ${itemId} to have a Cornucopia acquisition route.`,
      ).toBe(true);
    }
  });

  it("uses every direct weapon in the contested weapon pool", () => {
    expect(new Set(CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS)).toEqual(
      new Set(DIRECT_WEAPON_IDS),
    );
  });

  it("keeps slingshot out of direct-combat acquisition pools", () => {
    expect(CORNUCOPIA_PACK_ITEM_POOL).toContainEqual({
      itemId: "slingshot",
      rarity: "standard",
    });

    expect(CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS).not.toContain("slingshot");

    expect(CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS).not.toContain("slingshot");

    expect(CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS).not.toContain("slingshot");
  });

  it("provides a Brains-oriented offense cache", () => {
    expect(CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS).toEqual([
      "crossbow",
      "blowgun",
      "poison-vial",
      "bear-trap",
      "tripwire",
      "firebomb",
    ]);

    for (const itemId of CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS) {
      expect(getItemDefinition(itemId).minimumStats?.brains).toBeDefined();
    }
  });

  it("assigns intended defensive-equipment rarity", () => {
    expect(CORNUCOPIA_PACK_ITEM_POOL).toEqual(
      expect.arrayContaining([
        {
          itemId: "helmet",
          rarity: "standard",
        },
        {
          itemId: "padded-armour",
          rarity: "uncommon",
        },
        {
          itemId: "shield",
          rarity: "uncommon",
        },
        {
          itemId: "reinforced-armour",
          rarity: "rare",
        },
      ]),
    );
  });

  it("selects tactical items deterministically without replacement", () => {
    const first = selectDistinctCornucopiaBrainsOffenseItems(
      2,
      createSeededRandom("tactical-cache"),
    );

    const second = selectDistinctCornucopiaBrainsOffenseItems(
      2,
      createSeededRandom("tactical-cache"),
    );

    expect(second).toEqual(first);
    expect(first).toHaveLength(2);
    expect(new Set(first).size).toBe(2);
  });
});
