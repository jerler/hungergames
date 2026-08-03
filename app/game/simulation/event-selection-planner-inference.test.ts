import { describe, expect, it } from "vitest";

import type { EventDefinition } from "~/game/events/event-schema";

import {
  captureEventSelectionDiagnostics,
  recordEventSelectionCandidateEvaluation,
  recordEventSelectionOpportunity,
  summarizeEventSelectionDiagnosticsForPool,
} from "./event-selection-diagnostics";

function createDefinition(id: string): EventDefinition {
  return {
    id,
    category: "survival",
    periods: ["day"],
    baseWeight: 1,
    tags: ["survival"],
    roles: [
      {
        id: "tribute",
        count: 1,
      },
    ],
    resolve: () => ({
      text: "A planner-inference test occurs.",
      changes: [],
    }),
  };
}

describe("event-selection weighted-pool inference", () => {
  it("treats weighted-pool membership as proof of every preceding stage", () => {
    const definition = createDefinition("weighted-pool-preceding-stages");

    const { diagnostics } = captureEventSelectionDiagnostics(
      () => {
        recordEventSelectionCandidateEvaluation({
          poolId: "bloodbath-cornucopia",
          stage: "cornucopia-fatal",
          definition,
          eligible: true,
          hardFeasible: true,
          opportunityFeasible: false,
          rejectionReason: "reservation-blocked",
        });

        recordEventSelectionOpportunity({
          poolId: "bloodbath-cornucopia",
          stage: "cornucopia-fatal",
          feasibleDefinitions: [],
          hardFeasibleDefinitions: [definition],
          opportunityFeasibleDefinitions: [],
          selectedDefinition: null,
          plannerConsideredDefinitionIds: new Set<string>(),
          weightedPoolDefinitionIdsByDraw: [new Set([definition.id])],
          drawnDefinitionIds: [],
        });
      },
      {
        gameSeed: "weighted-pool-inference",
      },
    );

    expect(diagnostics.opportunities).toHaveLength(1);
    expect(diagnostics.opportunities?.[0]).toMatchObject({
      definitionId: definition.id,
      eligible: true,
      hardFeasible: true,
      opportunityFeasible: true,
      plannerAdmitted: true,
      finalWeightedPool: true,
      weightedPoolEntryCount: 1,
      drawAttemptCount: 0,
      drawn: false,
      resolvedAccepted: false,
      rejectionReason: "weighted-not-selected",
    });

    const summary = summarizeEventSelectionDiagnosticsForPool(diagnostics, "bloodbath-cornucopia");
    const aggregate = summary.definitions.find(
      (candidate) => candidate.definitionId === definition.id,
    );

    expect(aggregate?.rejectionCounts).toMatchObject({
      "reservation-blocked": 0,
      "weighted-not-selected": 1,
    });
  });

  it("clears a stale rejection when the weighted draw is accepted", () => {
    const definition = createDefinition("weighted-pool-accepted");

    const { diagnostics } = captureEventSelectionDiagnostics(
      () => {
        recordEventSelectionCandidateEvaluation({
          poolId: "bloodbath-cornucopia",
          stage: "cornucopia-fatal",
          definition,
          eligible: true,
          hardFeasible: false,
          opportunityFeasible: false,
          rejectionReason: "participant-or-item-infeasible",
        });

        recordEventSelectionOpportunity({
          poolId: "bloodbath-cornucopia",
          stage: "cornucopia-fatal",
          feasibleDefinitions: [],
          selectedDefinition: definition,
          plannerConsideredDefinitionIds: new Set<string>(),
          weightedPoolDefinitionIdsByDraw: [new Set([definition.id])],
          drawnDefinitionIds: [definition.id],
        });
      },
      {
        gameSeed: "weighted-pool-accepted",
      },
    );

    expect(diagnostics.opportunities?.[0]).toMatchObject({
      hardFeasible: true,
      opportunityFeasible: true,
      plannerAdmitted: true,
      finalWeightedPool: true,
      drawAttemptCount: 1,
      drawn: true,
      resolvedAccepted: true,
      rejectionReason: null,
    });

    const summary = summarizeEventSelectionDiagnosticsForPool(diagnostics, "bloodbath-cornucopia");
    const aggregate = summary.definitions.find(
      (candidate) => candidate.definitionId === definition.id,
    );

    expect(aggregate?.selected).toBe(1);
    expect(
      Object.values(aggregate?.rejectionCounts ?? {}).reduce((total, count) => total + count, 0),
    ).toBe(0);
  });
});
