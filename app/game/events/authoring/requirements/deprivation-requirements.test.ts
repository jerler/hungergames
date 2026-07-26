import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import { evaluateCandidateRequirement } from "./evaluate-requirement";
import { isHungerStatusEligible, isThirstStatusEligible } from "./status-requirements";

const DAY_THREE = {
  day: 3,
  period: "day",
} as const;

describe("deprivation status requirements", () => {
  it("requires the threshold and no matching protection", () => {
    const tribute = createAuthoringTestTribute({
      id: "eligible-tribute",
    });
    const state = {
      ...createAuthoringTestGame([tribute]),
      currentRound: DAY_THREE,
    };
    const context = {
      state,
      round: DAY_THREE,
      livingTributes: [tribute],
      participantsByRole: {},
    };

    expect(evaluateCandidateRequirement(isHungerStatusEligible("tribute"), tribute, context)).toBe(
      true,
    );
    expect(evaluateCandidateRequirement(isThirstStatusEligible("tribute"), tribute, context)).toBe(
      true,
    );

    const protectedTribute = withAuthoringTestItem(tribute, "cornucopia-provisions");

    expect(
      evaluateCandidateRequirement(isHungerStatusEligible("tribute"), protectedTribute, {
        ...context,
        state: {
          ...state,
          tributes: [protectedTribute],
        },
        livingTributes: [protectedTribute],
      }),
    ).toBe(false);
  });
});
