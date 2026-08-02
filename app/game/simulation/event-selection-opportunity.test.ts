import { describe, expect, it } from "vitest";

import {
  createEventSelectionOpportunityId,
  isStateFeasibleCandidate,
} from "./event-selection-opportunity";

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

  it("separates state feasibility from reservation-aware feasibility", () => {
    expect(
      isStateFeasibleCandidate({
        opportunityFeasible: false,
        rejectionReason: "reservation-blocked",
      }),
    ).toBe(true);

    expect(
      isStateFeasibleCandidate({
        opportunityFeasible: false,
        rejectionReason: "participant-or-item-infeasible",
      }),
    ).toBe(false);

    expect(
      isStateFeasibleCandidate({
        opportunityFeasible: true,
        rejectionReason: null,
      }),
    ).toBe(true);
  });
});
