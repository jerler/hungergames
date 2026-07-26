import { describe, expect, it } from "vitest";

import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { isLegacyFoodWaterItemId } from "~/game/survival/survival-resource-schema";

import { collectBalanceMetrics } from "./balance-metrics";
import { simulateGame, simulateGameBatch } from "./simulation-runner";

describe("food and water simulation integration", () => {
  it("completes deterministic Half and Full Games without legacy resources or deprivation deaths", () => {
    const runs = simulateGameBatch([
      {
        seedPrefix: "phase-10-half",
        count: 8,
        districtCount: 6,
      },
      {
        seedPrefix: "phase-10-full",
        count: 6,
        districtCount: 12,
      },
    ]);

    for (const run of runs) {
      expect(run.state.victoryOutcome).not.toBeNull();
      expect(run.roundSnapshots.length).toBeGreaterThan(0);

      assertGameStateInvariants(run.state);

      expect(
        run.state.itemTransactions.some((transaction) =>
          isLegacyFoodWaterItemId(transaction.definitionId),
        ),
      ).toBe(false);

      expect(
        run.state.eventHistory.some((event) =>
          event.changes.some(
            (change) =>
              change.type === "eliminate-tribute" &&
              /starv|dehydrat/i.test([change.causeId, change.causeLabel].join(" ")),
          ),
        ),
      ).toBe(false);
    }
  });

  it("preserves exact seeded replay determinism including eligibility snapshots", () => {
    const first = simulateGame({
      seed: "phase-10-determinism",
      districtCount: 12,
    });
    const second = simulateGame({
      seed: "phase-10-determinism",
      districtCount: 12,
    });

    expect(second).toEqual(first);
  });

  it("collects the complete food, water, deprivation, theft, and rest metric surface", () => {
    const metrics = collectBalanceMetrics(
      simulateGameBatch([
        {
          seedPrefix: "phase-10-metrics-half",
          count: 10,
          districtCount: 6,
        },
        {
          seedPrefix: "phase-10-metrics-full",
          count: 8,
          districtCount: 12,
        },
      ]),
    );

    expect(metrics.survival.foodSatisfactionEvents).toBeGreaterThan(0);
    expect(metrics.survival.waterSatisfactionEvents).toBeGreaterThan(0);
    expect(metrics.survival.hungerEligibilityOpportunities).toBeGreaterThanOrEqual(
      metrics.survival.hungryApplications,
    );
    expect(metrics.survival.thirstEligibilityOpportunities).toBeGreaterThanOrEqual(
      metrics.survival.thirstyApplications,
    );
    expect(metrics.survival.legacyFoodWaterAcquisitions).toBe(0);
    expect(metrics.survival.automaticDeprivationFatalities).toBe(0);

    expect(
      metrics.preparation.restQuality.comfortable +
        metrics.preparation.restQuality.sheltered +
        metrics.preparation.restQuality.unsheltered,
    ).toBeGreaterThan(0);
  });
});
