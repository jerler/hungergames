import { describe, expect, it } from "vitest";

import { createSeededRandom } from "~/game/engine/random";
import type { TributeStats } from "~/game/types/tribute";

import {
  isStatAtLeast,
  isStatAtMost,
  isSuccessfulStatCheckOutcome,
  resolveStatCheck,
  type EventStat,
  type StatCheckOutcome,
} from "./event-outcomes";

const BALANCED_STATS: TributeStats = {
  brains: 3,
  brawn: 3,
  luck: 3,
};

const EVENT_STATS: EventStat[] = ["brains", "brawn", "luck"];

function createFixedRandom(value: number): () => number {
  return () => value;
}

function createOutcomeSequence(seed: string): StatCheckOutcome[] {
  const random = createSeededRandom(seed);

  return Array.from({ length: 20 }, () =>
    resolveStatCheck({
      stats: BALANCED_STATS,
      stat: "luck",
      difficulty: 3,
      random,
    }),
  );
}

describe("resolveStatCheck", () => {
  it.each([
    [0.05, "critical-failure"],
    [0.25, "failure"],
    [0.65, "success"],
    [0.95, "exceptional-success"],
  ] as const)("returns %s as %s for a balanced check", (randomValue, expectedOutcome) => {
    expect(
      resolveStatCheck({
        stats: BALANCED_STATS,
        stat: "luck",
        difficulty: 3,
        random: createFixedRandom(randomValue),
      }),
    ).toBe(expectedOutcome);
  });

  it.each(EVENT_STATS)("supports the %s stat", (stat) => {
    const stats: TributeStats = {
      brains: 1,
      brawn: 1,
      luck: 1,
    };

    stats[stat] = 5;

    expect(
      resolveStatCheck({
        stats,
        stat,
        difficulty: 3,
        random: createFixedRandom(0.25),
      }),
    ).toBe("success");
  });

  it("makes easier checks more favourable", () => {
    const easyOutcome = resolveStatCheck({
      stats: BALANCED_STATS,
      stat: "brains",
      difficulty: 1,
      random: createFixedRandom(0.25),
    });

    const hardOutcome = resolveStatCheck({
      stats: BALANCED_STATS,
      stat: "brains",
      difficulty: 5,
      random: createFixedRandom(0.25),
    });

    expect(easyOutcome).toBe("success");

    expect(hardOutcome).toBe("failure");
  });

  it("uses the seeded random source deterministically", () => {
    expect(createOutcomeSequence("same-event-seed")).toEqual(
      createOutcomeSequence("same-event-seed"),
    );
  });

  it("allows rare bad outcomes for highly skilled tributes", () => {
    expect(
      resolveStatCheck({
        stats: {
          brains: 5,
          brawn: 5,
          luck: 5,
        },
        stat: "luck",
        difficulty: 1,
        random: createFixedRandom(0.001),
      }),
    ).toBe("critical-failure");
  });

  it("allows rare exceptional outcomes for poorly matched tributes", () => {
    expect(
      resolveStatCheck({
        stats: {
          brains: 1,
          brawn: 1,
          luck: 1,
        },
        stat: "luck",
        difficulty: 5,
        random: createFixedRandom(0.999),
      }),
    ).toBe("exceptional-success");
  });
});

describe("stat eligibility helpers", () => {
  it("checks minimum stat requirements", () => {
    expect(isStatAtLeast(BALANCED_STATS, "luck", 3)).toBe(true);

    expect(isStatAtLeast(BALANCED_STATS, "luck", 4)).toBe(false);
  });

  it("checks maximum stat requirements", () => {
    expect(isStatAtMost(BALANCED_STATS, "luck", 3)).toBe(true);

    expect(isStatAtMost(BALANCED_STATS, "luck", 2)).toBe(false);
  });

  it.each([
    ["critical-failure", false],
    ["failure", false],
    ["success", true],
    ["exceptional-success", true],
  ] as const)("identifies %s as successful: %s", (outcome, expected) => {
    expect(isSuccessfulStatCheckOutcome(outcome)).toBe(expected);
  });
});
