import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { EventSelectionContext } from "~/game/events/event-schema";
import type { GameState, GameTribute } from "~/game/types/game-state";
import type { TributeStats } from "~/game/types/tribute";

import {
  getTheftTargetWeight,
  getTheftThiefWeight,
  isMeaningfullyStrongerTheftTarget,
} from "./theft-formulas";

const TEST_ROUND = {
  day: 2,
  period: "day",
} as const;

function createTestGame(seed = "theft-formulas"): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,

    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),

    "random",

    {
      createId: () => {
        nextId += 1;

        return `${seed}-id-${nextId}`;
      },

      seed,

      now: "2026-07-22T12:00:00.000Z",
    },
  );
}

function createTestTribute({
  id,
  stats,
  itemDefinitionIds = [],
}: {
  id: string;
  stats: TributeStats;

  itemDefinitionIds?: readonly ItemDefinitionId[];
}): GameTribute {
  const baseTribute = createTestGame(`tribute-${id}`).tributes[0];

  const tribute: GameTribute = {
    ...baseTribute,
    id,

    snapshot: {
      ...baseTribute.snapshot,
      name: id,
      stats: {
        ...stats,
      },
    },

    statuses: [],

    inventory: itemDefinitionIds.map((definitionId, index) =>
      createInventoryItemInstance(`source-${id}-${index}`, id, definitionId, TEST_ROUND),
    ),
  };

  return tribute;
}

function createContext(tributes: readonly GameTribute[]): EventSelectionContext {
  const baseState = createTestGame("theft-context");

  const state: GameState = {
    ...baseState,
    tributes: [...tributes],
    truces: [],
  };

  return {
    state,
    round: TEST_ROUND,
    livingTributes: tributes,
  };
}

describe("theft weighting formulas", () => {
  it("favours a high-Brains thief over an otherwise equal low-Brains thief", () => {
    const target = createTestTribute({
      id: "target",

      stats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },

      itemDefinitionIds: ["bow"],
    });

    const lowBrains = createTestTribute({
      id: "low-brains",

      stats: {
        brains: 1,
        brawn: 2,
        luck: 3,
      },
    });

    const highBrains = createTestTribute({
      id: "high-brains",

      stats: {
        brains: 5,
        brawn: 2,
        luck: 3,
      },
    });

    expect(
      getTheftThiefWeight(
        highBrains,

        createContext([highBrains, target]),
      ),
    ).toBeGreaterThan(
      getTheftThiefWeight(
        lowBrains,

        createContext([lowBrains, target]),
      ),
    );
  });

  it("favours a high-Luck thief over an otherwise equal low-Luck thief", () => {
    const target = createTestTribute({
      id: "target",

      stats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },

      itemDefinitionIds: ["bow"],
    });

    const lowLuck = createTestTribute({
      id: "low-luck",

      stats: {
        brains: 3,
        brawn: 2,
        luck: 1,
      },
    });

    const highLuck = createTestTribute({
      id: "high-luck",

      stats: {
        brains: 3,
        brawn: 2,
        luck: 5,
      },
    });

    expect(
      getTheftThiefWeight(
        highLuck,

        createContext([highLuck, target]),
      ),
    ).toBeGreaterThan(
      getTheftThiefWeight(
        lowLuck,

        createContext([lowLuck, target]),
      ),
    );
  });

  it("favours lower direct-combat strength as an alternative to confrontation", () => {
    const target = createTestTribute({
      id: "target",

      stats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },

      itemDefinitionIds: ["bow"],
    });

    const weakerThief = createTestTribute({
      id: "weaker-thief",

      stats: {
        brains: 3,
        brawn: 1,
        luck: 3,
      },
    });

    const strongerThief = createTestTribute({
      id: "stronger-thief",

      stats: {
        brains: 3,
        brawn: 5,
        luck: 3,
      },
    });

    expect(
      getTheftThiefWeight(
        weakerThief,

        createContext([weakerThief, target]),
      ),
    ).toBeGreaterThan(
      getTheftThiefWeight(
        strongerThief,

        createContext([strongerThief, target]),
      ),
    );
  });

  it("favours an under-equipped thief over an otherwise equal well-equipped thief", () => {
    const target = createTestTribute({
      id: "target",

      stats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },

      itemDefinitionIds: ["bow"],
    });

    const underEquipped = createTestTribute({
      id: "under-equipped",

      stats: {
        brains: 4,
        brawn: 2,
        luck: 4,
      },
    });

    const wellEquipped = createTestTribute({
      id: "well-equipped",

      stats: {
        brains: 4,
        brawn: 2,
        luck: 4,
      },

      /*
       * Neither item changes direct combat score,
       * isolating the inventory-need factor.
       */
      itemDefinitionIds: ["map", "blanket"],
    });

    expect(
      getTheftThiefWeight(
        underEquipped,

        createContext([underEquipped, target]),
      ),
    ).toBeGreaterThan(
      getTheftThiefWeight(
        wellEquipped,

        createContext([wellEquipped, target]),
      ),
    );
  });

  it("favours a strong well-equipped target over a weak poorly equipped target", () => {
    const thief = createTestTribute({
      id: "thief",

      stats: {
        brains: 1,
        brawn: 1,
        luck: 1,
      },
    });

    const weakTarget = createTestTribute({
      id: "weak-target",

      stats: {
        brains: 2,
        brawn: 2,
        luck: 2,
      },

      itemDefinitionIds: ["food"],
    });

    const strongTarget = createTestTribute({
      id: "strong-target",

      stats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },

      itemDefinitionIds: ["bow", "medicine"],
    });

    expect(getTheftTargetWeight(strongTarget, thief)).toBeGreaterThan(
      getTheftTargetWeight(weakTarget, thief),
    );
  });

  it("favours a target carrying an item the thief lacks", () => {
    const target = createTestTribute({
      id: "target",

      stats: {
        brains: 4,
        brawn: 4,
        luck: 4,
      },

      itemDefinitionIds: ["rope"],
    });

    const thiefWithoutRope = createTestTribute({
      id: "thief-without-rope",

      stats: {
        brains: 2,
        brawn: 2,
        luck: 2,
      },
    });

    const thiefWithRope = createTestTribute({
      id: "thief-with-rope",

      stats: {
        brains: 2,
        brawn: 2,
        luck: 2,
      },

      /*
       * Rope provides no combat bonus, so the only
       * changed factor is whether the item is novel.
       */
      itemDefinitionIds: ["rope"],
    });

    expect(getTheftTargetWeight(target, thiefWithoutRope)).toBeGreaterThan(
      getTheftTargetWeight(target, thiefWithRope),
    );
  });

  it("requires at least a 0.5 combat-score advantage", () => {
    const thief = createTestTribute({
      id: "thief",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },
    });

    /*
     * One additional Brains point and one additional
     * Luck point produce a 0.45 advantage.
     */
    const insufficientTarget = createTestTribute({
      id: "insufficient-target",

      stats: {
        brains: 4,
        brawn: 3,
        luck: 4,
      },
    });

    /*
     * One additional Brawn point produces a 0.55
     * advantage under the combat formula.
     */
    const eligibleTarget = createTestTribute({
      id: "eligible-target",

      stats: {
        brains: 3,
        brawn: 4,
        luck: 3,
      },
    });

    expect(isMeaningfullyStrongerTheftTarget(insufficientTarget, thief)).toBe(false);

    expect(isMeaningfullyStrongerTheftTarget(eligibleTarget, thief)).toBe(true);
  });

  it("always returns positive weights for valid candidates", () => {
    const thief = createTestTribute({
      id: "thief",

      stats: {
        brains: 1,
        brawn: 5,
        luck: 1,
      },

      itemDefinitionIds: ["map", "blanket"],
    });

    const target = createTestTribute({
      id: "target",

      stats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },

      itemDefinitionIds: ["bow", "medicine"],
    });

    const context = createContext([thief, target]);

    expect(getTheftThiefWeight(thief, context)).toBeGreaterThan(0);

    expect(getTheftTargetWeight(target, thief)).toBeGreaterThan(0);
  });
});
