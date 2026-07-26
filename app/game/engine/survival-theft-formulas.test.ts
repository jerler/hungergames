import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { GameTribute } from "~/game/types/game-state";

import {
  getSurvivalNeedTheftThiefWeight,
  isEligibleSurvivalNeedTheftTarget,
} from "./survival-theft-formulas";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const;

const DAY_THREE = {
  day: 3,
  period: "day",
} as const;

function withLastMeal(tribute: GameTribute): GameTribute {
  return {
    ...tribute,
    survival: {
      ...tribute.survival,
      lastFoundFoodRound: DAY_TWO,
    },
  };
}

function createThiefContext(thief: GameTribute, target?: GameTribute) {
  const tributes = target ? [thief, target] : [thief];

  return {
    state: {
      ...createAuthoringTestGame(tributes),
      currentRound: DAY_THREE,
    },
    round: DAY_THREE,
    livingTributes: tributes,
    participantsByRole: {},
  };
}

describe("survival theft formulas", () => {
  it("weights matching deprivation status above eligibility, and eligibility above recent satisfaction", () => {
    const ordinary = withLastMeal(
      createAuthoringTestTribute({
        id: "recently-fed",
      }),
    );
    const eligible = createAuthoringTestTribute({
      id: "hunger-eligible",
    });
    const hungryBase = createAuthoringTestTribute({
      id: "hungry",
    });
    const hungry = {
      ...hungryBase,
      statuses: [
        createStatusEffectInstance("existing-hunger", hungryBase.id, "hungry", 1, DAY_THREE),
      ],
    };

    const ordinaryWeight = getSurvivalNeedTheftThiefWeight(
      "food",
      ordinary,
      createThiefContext(ordinary),
    );
    const eligibleWeight = getSurvivalNeedTheftThiefWeight(
      "food",
      eligible,
      createThiefContext(eligible),
    );
    const hungryWeight = getSurvivalNeedTheftThiefWeight(
      "food",
      hungry,
      createThiefContext(hungry),
    );

    expect(eligibleWeight).toBeGreaterThan(ordinaryWeight);
    expect(hungryWeight).toBeGreaterThan(eligibleWeight);
  });

  it("rejects hungry and hunger-eligible targets while allowing recently fed or protected targets", () => {
    const thief = createAuthoringTestTribute({
      id: "thief",
      stats: {
        brains: 2,
        brawn: 1,
        luck: 2,
      },
    });
    const strongTarget = createAuthoringTestTribute({
      id: "target",
      stats: {
        brains: 4,
        brawn: 5,
        luck: 3,
      },
    });

    const context = {
      ...createThiefContext(thief, strongTarget),
      participantsByRole: {
        thief: [thief],
      },
    };

    expect(isEligibleSurvivalNeedTheftTarget("food", strongTarget, context)).toBe(false);

    const hungryTarget = {
      ...strongTarget,
      statuses: [
        createStatusEffectInstance("target-hunger", strongTarget.id, "hungry", 1, DAY_THREE),
      ],
    };

    expect(
      isEligibleSurvivalNeedTheftTarget("food", hungryTarget, {
        ...context,
        state: {
          ...context.state,
          tributes: [thief, hungryTarget],
        },
        livingTributes: [thief, hungryTarget],
      }),
    ).toBe(false);

    const fedTarget = withLastMeal(strongTarget);

    expect(
      isEligibleSurvivalNeedTheftTarget("food", fedTarget, {
        ...context,
        state: {
          ...context.state,
          tributes: [thief, fedTarget],
        },
        livingTributes: [thief, fedTarget],
      }),
    ).toBe(true);

    const protectedTarget = withAuthoringTestItem(strongTarget, "cornucopia-provisions");

    expect(
      isEligibleSurvivalNeedTheftTarget("food", protectedTarget, {
        ...context,
        state: {
          ...context.state,
          tributes: [thief, protectedTarget],
        },
        livingTributes: [thief, protectedTarget],
      }),
    ).toBe(true);
  });
});
