import { describe, expect, it } from "vitest";

import { createSeededRandom, type RandomSource } from "~/game/engine/random";
import { createRoundSeed } from "~/game/engine/rounds";
import type { GameTribute } from "~/game/types/game-state";
import type { TributeStats, TributeStatValue } from "~/game/types/tribute";

import { assignBloodbathStrategies, determineCornucopiaCount } from "./bloodbath-strategy";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const FULL_GAME_TRIBUTE_COUNT = 24;
const SAMPLE_COUNT = 5_000;

const BALANCED_STATS = {
  brains: 3,
  brawn: 3,
  luck: 3,
} satisfies TributeStats;

function createBloodbathRandom(seed: string): RandomSource {
  return createSeededRandom(createRoundSeed(seed, DAY_ONE));
}

function createStats(stat: keyof TributeStats, value: TributeStatValue): TributeStats {
  return {
    ...BALANCED_STATS,
    [stat]: value,
  };
}

function createTribute(
  index: number,
  stats: TributeStats = BALANCED_STATS,
  id = `tribute-${index}`,
): GameTribute {
  return {
    id,
    sourceDefinitionId: null,

    district: Math.floor(index / 2) + 1,
    districtPosition: index % 2 === 0 ? 1 : 2,

    snapshot: {
      name: `Tribute ${index}`,
      pronouns: "they",
      portraitUrl: null,
      stats,
    },

    isAlive: true,
    death: null,
    statuses: [],
    inventory: [],
    allianceId: null,

    statistics: {
      kills: 0,
      attemptedKills: 0,
      giftsReceived: 0,
      eventsSurvived: 0,
    },
  };
}

function createTributes(count: number): GameTribute[] {
  return Array.from(
    {
      length: count,
    },
    (_, index) => createTribute(index),
  );
}

function sampleCornucopiaCounts(tributeCount: number): number[] {
  return Array.from(
    {
      length: SAMPLE_COUNT,
    },
    (_, seedIndex) =>
      determineCornucopiaCount(
        tributeCount,
        createBloodbathRandom(`bloodbath-quota-${tributeCount}-${seedIndex}`),
      ),
  );
}

function sampleApproachRates(variedStat: keyof TributeStats): {
  lowRate: number;
  highRate: number;
} {
  const lowTribute = createTribute(0, createStats(variedStat, 1), `low-${variedStat}`);

  const highTribute = createTribute(1, createStats(variedStat, 5), `high-${variedStat}`);

  const neutralTributes = Array.from(
    {
      length: FULL_GAME_TRIBUTE_COUNT - 2,
    },
    (_, index) => createTribute(index + 2),
  );

  let lowSelections = 0;
  let highSelections = 0;

  for (let seedIndex = 0; seedIndex < SAMPLE_COUNT; seedIndex += 1) {
    /*
     * Alternate their input positions so the comparison does
     * not accidentally depend on candidate-array ordering.
     */
    const comparedTributes =
      seedIndex % 2 === 0 ? [lowTribute, highTribute] : [highTribute, lowTribute];

    const plan = assignBloodbathStrategies(
      [...comparedTributes, ...neutralTributes],
      createBloodbathRandom(`bloodbath-${variedStat}-${seedIndex}`),
    );

    const strategiesByTributeId = new Map(
      plan.assignments.map(({ tributeId, strategy }) => [tributeId, strategy] as const),
    );

    if (strategiesByTributeId.get(lowTribute.id) === "cornucopia") {
      lowSelections += 1;
    }

    if (strategiesByTributeId.get(highTribute.id) === "cornucopia") {
      highSelections += 1;
    }
  }

  return {
    lowRate: lowSelections / SAMPLE_COUNT,

    highRate: highSelections / SAMPLE_COUNT,
  };
}

describe("Bloodbath Cornucopia quota", () => {
  it.each([12, 24])("keeps %s-tribute participation between 50% and 90%", (tributeCount) => {
    const counts = sampleCornucopiaCounts(tributeCount);

    const minimumCount = Math.ceil(tributeCount * 0.5);

    const maximumCount = Math.floor(tributeCount * 0.9);

    expect(Math.min(...counts)).toBeGreaterThanOrEqual(minimumCount);

    expect(Math.max(...counts)).toBeLessThanOrEqual(maximumCount);
  });

  it("varies participation across different seeds", () => {
    const counts = sampleCornucopiaCounts(FULL_GAME_TRIBUTE_COUNT);

    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it("does not always assign exactly 75% of tributes", () => {
    const counts = sampleCornucopiaCounts(FULL_GAME_TRIBUTE_COUNT);

    const exactTarget = FULL_GAME_TRIBUTE_COUNT * 0.75;

    expect(counts.some((count) => count !== exactTarget)).toBe(true);
  });

  it.each([12, 24])("averages near 75% for %s tributes", (tributeCount) => {
    const counts = sampleCornucopiaCounts(tributeCount);

    const averageProportion =
      counts.reduce((total, count) => total + count / tributeCount, 0) / counts.length;

    expect(averageProportion).toBeGreaterThan(0.72);

    expect(averageProportion).toBeLessThan(0.78);
  });

  it("never assigns every tribute to one strategy", () => {
    const counts = sampleCornucopiaCounts(FULL_GAME_TRIBUTE_COUNT);

    for (const count of counts) {
      expect(count).toBeGreaterThan(0);

      expect(count).toBeLessThan(FULL_GAME_TRIBUTE_COUNT);
    }
  });
});

describe("Bloodbath strategy weighting", () => {
  it("makes high-Brains tributes approach less often", () => {
    const { lowRate, highRate } = sampleApproachRates("brains");

    expect(highRate).toBeLessThan(lowRate);
  });

  it("makes high-Brawn tributes approach more often", () => {
    const { lowRate, highRate } = sampleApproachRates("brawn");

    expect(highRate).toBeGreaterThan(lowRate);
  });

  it("makes high-Luck tributes approach somewhat more often", () => {
    const { lowRate, highRate } = sampleApproachRates("luck");

    expect(highRate).toBeGreaterThan(lowRate);
  });
});

describe("Bloodbath strategy assignments", () => {
  it("gives every tribute exactly one strategy", () => {
    const tributes = createTributes(FULL_GAME_TRIBUTE_COUNT);

    const plan = assignBloodbathStrategies(tributes, createBloodbathRandom("complete-assignment"));

    expect(plan.assignments).toHaveLength(tributes.length);

    const assignedTributeIds = new Set(plan.assignments.map(({ tributeId }) => tributeId));

    expect(assignedTributeIds).toEqual(new Set(tributes.map((tribute) => tribute.id)));

    expect(new Set(plan.assignments.map(({ strategy }) => strategy))).toEqual(
      new Set(["cornucopia", "flee"]),
    );
  });

  it("selects exactly the determined Cornucopia count", () => {
    const tributes = createTributes(FULL_GAME_TRIBUTE_COUNT);

    const plan = assignBloodbathStrategies(
      tributes,
      createBloodbathRandom("exact-cornucopia-count"),
    );

    const assignedCornucopiaCount = plan.assignments.filter(
      ({ strategy }) => strategy === "cornucopia",
    ).length;

    expect(assignedCornucopiaCount).toBe(plan.cornucopiaCount);
  });

  it("produces identical assignments for identical seeds", () => {
    const tributes = createTributes(FULL_GAME_TRIBUTE_COUNT);

    const firstPlan = assignBloodbathStrategies(
      tributes,
      createBloodbathRandom("deterministic-bloodbath"),
    );

    const secondPlan = assignBloodbathStrategies(
      tributes,
      createBloodbathRandom("deterministic-bloodbath"),
    );

    expect(secondPlan).toEqual(firstPlan);
  });
});
