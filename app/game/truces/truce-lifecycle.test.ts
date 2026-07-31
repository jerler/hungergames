import { describe, expect, it } from "vitest";

import {
  canFormStandardTruce,
  canStandardTruceVoluntarilyEnd,
  getOversizedStandardTruces,
  getStandardTruceBreakupAgeMultiplier,
  getStandardTruceFormationTimingMultiplier,
} from "~/game/truces/truce-lifecycle";
import { createTruceInstance } from "~/game/truces/truce-engine";
import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { RoundReference, Truce } from "~/game/types/game-state";

function round(day: number, period: "day" | "night"): RoundReference {
  return { day, period };
}

function createStandardTruce(createdRound: RoundReference = AUTHORING_TEST_ROUND): Truce {
  return createTruceInstance("lifecycle-truce", ["tribute-1", "tribute-2"], createdRound, {
    day: 99,
    period: "day",
  });
}

describe("standard truce lifecycle", () => {
  it("allows exactly 30 percent but blocks larger proposed truces", () => {
    expect(canFormStandardTruce(3, 10)).toBe(true);
    expect(canFormStandardTruce(2, 7)).toBe(true);
    expect(canFormStandardTruce(2, 6)).toBe(false);
    expect(canFormStandardTruce(4, 12)).toBe(false);
  });

  it("strongly favours formation during the first three days", () => {
    expect(getStandardTruceFormationTimingMultiplier(round(1, "day"))).toBe(1);
    expect(getStandardTruceFormationTimingMultiplier(round(2, "night"))).toBe(0.9);
    expect(getStandardTruceFormationTimingMultiplier(round(3, "day"))).toBe(0.65);
    expect(getStandardTruceFormationTimingMultiplier(round(4, "night"))).toBe(0.15);
    expect(getStandardTruceFormationTimingMultiplier(round(8, "day"))).toBe(0.05);
  });

  it("protects the creation round and keeps the first two cycles fragile only at low weight", () => {
    const truce = createStandardTruce(round(1, "day"));

    expect(canStandardTruceVoluntarilyEnd(truce, round(1, "day"))).toBe(false);
    expect(getStandardTruceBreakupAgeMultiplier(truce, round(1, "night"))).toBe(0.05);
    expect(getStandardTruceBreakupAgeMultiplier(truce, round(2, "day"))).toBe(0.1);
    expect(getStandardTruceBreakupAgeMultiplier(truce, round(2, "night"))).toBe(0.2);
    expect(getStandardTruceBreakupAgeMultiplier(truce, round(3, "day"))).toBe(0.55);
    expect(getStandardTruceBreakupAgeMultiplier(truce, round(4, "night"))).toBe(1.75);
  });

  it("identifies only standard truces above 30 percent as forced separations", () => {
    const tributes = Array.from({ length: 6 }, (_, index) =>
      createAuthoringTestTribute({
        id: `tribute-${index + 1}`,
      }),
    );
    const state = createAuthoringTestGame(tributes);
    const standard = createStandardTruce();
    const romantic = createTruceInstance(
      "romantic-truce",
      ["tribute-3", "tribute-4"],
      AUTHORING_TEST_ROUND,
      null,
      "romantic",
    );

    expect(
      getOversizedStandardTruces({
        ...state,
        truces: [standard, romantic],
      }).map((truce) => truce.id),
    ).toEqual([standard.id]);
  });
});
