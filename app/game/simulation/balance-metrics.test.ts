import { describe, expect, it } from "vitest";

import { collectBalanceMetrics } from "./balance-metrics";

import { simulateGameBatch } from "./simulation-runner";

describe("balance metrics", () => {
  it("collects complete metrics from deterministic games", () => {
    const runs = simulateGameBatch([
      {
        seedPrefix: "metrics-half",

        count: 2,

        districtCount: 6,
      },

      {
        seedPrefix: "metrics-full",

        count: 1,

        districtCount: 12,
      },
    ]);

    const metrics = collectBalanceMetrics(runs);

    expect(metrics.sample).toEqual({
      totalGames: 3,

      halfGames: 2,

      fullGames: 1,
    });

    expect(metrics.gameSizes["half-game"].completionRate).toBe(1);

    expect(metrics.gameSizes["full-game"].completionRate).toBe(1);

    expect(metrics.eliminations.total).toBeGreaterThan(0);

    expect(metrics.inventory.totalAcquisitions).toBeGreaterThan(0);

    expect(metrics.eventFamilies.length).toBeGreaterThan(0);

    expect(Number.isFinite(metrics.victorStats.average.brains)).toBe(true);
  });

  it("rejects an empty simulation sample", () => {
    expect(() => collectBalanceMetrics([])).toThrow(/empty simulation sample/i);
  });
});
