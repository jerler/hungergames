import { describe, expect, it } from "vitest";

import { getEffectiveLuck, getEffectiveStats } from "~/game/engine/effective-stats";
import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { GameTribute } from "~/game/types/game-state";

const ROUND = {
  day: 2,
  period: "day",
} as const;

function withLucky(tribute: GameTribute, severity: 1 | 2 | 3): GameTribute {
  return {
    ...tribute,
    statuses: [
      ...tribute.statuses,
      createStatusEffectInstance("lucky-test", tribute.id, "lucky", severity, ROUND),
    ],
  };
}

describe("effective stats", () => {
  it("returns base Luck without the lucky status", () => {
    const tribute = createAuthoringTestTribute({
      stats: {
        brains: 3,
        brawn: 3,
        luck: 2,
      },
    });

    expect(getEffectiveLuck(tribute)).toBe(2);
  });

  it("adds lucky severity to effective Luck", () => {
    const tribute = withLucky(
      createAuthoringTestTribute({
        stats: {
          brains: 3,
          brawn: 3,
          luck: 2,
        },
      }),
      2,
    );

    expect(getEffectiveLuck(tribute)).toBe(4);
  });

  it("caps effective Luck at five", () => {
    const tribute = withLucky(
      createAuthoringTestTribute({
        stats: {
          brains: 3,
          brawn: 3,
          luck: 4,
        },
      }),
      3,
    );

    expect(getEffectiveLuck(tribute)).toBe(5);
  });

  it("does not mutate permanent tribute stats", () => {
    const tribute = withLucky(
      createAuthoringTestTribute({
        stats: {
          brains: 2,
          brawn: 4,
          luck: 3,
        },
      }),
      2,
    );

    const effectiveStats = getEffectiveStats(tribute);

    expect(effectiveStats).toEqual({
      brains: 2,
      brawn: 4,
      luck: 5,
    });

    expect(tribute.snapshot.stats).toEqual({
      brains: 2,
      brawn: 4,
      luck: 3,
    });
  });
});
