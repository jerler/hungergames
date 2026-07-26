import { selectRandomItem, selectWeightedItem, type RandomSource } from "~/game/engine/random";
import { ITEM_CATALOGUE, getItemDefinition } from "~/game/items/item-catalogue";
import { isItemDefinitionUsableBy } from "~/game/items/item-usability";
import type { GameTribute } from "~/game/types/game-state";
import type { ItemDefinitionId } from "~/game/items/item-schema";

export const CORNUCOPIA_RARITY_WEIGHTS = {
  common: 8,
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
  // Common status-effect consumables and survival supplies
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

    if (definition.offense) {
      throw new Error(
        `Cornucopia pack item "${entry.itemId}" ` + "must not define an offense capability.",
      );
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

interface NamedItemPool {
  label: string;
  itemIds: readonly ItemDefinitionId[];
}

function validateDisjointItemPools(pools: readonly NamedItemPool[]): void {
  const ownerByItemId = new Map<ItemDefinitionId, string>();

  for (const pool of pools) {
    for (const itemId of pool.itemIds) {
      const existingOwner = ownerByItemId.get(itemId);

      if (existingOwner) {
        throw new Error(
          `Cornucopia item "${itemId}" appears in ` + `both ${existingOwner} and ${pool.label}.`,
        );
      }

      ownerByItemId.set(itemId, pool.label);
    }
  }
}

function validateContestedWeaponCoverage(): void {
  const expectedItemIds = new Set<ItemDefinitionId>([
    ...CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS,
    ...CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS,
    "crossbow",
  ]);

  const actualItemIds = new Set<ItemDefinitionId>(CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS);

  const missingItemIds = [...expectedItemIds].filter((itemId) => !actualItemIds.has(itemId));

  const unexpectedItemIds = [...actualItemIds].filter((itemId) => !expectedItemIds.has(itemId));

  if (missingItemIds.length > 0 || unexpectedItemIds.length > 0) {
    throw new Error(
      "Cornucopia contested direct-weapon pool " +
        "does not match the complete direct-weapon " +
        "acquisition set. " +
        `Missing: ${missingItemIds.join(", ") || "none"}. ` +
        `Unexpected: ${unexpectedItemIds.join(", ") || "none"}.`,
    );
  }
}

function validateManufacturedItemCoverage(): void {
  const acquiredItemIds = new Set<ItemDefinitionId>([
    ...CORNUCOPIA_PACK_ITEM_POOL.map((entry) => entry.itemId),

    ...CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS,

    ...CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS,

    ...CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS,
  ]);

  const manufacturedItemIds = ITEM_CATALOGUE.filter(
    (definition) => definition.origin === "manufactured",
  ).map((definition) => definition.id);

  const missingItemIds = manufacturedItemIds.filter((itemId) => !acquiredItemIds.has(itemId));

  if (missingItemIds.length > 0) {
    throw new Error(
      "Manufactured items are missing from " +
        "Cornucopia acquisition pools: " +
        `${missingItemIds.join(", ")}.`,
    );
  }

  const includedNaturalItemIds = ITEM_CATALOGUE.filter(
    (definition) => definition.origin === "natural-resource",
  )
    .map((definition) => definition.id)
    .filter((itemId) => acquiredItemIds.has(itemId));

  if (includedNaturalItemIds.length > 0) {
    throw new Error(
      "Natural resources must not appear in " +
        "Cornucopia acquisition pools: " +
        `${includedNaturalItemIds.join(", ")}.`,
    );
  }
}

export function validateCornucopiaItemPools(): void {
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

  validateDisjointItemPools([
    {
      label: "the pack pool",
      itemIds: CORNUCOPIA_PACK_ITEM_POOL.map((entry) => entry.itemId),
    },
    {
      label: "the edge direct-weapon pool",
      itemIds: CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS,
    },
    {
      label: "the heavy direct-weapon pool",
      itemIds: CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS,
    },
    {
      label: "the Brains-offense pool",
      itemIds: CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS,
    },
  ]);

  validatePoolHasUnrestrictedItem(
    "Cornucopia pack pool",
    CORNUCOPIA_PACK_ITEM_POOL.map((entry) => entry.itemId),
  );

  validatePoolHasUnrestrictedItem(
    "Cornucopia contested direct-weapon pool",
    CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS,
  );

  validateContestedWeaponCoverage();
  validateManufacturedItemCoverage();
}

function getEntryWeight(entry: CornucopiaPackItemPoolEntry): number {
  return CORNUCOPIA_RARITY_WEIGHTS[entry.rarity];
}

function getUsableItemIds(
  tribute: GameTribute,
  itemIds: readonly ItemDefinitionId[],
): ItemDefinitionId[] {
  return itemIds.filter((itemId) => isItemDefinitionUsableBy(tribute, itemId));
}

function getUsablePackEntries(tribute: GameTribute): CornucopiaPackItemPoolEntry[] {
  return CORNUCOPIA_PACK_ITEM_POOL.filter((entry) =>
    isItemDefinitionUsableBy(tribute, entry.itemId),
  );
}

function requireNonEmptyPool<T>(pool: readonly T[], label: string): readonly T[] {
  if (pool.length === 0) {
    throw new Error(`${label} has no usable items for the selected tribute.`);
  }

  return pool;
}

export function hasUsableCornucopiaPackItem(tribute: GameTribute): boolean {
  return getUsablePackEntries(tribute).length > 0;
}

export function hasUsableCornucopiaEdgeDirectWeapon(tribute: GameTribute): boolean {
  return getUsableItemIds(tribute, CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS).length > 0;
}

export function hasUsableCornucopiaHeavyDirectWeapon(tribute: GameTribute): boolean {
  return getUsableItemIds(tribute, CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS).length > 0;
}

export function hasUsableCornucopiaBrainsOffenseItem(tribute: GameTribute): boolean {
  return getUsableItemIds(tribute, CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS).length > 0;
}

export function hasUsableCornucopiaContestedDirectWeapon(tribute: GameTribute): boolean {
  return getUsableItemIds(tribute, CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS).length > 0;
}

export function selectCornucopiaPackItem(
  tribute: GameTribute,
  random: RandomSource,
): ItemDefinitionId {
  const usableEntries = requireNonEmptyPool(getUsablePackEntries(tribute), "Cornucopia pack pool");

  return selectWeightedItem(usableEntries, getEntryWeight, random).itemId;
}

export function selectDistinctCornucopiaPackItems(
  tribute: GameTribute,
  count: number,
  random: RandomSource,
): ItemDefinitionId[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Cornucopia pack item count must be a non-negative integer.");
  }

  const remainingEntries = [...getUsablePackEntries(tribute)];

  const selectedItemIds: ItemDefinitionId[] = [];

  while (selectedItemIds.length < count && remainingEntries.length > 0) {
    const selectedEntry = selectWeightedItem(remainingEntries, getEntryWeight, random);

    selectedItemIds.push(selectedEntry.itemId);

    remainingEntries.splice(remainingEntries.indexOf(selectedEntry), 1);
  }

  return selectedItemIds;
}

function selectDistinctFromItemPool(
  tribute: GameTribute,
  itemIds: readonly ItemDefinitionId[],
  count: number,
  random: RandomSource,
): ItemDefinitionId[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Distinct item count must be a non-negative integer.");
  }

  const remainingItemIds = getUsableItemIds(tribute, itemIds);

  const selectedItemIds: ItemDefinitionId[] = [];

  while (selectedItemIds.length < count && remainingItemIds.length > 0) {
    const selectedItemId = selectRandomItem(remainingItemIds, random);

    selectedItemIds.push(selectedItemId);

    remainingItemIds.splice(remainingItemIds.indexOf(selectedItemId), 1);
  }

  return selectedItemIds;
}

export function selectCornucopiaEdgeDirectWeapon(
  tribute: GameTribute,
  random: RandomSource,
): ItemDefinitionId {
  const usableItemIds = requireNonEmptyPool(
    getUsableItemIds(tribute, CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS),
    "Cornucopia edge direct-weapon pool",
  );

  return selectRandomItem(usableItemIds, random);
}

export function selectCornucopiaHeavyDirectWeapon(
  tribute: GameTribute,
  random: RandomSource,
): ItemDefinitionId {
  const usableItemIds = requireNonEmptyPool(
    getUsableItemIds(tribute, CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS),
    "Cornucopia heavy direct-weapon pool",
  );

  return selectRandomItem(usableItemIds, random);
}

export function selectCornucopiaBrainsOffenseItem(
  tribute: GameTribute,
  random: RandomSource,
): ItemDefinitionId {
  const usableItemIds = requireNonEmptyPool(
    getUsableItemIds(tribute, CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS),
    "Cornucopia Brains-offense pool",
  );

  return selectRandomItem(usableItemIds, random);
}

export function selectDistinctCornucopiaBrainsOffenseItems(
  tribute: GameTribute,
  count: number,
  random: RandomSource,
): ItemDefinitionId[] {
  return selectDistinctFromItemPool(tribute, CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS, count, random);
}

export function selectCornucopiaContestedDirectWeapon(
  tribute: GameTribute,
  random: RandomSource,
): ItemDefinitionId {
  const usableItemIds = requireNonEmptyPool(
    getUsableItemIds(tribute, CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS),
    "Cornucopia contested direct-weapon pool",
  );

  return selectRandomItem(usableItemIds, random);
}

function validatePoolHasUnrestrictedItem(
  label: string,
  itemIds: readonly ItemDefinitionId[],
): void {
  const hasUnrestrictedItem = itemIds.some((itemId) => {
    const minimumStats = getItemDefinition(itemId).minimumStats;

    return (
      minimumStats === undefined ||
      Object.values(minimumStats).every((minimumValue) => minimumValue === undefined)
    );
  });

  if (!hasUnrestrictedItem) {
    throw new Error(
      `${label} must contain at least one item ` + "without minimum-stat requirements.",
    );
  }
}
