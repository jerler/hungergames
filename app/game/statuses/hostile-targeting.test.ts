import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";
import { getHostileTargetingWeightMultiplier } from "~/game/statuses/hostile-targeting";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { GameTribute } from "~/game/types/game-state";

const ROUND = {
  day: 2,
  period: "night",
} as const;

function withHidden(tribute: GameTribute, severity: 1 | 2 | 3): GameTribute {
  return {
    ...tribute,
    statuses: [
      ...tribute.statuses,
      createStatusEffectInstance("hidden-test", tribute.id, "hidden", severity, ROUND),
    ],
  };
}

describe("hostile targeting", () => {
  it("uses full weight without hidden", () => {
    const tribute = createAuthoringTestTribute();

    expect(getHostileTargetingWeightMultiplier(tribute)).toBe(1);
  });

  it.each([
    {
      severity: 1,
      expectedMultiplier: 2 / 3,
    },
    {
      severity: 2,
      expectedMultiplier: 1 / 3,
    },
    {
      severity: 3,
      expectedMultiplier: 0,
    },
  ] as const)("applies the Hidden $severity multiplier", ({ severity, expectedMultiplier }) => {
    const tribute = withHidden(createAuthoringTestTribute(), severity);

    expect(getHostileTargetingWeightMultiplier(tribute)).toBeCloseTo(expectedMultiplier);
  });
});
