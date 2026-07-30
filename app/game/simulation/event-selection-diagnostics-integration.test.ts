import { describe, expect, it } from "vitest";

import { simulateGame } from "./simulation-runner";

describe("selection diagnostics simulation integration", () => {
  it("captures diagnostics without changing a seeded simulation", () => {
    const options = {
      seed: "selection-diagnostics-behaviour-neutral",
      districtCount: 6 as const,
    };

    const ordinaryRun = simulateGame(options);
    const diagnosticRun = simulateGame({
      ...options,
      captureSelectionDiagnostics: true,
    });

    expect(diagnosticRun.state).toEqual(ordinaryRun.state);
    expect(diagnosticRun.roundsCompleted).toBe(ordinaryRun.roundsCompleted);
    expect(diagnosticRun.selectionDiagnostics).toBeDefined();

    const opportunities =
      diagnosticRun.selectionDiagnostics?.stages.reduce(
        (total, stage) => total + stage.opportunities,
        0,
      ) ?? 0;

    expect(opportunities).toBeGreaterThan(0);
  });
});
