import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  createInventoryItemInstance,
  findAccessibleInventoryItem,
  findUsableInventoryItem,
} from "~/game/items/inventory-engine";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameState, GameTribute } from "~/game/types/game-state";
import { getStrongestUsableDirectWeaponBonus } from "~/game/engine/stat-formulas";
import {
  getItemDefinitionUsability,
  getItemUsability,
  isItemDefinitionUsableBy,
  isItemUsableBy,
} from "~/game/items/item-usability";

const ROUND = {
  day: 2,
  period: "day",
} as const;

function giveSpear(tribute: GameTribute): GameTribute {
  return {
    ...tribute,

    inventory: [
      ...tribute.inventory,

      createInventoryItemInstance("spear-usability-test", tribute.id, "spear", ROUND),
    ],
  };
}

function createSharedState(owner: GameTribute, borrower: GameTribute): GameState {
  const game = createAuthoringTestGame([owner, borrower]);

  const truce = createTruceInstance("item-usability-truce", [owner.id, borrower.id], ROUND, {
    day: 3,
    period: "day",
  });

  return {
    ...game,
    truces: [truce],
  };
}

describe("item usability", () => {
  it("allows a tribute to own an item they cannot use", () => {
    const tribute = giveSpear(
      createAuthoringTestTribute({
        stats: {
          brains: 3,
          brawn: 1,
          luck: 3,
        },
      }),
    );

    const spear = tribute.inventory[0];

    if (!spear) {
      throw new Error("Expected a spear fixture.");
    }

    expect(tribute.inventory).toHaveLength(1);

    expect(isItemUsableBy(tribute, spear)).toBe(false);

    expect(
      findUsableInventoryItem(tribute, {
        definitionIds: ["spear"],
      }),
    ).toBeNull();

    expect(tribute.inventory).toEqual([spear]);
  });

  it("returns readable minimum-stat reasons", () => {
    const tribute = giveSpear(
      createAuthoringTestTribute({
        name: "Weak Tribute",

        stats: {
          brains: 3,
          brawn: 1,
          luck: 3,
        },
      }),
    );

    const spear = tribute.inventory[0];

    if (!spear) {
      throw new Error("Expected a spear fixture.");
    }

    expect(getItemUsability(tribute, spear)).toEqual({
      usable: false,

      reasons: ["Requires Brawn 2; Weak Tribute has 1."],
    });
  });

  it("treats depleted limited-use items as unusable", () => {
    const tribute = createAuthoringTestTribute();

    const matches = {
      ...createInventoryItemInstance("depleted-item-test", tribute.id, "matches", ROUND),

      usesRemaining: 0,
    };

    expect(getItemUsability(tribute, matches)).toEqual({
      usable: false,
      reasons: ["No uses remain."],
    });
  });

  it("does not grant direct-weapon bonuses from unusable items", () => {
    const weakTribute = giveSpear(
      createAuthoringTestTribute({
        stats: {
          brains: 3,
          brawn: 1,
          luck: 3,
        },
      }),
    );

    const strongTribute = giveSpear(
      createAuthoringTestTribute({
        id: "strong-tribute",

        stats: {
          brains: 3,
          brawn: 3,
          luck: 3,
        },
      }),
    );

    expect(getStrongestUsableDirectWeaponBonus(weakTribute)).toBe(0);

    expect(getStrongestUsableDirectWeaponBonus(strongTribute)).toBe(1.15);
  });

  it("lets a qualified borrower use another tribute's item", () => {
    const owner = giveSpear(
      createAuthoringTestTribute({
        id: "owner",

        stats: {
          brains: 3,
          brawn: 1,
          luck: 3,
        },
      }),
    );

    const borrower = createAuthoringTestTribute({
      id: "borrower",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },
    });

    const state = createSharedState(owner, borrower);

    const selection = findAccessibleInventoryItem(state, borrower, {
      definitionIds: ["spear"],
    });

    expect(selection).not.toBeNull();

    expect(selection?.owner.id).toBe(owner.id);

    expect(selection?.item.id).toBe(owner.inventory[0]?.id);
  });

  it("does not let an unqualified borrower use another tribute's item", () => {
    const owner = giveSpear(
      createAuthoringTestTribute({
        id: "owner",

        stats: {
          brains: 3,
          brawn: 4,
          luck: 3,
        },
      }),
    );

    const borrower = createAuthoringTestTribute({
      id: "borrower",

      stats: {
        brains: 3,
        brawn: 1,
        luck: 3,
      },
    });

    const state = createSharedState(owner, borrower);

    expect(
      findAccessibleInventoryItem(state, borrower, {
        definitionIds: ["spear"],
      }),
    ).toBeNull();
  });

  it("supports explicit access checks without requiring usability", () => {
    const owner = giveSpear(
      createAuthoringTestTribute({
        id: "owner",

        stats: {
          brains: 3,
          brawn: 4,
          luck: 3,
        },
      }),
    );

    const borrower = createAuthoringTestTribute({
      id: "borrower",

      stats: {
        brains: 3,
        brawn: 1,
        luck: 3,
      },
    });

    const state = createSharedState(owner, borrower);

    const selection = findAccessibleInventoryItem(state, borrower, {
      definitionIds: ["spear"],
      requireUsable: false,
    });

    expect(selection?.owner.id).toBe(owner.id);

    expect(selection?.item.id).toBe(owner.inventory[0]?.id);
  });

  it("evaluates definition-level Brawn requirements", () => {
    const tribute = createAuthoringTestTribute({
      name: "Almost Strong Enough",

      stats: {
        brains: 3,
        brawn: 4,
        luck: 3,
      },
    });

    expect(getItemDefinitionUsability(tribute, "warhammer")).toEqual({
      usable: false,

      reasons: ["Requires Brawn 5; Almost Strong Enough has 4."],
    });

    expect(isItemDefinitionUsableBy(tribute, "warhammer")).toBe(false);
  });

  it("evaluates definition-level Brains requirements", () => {
    const tribute = createAuthoringTestTribute({
      name: "Careless Tribute",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },
    });

    expect(getItemDefinitionUsability(tribute, "poison-vial")).toEqual({
      usable: false,

      reasons: ["Requires Brains 4; Careless Tribute has 3."],
    });
  });

  it("allows a tribute meeting definition requirements", () => {
    const tribute = createAuthoringTestTribute({
      stats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },
    });

    expect(getItemDefinitionUsability(tribute, "warhammer")).toEqual({
      usable: true,
      reasons: [],
    });
  });

  it("allows a tribute meeting definition requirements", () => {
    const tribute = createAuthoringTestTribute({
      stats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },
    });

    expect(getItemDefinitionUsability(tribute, "warhammer")).toEqual({
      usable: true,
      reasons: [],
    });
  });

  it("uses the same requirement messages for definitions and instances", () => {
    const tribute = createAuthoringTestTribute({
      name: "Weak Tribute",

      stats: {
        brains: 3,
        brawn: 1,
        luck: 3,
      },
    });

    const spear = createInventoryItemInstance(
      "message-consistency-test",
      tribute.id,
      "spear",
      ROUND,
    );

    expect(getItemDefinitionUsability(tribute, "spear").reasons).toEqual(
      getItemUsability(tribute, spear).reasons,
    );
  });
});
