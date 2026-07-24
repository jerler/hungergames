import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { NightRestQuality } from "~/game/survival/survival-schema";
import type { GameTribute, RoundReference } from "~/game/types/game-state";

import {
  getNightRestTargetingWeightMultiplier,
  UNSHELTERED_NIGHT_TARGET_WEIGHT_MULTIPLIER,
} from "./night-rest-targeting";

const NIGHT_TWO = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

const DAY_TWO = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

function withNightRest(
  tribute: GameTribute,
  quality: NightRestQuality,
  round: RoundReference = NIGHT_TWO,
): GameTribute {
  return {
    ...tribute,

    survival: {
      ...tribute.survival,

      lastNightRest: {
        round: {
          ...round,
        },

        quality,
      },
    },
  };
}

describe("night-rest targeting", () => {
  it("increases current-night hostile targeting for unsheltered tributes", () => {
    const tribute = withNightRest(createAuthoringTestTribute(), "unsheltered");

    expect(
      getNightRestTargetingWeightMultiplier(tribute, {
        round: NIGHT_TWO,
        isHostileTarget: true,
        isEnvironmentalHazard: false,
      }),
    ).toBe(UNSHELTERED_NIGHT_TARGET_WEIGHT_MULTIPLIER);
  });

  it("increases current-night environmental targeting for unsheltered tributes", () => {
    const tribute = withNightRest(createAuthoringTestTribute(), "unsheltered");

    expect(
      getNightRestTargetingWeightMultiplier(tribute, {
        round: NIGHT_TWO,
        isHostileTarget: false,
        isEnvironmentalHazard: true,
      }),
    ).toBe(UNSHELTERED_NIGHT_TARGET_WEIGHT_MULTIPLIER);
  });

  it.each(["sheltered", "comfortable"] as const)(
    "does not increase targeting after %s rest",
    (quality) => {
      const tribute = withNightRest(createAuthoringTestTribute(), quality);

      expect(
        getNightRestTargetingWeightMultiplier(tribute, {
          round: NIGHT_TWO,
          isHostileTarget: true,
          isEnvironmentalHazard: true,
        }),
      ).toBe(1);
    },
  );

  it("does not use a stale previous-night result", () => {
    const tribute = withNightRest(createAuthoringTestTribute(), "unsheltered", {
      day: 1,
      period: "night",
    });

    expect(
      getNightRestTargetingWeightMultiplier(tribute, {
        round: NIGHT_TWO,
        isHostileTarget: true,
        isEnvironmentalHazard: true,
      }),
    ).toBe(1);
  });

  it("does not affect daytime targeting", () => {
    const tribute = withNightRest(createAuthoringTestTribute(), "unsheltered", NIGHT_TWO);

    expect(
      getNightRestTargetingWeightMultiplier(tribute, {
        round: DAY_TWO,
        isHostileTarget: true,
        isEnvironmentalHazard: true,
      }),
    ).toBe(1);
  });

  it("does not affect neutral non-environmental events", () => {
    const tribute = withNightRest(createAuthoringTestTribute(), "unsheltered");

    expect(
      getNightRestTargetingWeightMultiplier(tribute, {
        round: NIGHT_TWO,
        isHostileTarget: false,
        isEnvironmentalHazard: false,
      }),
    ).toBe(1);
  });
});
