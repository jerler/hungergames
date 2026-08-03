import { describe, expect, it } from "vitest";

import type { EventDefinition } from "~/game/events/event-schema";

import { getEventAuditSpecificityBreakdown } from "./event-specificity";

function createDefinition(
  id: string,
  overrides: Partial<EventDefinition> = {},
): EventDefinition {
  return {
    id,
    category: "survival",
    periods: ["day"],
    baseWeight: 1,
    tags: ["survival"],
    roles: [{ id: "tribute", count: 1 }],
    resolve: () => ({
      text: "An audit-specificity test occurs.",
      changes: [],
    }),
    ...overrides,
  };
}

describe("audit-only event specificity", () => {
  it("classifies only zero-specificity definitions as broad", () => {
    expect(
      getEventAuditSpecificityBreakdown(
        createDefinition("audit-broad"),
      ),
    ).toMatchObject({
      score: 0,
      authoredScore: 0,
      structuralScore: 0,
      reasons: [],
      broadEvent: true,
    });
  });

  it("unions authored and structurally inferred specificity", () => {
    const definition = createDefinition(
      "audit-authored-and-structural",
      {
        selectionProfile: {
          specificityScore: 2,
          specificityReasons: ["stat-requirement"],
        },
        roles: [
          {
            id: "tribute",
            count: 1,
            isEligible: () => true,
          },
        ],
      },
    );

    const breakdown =
      getEventAuditSpecificityBreakdown(definition);

    expect(breakdown).toMatchObject({
      score: 2,
      authoredScore: 2,
      structuralScore: 0.5,
      broadEvent: false,
    });
    expect(breakdown.reasons).toEqual([
      "stat-requirement",
      "custom-eligibility",
    ]);
  });
});
