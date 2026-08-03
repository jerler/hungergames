import { describe, expect, it } from "vitest";

import type { EventDefinition } from "~/game/events/event-schema";

import {
  captureEventSelectionDiagnostics,
  recordEventSelectionCandidateEvaluation,
  recordEventSelectionOpportunity,
} from "./event-selection-diagnostics";
import { createEventSelectionOpportunityId } from "./event-selection-opportunity";

function createDefinition(id: string): EventDefinition {
  return {
    id,
    category: "survival",
    periods: ["day"],
    baseWeight: 1,
    tags: ["survival"],
    roles: [{ id: "tribute", count: 1 }],
    resolve: () => ({
      text: "An opportunity test occurs.",
      changes: [],
    }),
  };
}

describe("event-selection opportunity records", () => {
  it("creates stable route-aware opportunity identities", () => {
    expect(
      createEventSelectionOpportunityId({
        gameSeed: "catalogue-audit-v3-full-game-0",
        roundSequence: 3,
        poolId: "later-day",
        stage: "ordinary",
        opportunityIndex: 2,
      }),
    ).toBe("catalogue-audit-v3-full-game-0:round-3:later-day:ordinary:opportunity-2");
  });

  it("separates the complete selection funnel", () => {
    const accepted = createDefinition("accepted");
    const reservationBlocked = createDefinition("reservation-blocked");
    const exactCoverExcluded = createDefinition("exact-cover-excluded");
    const rejectedAfterDraw = createDefinition("rejected-after-draw");

    const { diagnostics } = captureEventSelectionDiagnostics(
      () => {
        for (const definition of [accepted, exactCoverExcluded, rejectedAfterDraw]) {
          recordEventSelectionCandidateEvaluation({
            poolId: "later-day",
            stage: "ordinary",
            definition,
            eligible: true,
            hardFeasible: true,
            opportunityFeasible: true,
          });
        }

        recordEventSelectionCandidateEvaluation({
          poolId: "later-day",
          stage: "ordinary",
          definition: reservationBlocked,
          eligible: true,
          hardFeasible: true,
          opportunityFeasible: false,
          rejectionReason: "reservation-blocked",
        });

        recordEventSelectionOpportunity({
          poolId: "later-day",
          stage: "ordinary",
          feasibleDefinitions: [accepted, exactCoverExcluded, rejectedAfterDraw],
          hardFeasibleDefinitions: [
            accepted,
            reservationBlocked,
            exactCoverExcluded,
            rejectedAfterDraw,
          ],
          opportunityFeasibleDefinitions: [accepted, exactCoverExcluded, rejectedAfterDraw],
          selectedDefinition: accepted,
          plannerConsideredDefinitionIds: new Set([accepted.id, rejectedAfterDraw.id]),
          weightedPoolDefinitionIdsByDraw: [
            new Set([accepted.id, rejectedAfterDraw.id]),
            new Set([accepted.id]),
          ],
          drawnDefinitionIds: [rejectedAfterDraw.id, accepted.id],
          rejectionReasonsByDefinitionId: new Map([
            [exactCoverExcluded.id, "exact-cover-excluded"],
            [rejectedAfterDraw.id, "post-draw-resolution-rejected"],
          ]),
        });
      },
      { gameSeed: "opportunity-funnel" },
    );

    const byId = new Map(diagnostics.opportunities?.map((row) => [row.definitionId, row]));

    expect(byId.get(reservationBlocked.id)).toMatchObject({
      hardFeasible: true,
      opportunityFeasible: false,
      plannerAdmitted: false,
      finalWeightedPool: false,
      rejectionReason: "reservation-blocked",
    });
    expect(byId.get(exactCoverExcluded.id)).toMatchObject({
      hardFeasible: true,
      opportunityFeasible: true,
      plannerAdmitted: false,
      finalWeightedPool: false,
      rejectionReason: "exact-cover-excluded",
    });
    expect(byId.get(rejectedAfterDraw.id)).toMatchObject({
      plannerAdmitted: true,
      finalWeightedPool: true,
      weightedPoolEntryCount: 1,
      uniformExpectedSelections: 0.5,
      drawAttemptCount: 1,
      drawn: true,
      resolvedAccepted: false,
      rejectionReason: "post-draw-resolution-rejected",
    });
    expect(byId.get(accepted.id)).toMatchObject({
      plannerAdmitted: true,
      finalWeightedPool: true,
      weightedPoolEntryCount: 2,
      uniformExpectedSelections: 1.5,
      drawAttemptCount: 1,
      drawn: true,
      resolvedAccepted: true,
      rejectionReason: null,
    });
  });
});
