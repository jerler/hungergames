import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";

import {
  getAwarenessScore,
  getCombatScore,
  getForagingScore,
  getSurvivalScore,
} from "~/game/engine/stat-formulas";

import {
  getCheckedAttackDefenseBonus,
  getDefenseTargetWeightMultiplier,
} from "~/game/items/defensive-equipment";

import { createInventoryItemInstance } from "~/game/items/inventory-engine";

import {
  getNightAmbushItemTargetWeightMultiplier,
  getNightAwarenessItemBonus,
} from "~/game/items/item-contextual-capabilities";

import { getItemUsability } from "~/game/items/item-usability";

import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";

import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";

import { createDefaultGameConfig } from "~/game/types/game-config";

import type { GameTribute, InventoryItem } from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const NIGHT_ONE = {
  day: 1,
  period: "night",
} as const;

function createTribute(): GameTribute {
  const state = createInitialGameState(
    {
      ...createDefaultGameConfig(),
      districtCount: 6,
    },
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
    "random",
    {
      createId: () => "item-usability-effect-id",

      seed: "item-usability-effects",

      now: "2026-07-25T12:00:00.000Z",
    },
  );

  const tribute = state.tributes[0];

  if (!tribute) {
    throw new Error("Item usability test tribute is missing.");
  }

  return tribute;
}

function withItem(tribute: GameTribute, item: InventoryItem): GameTribute {
  return {
    ...tribute,
    inventory: [item],
  };
}

describe("unusable item effects", () => {
  it("does not grant direct or passive bonuses when minimum stats are unmet", () => {
    const tribute = createTribute();

    const weakTribute: GameTribute = {
      ...tribute,

      snapshot: {
        ...tribute.snapshot,

        stats: {
          ...tribute.snapshot.stats,
          brawn: 2,
        },
      },
    };

    const longbow = createInventoryItemInstance(
      "unusable-longbow",
      weakTribute.id,
      "longbow",
      DAY_ONE,
    );

    const equippedTribute = withItem(weakTribute, longbow);

    expect(getItemUsability(equippedTribute, longbow).usable).toBe(false);

    expect(getCombatScore(equippedTribute)).toBe(getCombatScore(weakTribute));

    expect(getAwarenessScore(equippedTribute)).toBe(getAwarenessScore(weakTribute));
  });

  it("does not grant passive bonuses from depleted items", () => {
    const tribute = createTribute();

    const depletedFishingGear = {
      ...createInventoryItemInstance("depleted-fishing-gear", tribute.id, "fishing-gear", DAY_ONE),

      usesRemaining: 0,
    };

    const equippedTribute = withItem(tribute, depletedFishingGear);

    expect(getItemUsability(equippedTribute, depletedFishingGear).usable).toBe(false);

    expect(getSurvivalScore(equippedTribute)).toBe(getSurvivalScore(tribute));

    expect(getForagingScore(equippedTribute)).toBe(getForagingScore(tribute));
  });

  it("does not grant contextual bonuses from unusable items", () => {
    const tribute = createTribute();

    const unusableGoggles = {
      ...createInventoryItemInstance(
        "unusable-goggles",
        tribute.id,
        "night-vision-goggles",
        DAY_ONE,
      ),

      usesRemaining: 0,
    };

    const equippedTribute = withItem(tribute, unusableGoggles);

    expect(getNightAwarenessItemBonus(equippedTribute, NIGHT_ONE)).toBe(0);

    expect(getNightAmbushItemTargetWeightMultiplier(equippedTribute, NIGHT_ONE, true)).toBe(1);
  });

  it("does not grant defensive effects from unusable equipment", () => {
    const tribute = createTribute();

    const unusableShield = {
      ...createInventoryItemInstance("unusable-shield", tribute.id, "shield", DAY_ONE),

      usesRemaining: 0,
    };

    const equippedTribute = withItem(tribute, unusableShield);

    expect(getCheckedAttackDefenseBonus(equippedTribute)).toBe(0);

    expect(getDefenseTargetWeightMultiplier(equippedTribute)).toBe(1);
  });
});
