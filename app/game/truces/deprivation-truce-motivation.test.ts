import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";

import { getCooperativeTruceWeight, getDeprivationTruceMultiplier } from "./truce-selection";

const ROUND = {
  day: 3,
  period: "day",
} as const;

function withStatuses(statusIds: readonly ("hungry" | "thirsty")[]) {
  const tribute = createAuthoringTestTribute({
    id: statusIds.join("-") || "ordinary",
  });

  return {
    ...tribute,
    statuses: statusIds.map((statusId) =>
      createStatusEffectInstance(`status-${statusId}`, tribute.id, statusId, 1, ROUND),
    ),
  };
}

describe("deprivation truce motivation", () => {
  it("applies moderate capped multipliers", () => {
    expect(getDeprivationTruceMultiplier(withStatuses([]))).toBe(1);
    expect(getDeprivationTruceMultiplier(withStatuses(["hungry"]))).toBeCloseTo(1.2);
    expect(getDeprivationTruceMultiplier(withStatuses(["thirsty"]))).toBeCloseTo(1.25);
    expect(getDeprivationTruceMultiplier(withStatuses(["hungry", "thirsty"]))).toBeCloseTo(1.5);
  });

  it("raises cooperative selection weight without changing eligibility", () => {
    const ordinary = withStatuses([]);
    const hungry = withStatuses(["hungry"]);

    expect(
      getCooperativeTruceWeight(createAuthoringTestGame([hungry]), hungry, []),
    ).toBeGreaterThan(getCooperativeTruceWeight(createAuthoringTestGame([ordinary]), ordinary, []));
  });
});
