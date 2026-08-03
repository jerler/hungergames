import { describe, expect, it } from "vitest";

import { simulateGame } from "./simulation-runner";

describe("Bloodbath selection funnel integration", () => {
  it("captures route-aware Bloodbath funnel stages deterministically", () => {
    const options = {
      seed: "bloodbath-funnel-determinism",
      districtCount: 6 as const,
      captureSelectionDiagnostics: true,
    };
    const first = simulateGame(options);
    const second = simulateGame(options);
    const firstRows =
      first.selectionDiagnostics?.opportunities?.filter(
        (row) =>
          row.poolId === "bloodbath-cornucopia" ||
          row.poolId === "bloodbath-flee",
      ) ?? [];
    const secondRows =
      second.selectionDiagnostics?.opportunities?.filter(
        (row) =>
          row.poolId === "bloodbath-cornucopia" ||
          row.poolId === "bloodbath-flee",
      ) ?? [];

    expect(firstRows.length).toBeGreaterThan(0);
    expect(secondRows).toEqual(firstRows);
    expect(new Set(firstRows.map((row) => row.poolId))).toEqual(
      new Set(["bloodbath-cornucopia", "bloodbath-flee"]),
    );

    for (const row of firstRows) {
      if (row.opportunityFeasible) {
        expect(row.hardFeasible).toBe(true);
      }

      if (row.plannerAdmitted) {
        expect(row.opportunityFeasible).toBe(true);
      }

      if (row.finalWeightedPool) {
        expect(row.plannerAdmitted).toBe(true);
        expect(row.weightedPoolEntryCount).toBeGreaterThan(0);
        expect(row.uniformExpectedSelections).toBeGreaterThan(0);
      }

      if (row.drawn) {
        expect(row.finalWeightedPool).toBe(true);
        expect(row.drawAttemptCount).toBeGreaterThan(0);
      }

      if (row.resolvedAccepted) {
        expect(row.drawn).toBe(true);
        expect(row.rejectionReason).toBeNull();
      }
    }
  });
});
