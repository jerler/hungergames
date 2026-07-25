import { selectRandomItem, selectWeightedItem, type RandomSource } from "~/game/engine/random";
import { getItemDefinition } from "~/game/items/item-catalogue";

import type { ItemDefinitionId } from "~/game/items/item-schema";

export const CORNUCOPIA_RARITY_WEIGHTS = {
  common: 6,
  standard: 4,
  uncommon: 2,
  rare: 1,
} as const;

export type CornucopiaPackRarity = keyof typeof CORNUCOPIA_RARITY_WEIGHTS;

export interface CornucopiaPackItemPoolEntry {
  itemId: ItemDefinitionId;
  rarity: CornucopiaPackRarity;
}

export const CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS = [
  "knife",
  "short-sword",
  "rapier",
  "spear",
  "trident",
  "bow",
  "hand-axe",
  "club",
] as const satisfies readonly ItemDefinitionId[];

export const CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS = [
  "longsword",
  "greatsword",
  "pike",
  "longbow",
  "axe",
  "warhammer",
] as const satisfies readonly ItemDefinitionId[];

/**
 * Brains-oriented acquisition route",
  "longbow",
  "axe",
  "warhammer",
] as const satisfies readonly ItemDefinitionId[].
 *
 * Crossbows are direct weapons, while the remaining
 * entries use the poison, trap, or risky-area families.
 */
export const CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS = [
  "crossbow",
  "blowgun",
  "poison-vial",
  "bear-trap",
  "tripwire",
  "firebomb",
] as const satisfies readonly ItemDefinitionId[];

export const CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS = [
  ...CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS,
  ...CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS,
  "crossbow",
] as const satisfies readonly ItemDefinitionId[];

export const CORNUCOPIA_PACK_ITEM_POOL = [
  // Common manufactured food, drink, and survival supplies
  {
    itemId: "bottled-water",
    rarity: "common",
  },
  {
    itemId: "soup",
    rarity: "common",
  },
  {
    itemId: "burger-and-fries",
    rarity: "common",
  },
  {
    itemId: "coffee",
    rarity: "common",
  },
  {
    itemId: "coca-cola",
    rarity: "common",
  },
  {
    itemId: "blanket",
    rarity: "common",
  },
  {
    itemId: "pillow",

    rarity: "common",
  },
  {
    itemId: "tarp",

    rarity: "common",
  },
  {
    itemId: "lighter",

    rarity: "common",
  },
  {
    itemId: "camouflage-paint",

    rarity: "common",
  },

  // Standard supplies
  {
    itemId: "pizza-box",
    rarity: "standard",
  },
  {
    itemId: "energy-drink",
    rarity: "standard",
  },
  {
    itemId: "hot-chocolate",
    rarity: "standard",
  },
  {
    itemId: "herbal-tea",
    rarity: "standard",
  },
  {
    itemId: "matches",
    rarity: "standard",
  },
  {
    itemId: "map",
    rarity: "standard",
  },
  {
    itemId: "bandages",
    rarity: "standard",
  },
  {
    itemId: "painkillers",
    rarity: "standard",
  },
  {
    itemId: "sleeping-bag",
    rarity: "standard",
  },
  {
    itemId: "thermal-blanket",
    rarity: "standard",
  },
  {
    itemId: "flint-stone",
    rarity: "standard",
  },
  {
    itemId: "bird-whistle",
    rarity: "standard",
  },
  {
    itemId: "binoculars",
    rarity: "standard",
  },
  {
    itemId: "slingshot",
    rarity: "standard",
  },
  {
    itemId: "helmet",
    rarity: "standard",
  },

  // Specialized equipment and medicine
  {
    itemId: "burn-kit",
    rarity: "uncommon",
  },
  {
    itemId: "foraging-guidebook",
    rarity: "uncommon",
  },
  {
    itemId: "camouflage-net",
    rarity: "uncommon",
  },
  {
    itemId: "fishing-gear",
    rarity: "uncommon",
  },
  {
    itemId: "trap-kit",
    rarity: "uncommon",
  },
  {
    itemId: "shield",
    rarity: "uncommon",
  },
  {
    itemId: "tent",
    rarity: "uncommon",
  },
  {
    itemId: "night-vision-goggles",
    rarity: "uncommon",
  },
  {
    itemId: "padded-armour",
    rarity: "uncommon",
  },

  // Powerful emergency medicine
  {
    itemId: "med-kit",
    rarity: "rare",
  },
  {
    itemId: "antidote",
    rarity: "rare",
  },
  {
    itemId: "reinforced-armour",
    rarity: "rare",
  },
] as const satisfies readonly CornucopiaPackItemPoolEntry[];

function validateCornucopiaPackItemPool(pool: readonly CornucopiaPackItemPoolEntry[]): void {
  if (pool.length === 0) {
    throw new Error("Cornucopia pack item pool cannot be empty.");
  }

  const itemIds = pool.map((entry) => entry.itemId);

  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error("Cornucopia pack item pool contains duplicate item IDs.");
  }

  for (const entry of pool) {
    const definition = getItemDefinition(entry.itemId);

    if (definition.origin !== "manufactured") {
      throw new Error(`Cornucopia pack item "${entry.itemId}" ` + "must be manufactured.");
    }

    const weight = CORNUCOPIA_RARITY_WEIGHTS[entry.rarity];

    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(`Cornucopia pack item "${entry.itemId}" ` + "has an invalid rarity weight.");
    }
  }
}

function validateUniqueItemPool(label: string, itemIds: readonly ItemDefinitionId[]): void {
  if (itemIds.length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }

  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error(`${label} contains duplicate item IDs.`);
  }

  for (const itemId of itemIds) {
    const definition = getItemDefinition(itemId);

    if (definition.origin !== "manufactured") {
      throw new Error(`${label} item "${itemId}" must be manufactured.`);
    }
  }
}

function validateDirectWeaponPool(label: string, itemIds: readonly ItemDefinitionId[]): void {
  validateUniqueItemPool(label, itemIds);

  for (const itemId of itemIds) {
    const definition = getItemDefinition(itemId);

    if (definition.offense?.strategy !== "direct") {
      throw new Error(`${label} item "${itemId}" must use direct offense.`);
    }
  }
}

function validateBrainsOffensePool(itemIds: readonly ItemDefinitionId[]): void {
  validateUniqueItemPool("Cornucopia Brains-offense pool", itemIds);

  for (const itemId of itemIds) {
    const definition = getItemDefinition(itemId);

    if (!definition.offense) {
      throw new Error(`Brains-offense item "${itemId}" has no offense capability.`);
    }

    if (definition.minimumStats?.brains === undefined) {
      throw new Error(`Brains-offense item "${itemId}" has no Brains minimum.`);
    }
  }
}

validateDirectWeaponPool(
  "Cornucopia edge direct-weapon pool",
  CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS,
);

validateDirectWeaponPool(
  "Cornucopia heavy direct-weapon pool",
  CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS,
);

validateDirectWeaponPool(
  "Cornucopia contested direct-weapon pool",
  CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS,
);

validateBrainsOffensePool(CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS);

validateCornucopiaPackItemPool(CORNUCOPIA_PACK_ITEM_POOL);

function getEntryWeight(entry: CornucopiaPackItemPoolEntry): number {
  return CORNUCOPIA_RARITY_WEIGHTS[entry.rarity];
}

export function selectCornucopiaPackItem(random: RandomSource): ItemDefinitionId {
  return selectWeightedItem(CORNUCOPIA_PACK_ITEM_POOL, getEntryWeight, random).itemId;
}

export function selectDistinctCornucopiaPackItems(
  count: number,
  random: RandomSource,
): ItemDefinitionId[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Cornucopia pack item count must be a non-negative integer.");
  }

  const remainingEntries = [...CORNUCOPIA_PACK_ITEM_POOL];

  const selectedItemIds: ItemDefinitionId[] = [];

  while (selectedItemIds.length < count && remainingEntries.length > 0) {
    const selectedEntry = selectWeightedItem(remainingEntries, getEntryWeight, random);

    selectedItemIds.push(selectedEntry.itemId);

    remainingEntries.splice(remainingEntries.indexOf(selectedEntry), 1);
  }

  return selectedItemIds;
}

function selectDistinctFromItemPool(
  itemIds: readonly ItemDefinitionId[],
  count: number,
  random: RandomSource,
): ItemDefinitionId[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Distinct item count must be a non-negative integer.");
  }

  const remainingItemIds = [...itemIds];
  const selectedItemIds: ItemDefinitionId[] = [];

  while (selectedItemIds.length < count && remainingItemIds.length > 0) {
    const selectedItemId = selectRandomItem(remainingItemIds, random);

    selectedItemIds.push(selectedItemId);

    remainingItemIds.splice(remainingItemIds.indexOf(selectedItemId), 1);
  }

  return selectedItemIds;
}

export function selectCornucopiaEdgeDirectWeapon(random: RandomSource): ItemDefinitionId {
  return selectRandomItem(CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS, random);
}

export function selectCornucopiaHeavyDirectWeapon(random: RandomSource): ItemDefinitionId {
  return selectRandomItem(CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS, random);
}

export function selectCornucopiaBrainsOffenseItem(random: RandomSource): ItemDefinitionId {
  return selectRandomItem(CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS, random);
}

export function selectDistinctCornucopiaBrainsOffenseItems(
  count: number,
  random: RandomSource,
): ItemDefinitionId[] {
  return selectDistinctFromItemPool(CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS, count, random);
}

export function selectCornucopiaContestedDirectWeapon(random: RandomSource): ItemDefinitionId {
  return selectRandomItem(CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS, random);
}
