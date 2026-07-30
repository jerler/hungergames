import { describe, expect, it } from "vitest";

import type { EventDefinition } from "~/game/events/event-schema";

import {
  captureEventSelectionDiagnostics,
  recordEventSelectionCandidateEvaluation,
  recordEventSelectionOpportunity,
  summarizeEventSelectionDiagnosticsForPool,
} from "./event-selection-diagnostics";

function createDefinition(id: string, participantCount: number): EventDefinition {
  return {
    id,
    category: "survival",
    periods: ["day"],
    baseWeight: 1,
    tags: ["survival"],
    roles: [
      {
        id: "tributes",
        count: participantCount,
      },
    ],
    resolve: () => ({
      text: "A diagnostics test occurs.",
      changes: [],
    }),
  };
}

describe("event-selection diagnostics", () => {
  it("captures candidate counts without changing the callback result", () => {
    const solo = createDefinition("diagnostic-solo", 1);
    const pair = createDefinition("diagnostic-pair", 2);

    const { result, diagnostics } = captureEventSelectionDiagnostics(() => {
      recordEventSelectionCandidateEvaluation({
        poolId: "bloodbath-cornucopia",
        stage: "cornucopia-fatal",
        definition: solo,
        eligible: true,
        feasible: true,
      });
      recordEventSelectionCandidateEvaluation({
        poolId: "bloodbath-cornucopia",
        stage: "cornucopia-fatal",
        definition: pair,
        eligible: true,
        feasible: true,
      });
      recordEventSelectionOpportunity({
        poolId: "bloodbath-cornucopia",
        stage: "cornucopia-fatal",
        feasibleDefinitions: [solo, pair],
        selectedDefinition: solo,
        plannerConsideredDefinitionIds: new Set([solo.id]),
      });

      return "unchanged";
    });

    expect(result).toBe("unchanged");

    const summary = summarizeEventSelectionDiagnosticsForPool(diagnostics, "bloodbath-cornucopia");

    expect(summary.opportunities).toBe(1);
    expect(summary.selectedSoloWithNonSoloFeasible).toBe(1);
    expect(summary.feasibleByShape).toMatchObject({
      solo: 1,
      pair: 1,
    });

    const pairDiagnostics = summary.definitions.find(
      (definition) => definition.definitionId === pair.id,
    );

    expect(pairDiagnostics).toMatchObject({
      considered: 1,
      eligible: 1,
      feasible: 1,
      selected: 0,
    });
    expect(pairDiagnostics?.rejectionCounts["planner-stage-not-attempted"]).toBe(1);
  });

  it("records hard rejection reasons separately from weighted losses", () => {
    const blocked = createDefinition("diagnostic-blocked", 3);

    const { diagnostics } = captureEventSelectionDiagnostics(() => {
      recordEventSelectionCandidateEvaluation({
        poolId: "later-day",
        stage: "ordinary",
        definition: blocked,
        eligible: true,
        feasible: false,
        rejectionReason: "participant-count-unavailable",
      });
    });

    const summary = summarizeEventSelectionDiagnosticsForPool(diagnostics, "later-day");
    const blockedDiagnostics = summary.definitions[0];

    expect(blockedDiagnostics?.rejectionCounts).toMatchObject({
      "participant-count-unavailable": 1,
      "weighted-not-selected": 0,
    });
  });

  it("resets capture state after a callback throws", () => {
    expect(() =>
      captureEventSelectionDiagnostics(() => {
        throw new Error("expected diagnostics failure");
      }),
    ).toThrow("expected diagnostics failure");

    expect(() => captureEventSelectionDiagnostics(() => "subsequent capture")).not.toThrow();
  });
});
