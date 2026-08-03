import { describe, expect, it } from "vitest";

import { EVENT_SELECTION_REJECTION_REASONS } from "./event-selection-diagnostics";
import {
  createEventSelectionFunnelReport,
  createEventSelectionFunnelSummaryTsv,
  createEventSelectionFunnelTsv,
} from "./event-selection-funnel-report";
import { simulateGame } from "./simulation-runner";

function createHistorySignature(run: ReturnType<typeof simulateGame>): string {
  return JSON.stringify({
    roundsCompleted: run.roundsCompleted,
    victoryOutcome: run.state.victoryOutcome,
    events: run.state.eventHistory,
  });
}

describe("event-selection funnel reporting", () => {
  it("publishes deterministic, reconciled route-aware funnel evidence", () => {
    const options = {
      seed: "phase-1-selection-funnel-report",
      districtCount: 6 as const,
      captureSelectionDiagnostics: true,
    };
    const first = simulateGame(options);
    const second = simulateGame(options);
    const firstReport = createEventSelectionFunnelReport([first]);
    const secondReport = createEventSelectionFunnelReport([second]);

    expect(firstReport).toEqual(secondReport);
    expect(firstReport.reconciliation.passed).toBe(true);
    expect(firstReport.reconciliation.acceptedRows).toBe(
      firstReport.reconciliation.eventHistorySelections,
    );
    expect(firstReport.reconciliation.acceptedRows).toBe(
      firstReport.reconciliation.aggregateDiagnosticSelections,
    );
    expect(firstReport.reconciliation.failures).toEqual([]);
    expect(createEventSelectionFunnelTsv([first])).toBe(createEventSelectionFunnelTsv([second]));
    expect(createEventSelectionFunnelSummaryTsv(firstReport)).toBe(
      createEventSelectionFunnelSummaryTsv(secondReport),
    );

    expect(firstReport.routes.every((route) => route.reconciliationPassed)).toBe(true);
    expect(
      firstReport.definitions.some(
        (definition) => definition.poolId === "later-day" && definition.eligibleRounds > 0,
      ),
    ).toBe(true);
    expect(
      firstReport.definitions.some(
        (definition) => definition.poolId === "night" && definition.eligibleRounds > 0,
      ),
    ).toBe(true);
    expect(firstReport.definitions.some((definition) => definition.broadEvent !== null)).toBe(true);

    const rawHeader = createEventSelectionFunnelTsv([first]).split("\n")[0];

    expect(rawHeader).toContain("weighted_pool_entry_count");
    expect(rawHeader).toContain("uniform_expected_selections");
    expect(rawHeader).toContain("draw_attempt_count");
    expect(rawHeader).toContain("rejected_draw_attempts");
  }, 60_000);

  it("does not change production selection behaviour when diagnostics are enabled", () => {
    const baseOptions = {
      seed: "phase-1-selection-behaviour-parity",
      districtCount: 12 as const,
    };
    const withoutDiagnostics = simulateGame(baseOptions);
    const withDiagnostics = simulateGame({
      ...baseOptions,
      captureSelectionDiagnostics: true,
    });

    expect(createHistorySignature(withDiagnostics)).toBe(
      createHistorySignature(withoutDiagnostics),
    );
  }, 60_000);

  it("keeps planner and post-draw rejection categories distinct", () => {
    expect(EVENT_SELECTION_REJECTION_REASONS).toEqual(
      expect.arrayContaining([
        "definition-ineligible",
        "participant-or-item-infeasible",
        "reservation-blocked",
        "planner-stage-not-attempted",
        "exact-cover-excluded",
        "fatality-target-overshoot",
        "repeat-cycle-excluded",
        "weighted-not-selected",
        "post-draw-item-conflict",
        "post-draw-fatality-overshoot",
        "post-draw-resolution-rejected",
      ]),
    );
    expect(EVENT_SELECTION_REJECTION_REASONS).not.toContain("draw-resolution-rejected");
  });
});
