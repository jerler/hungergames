import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  createInventoryItemInstance,
  findAccessibleInventoryItem,
  findUsableInventoryItem,
  getInventoryBonus,
} from "~/game/items/inventory-engine";
import { getItemUsability, isItemUsableBy } from "~/game/items/item-usability";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameState, GameTribute } from "~/game/types/game-state";

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

  it("does not grant passive bonuses from unusable items", () => {
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

    expect(getInventoryBonus(weakTribute, "combatBonus")).toBe(0);

    expect(getInventoryBonus(strongTribute, "combatBonus")).toBe(1.35);
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
});
