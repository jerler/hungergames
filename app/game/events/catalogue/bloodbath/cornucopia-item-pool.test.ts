import { describe, expect, it } from "vitest";

import { createSeededRandom } from "~/game/engine/random";

import { getItemDefinition } from "~/game/items/item-catalogue";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import {
  CORNUCOPIA_PACK_ITEM_POOL,
  selectCornucopiaPackItem,
  selectDistinctCornucopiaPackItems,
  type CornucopiaPackRarity,
} from "./cornucopia-item-pool";

const PHASE_SEVEN_CONSUMABLE_IDS = [
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
  it("contains every Phase 7 manufactured consumable", () => {
    const poolItemIds = CORNUCOPIA_PACK_ITEM_POOL.map((entry) => entry.itemId);

    expect(poolItemIds).toEqual(expect.arrayContaining([...PHASE_SEVEN_CONSUMABLE_IDS]));
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
});
