import { describe, expect, it } from "vitest";

import {
  CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS,
  CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS,
  CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS,
  CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS,
  CORNUCOPIA_PACK_ITEM_POOL,
} from "~/game/events/catalogue/bloodbath/cornucopia-item-pool";

import { COMBAT_EVENTS } from "~/game/events/catalogue/encounters/combat-events";

import { TACTICAL_EVENTS } from "~/game/events/catalogue/encounters/tactical-events";

import { getItemDefinition } from "~/game/items/item-catalogue";

import type { ItemDefinitionId, ItemOffenseCapability } from "~/game/items/item-schema";

const DIRECT_WEAPON_ITEM_IDS = [
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

const TACTICAL_OFFENSE_CONTRACTS = [
  {
    eventId: "blowgun-poison-attack",

    itemId: "blowgun",

    strategy: "poison",
  },

  {
    eventId: "poison-vial-attack",

    itemId: "poison-vial",

    strategy: "poison",
  },

  {
    eventId: "bear-trap-attack",

    itemId: "bear-trap",

    strategy: "trap",
  },

  {
    eventId: "tripwire-attack",

    itemId: "tripwire",

    strategy: "trap",
  },

  {
    eventId: "firebomb-attack",

    itemId: "firebomb",

    strategy: "risky-area",
  },
] as const satisfies readonly {
  eventId: string;

  itemId: ItemDefinitionId;

  strategy: ItemOffenseCapability["strategy"];
}[];

const DEFENSIVE_EQUIPMENT_ITEM_IDS = [
  "shield",
  "helmet",
  "padded-armour",
  "reinforced-armour",
] as const satisfies readonly ItemDefinitionId[];

const MINIMUM_STAT_REQUIREMENTS = [
  {
    itemId: "short-sword",

    stat: "brawn",

    minimum: 2,
  },

  {
    itemId: "rapier",

    stat: "brawn",

    minimum: 2,
  },

  {
    itemId: "longsword",

    stat: "brawn",

    minimum: 3,
  },

  {
    itemId: "greatsword",

    stat: "brawn",

    minimum: 4,
  },

  {
    itemId: "spear",

    stat: "brawn",

    minimum: 2,
  },

  {
    itemId: "pike",

    stat: "brawn",

    minimum: 2,
  },

  {
    itemId: "trident",

    stat: "brawn",

    minimum: 2,
  },

  {
    itemId: "longbow",

    stat: "brawn",

    minimum: 3,
  },

  {
    itemId: "warhammer",

    stat: "brawn",

    minimum: 5,
  },

  {
    itemId: "crossbow",

    stat: "brains",

    minimum: 2,
  },

  {
    itemId: "blowgun",

    stat: "brains",

    minimum: 3,
  },

  {
    itemId: "poison-vial",

    stat: "brains",

    minimum: 4,
  },

  {
    itemId: "bear-trap",

    stat: "brains",

    minimum: 3,
  },

  {
    itemId: "tripwire",

    stat: "brains",

    minimum: 3,
  },

  {
    itemId: "firebomb",

    stat: "brains",

    minimum: 3,
  },
] as const;

describe("combat equipment contract", () => {
  it("configures every required weapon minimum", () => {
    for (const { itemId, stat, minimum } of MINIMUM_STAT_REQUIREMENTS) {
      expect(getItemDefinition(itemId).minimumStats?.[stat]).toBe(minimum);
    }
  });

  it("gives every direct weapon one checked combat route", () => {
    const combatItemIds = COMBAT_EVENTS.flatMap((event) =>
      event.roles.flatMap((role) => role.requiredItemDefinitionIds ?? []),
    );

    expect(new Set(combatItemIds)).toEqual(new Set(DIRECT_WEAPON_ITEM_IDS));

    for (const event of COMBAT_EVENTS) {
      expect(event.category).toBe("hazard");

      expect(event.safetyResolution).toBe("force-success");

      const attackerRole = event.roles.find((role) => role.id === "killer");

      expect(attackerRole?.requiredItemRequireUsable).toBe(true);
    }
  });

  it("uses only direct weapons in contested weapon pools", () => {
    expect(new Set(CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS)).toEqual(
      new Set(DIRECT_WEAPON_ITEM_IDS),
    );

    for (const itemId of CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS) {
      expect(getItemDefinition(itemId).offense?.strategy).toBe("direct");
    }
  });

  it("maps every tactical item to its intended attack strategy", () => {
    for (const { eventId, itemId, strategy } of TACTICAL_OFFENSE_CONTRACTS) {
      const definition = TACTICAL_EVENTS.find((candidate) => candidate.id === eventId);

      expect(definition).toBeDefined();

      expect(definition?.category).toBe("hazard");

      expect(definition?.safetyResolution).toBeUndefined();

      const attackerRole = definition?.roles.find((role) => role.id === "killer");

      expect(attackerRole?.requiredItemDefinitionIds).toEqual([itemId]);

      expect(attackerRole?.requiredItemRequireUsable).toBe(true);

      expect(getItemDefinition(itemId).offense?.strategy).toBe(strategy);
    }
  });

  it("keeps firebomb attacks single-target", () => {
    const firebombEvent = TACTICAL_EVENTS.find((event) => event.id === "firebomb-attack");

    expect(firebombEvent).toBeDefined();

    const victimRole = firebombEvent?.roles.find((role) => role.id === "victim");

    expect(victimRole).toMatchObject({
      count: 1,
    });
  });

  it("keeps slingshots outside lethal combat", () => {
    expect(getItemDefinition("slingshot").offense).toBeUndefined();

    expect(
      COMBAT_EVENTS.some((event) =>
        event.roles.some((role) => role.requiredItemDefinitionIds?.includes("slingshot")),
      ),
    ).toBe(false);

    expect(CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS).not.toContain("slingshot");

    expect(CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS).not.toContain("slingshot");

    expect(CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS).not.toContain("slingshot");
  });

  it("defines every defensive item through centralized defense capabilities", () => {
    for (const itemId of DEFENSIVE_EQUIPMENT_ITEM_IDS) {
      const definition = getItemDefinition(itemId);

      expect(definition.tags).toContain("defense");

      expect(definition.defense).toBeDefined();

      expect(definition.defense?.checkedAttackBonus).toBeGreaterThan(0);

      expect(definition.defense?.hostileTargetWeightMultiplier).toBeGreaterThan(0);

      expect(definition.defense?.hostileTargetWeightMultiplier).toBeLessThan(1);
    }
  });

  it("provides every combat item with a legal Cornucopia route", () => {
    const reachableItemIds = new Set<ItemDefinitionId>([
      ...CORNUCOPIA_PACK_ITEM_POOL.map((entry) => entry.itemId),

      ...CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS,

      ...CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS,

      ...CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS,
    ]);

    const requiredItemIds = [
      ...DIRECT_WEAPON_ITEM_IDS,

      ...TACTICAL_OFFENSE_CONTRACTS.map((contract) => contract.itemId),

      ...DEFENSIVE_EQUIPMENT_ITEM_IDS,

      "slingshot",
    ] as const;

    for (const itemId of requiredItemIds) {
      expect(
        reachableItemIds.has(itemId),
        `Expected "${itemId}" to have a Cornucopia acquisition route.`,
      ).toBe(true);

      expect(getItemDefinition(itemId).origin).toBe("manufactured");
    }
  });

  it("keeps the Brains-oriented cache focused on usable offensive equipment", () => {
    expect(CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS).toEqual([
      "crossbow",
      "blowgun",
      "poison-vial",
      "bear-trap",
      "tripwire",
      "firebomb",
    ]);

    for (const itemId of CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS) {
      const definition = getItemDefinition(itemId);

      expect(definition.offense).toBeDefined();

      expect(definition.minimumStats?.brains).toBeDefined();
    }
  });
});
