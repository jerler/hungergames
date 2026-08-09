import { describe, expect, it } from "vitest";

import { completeAuditEligibility } from "~/game/events/event-audit-prerequisites";
import type { EventDefinition } from "~/game/events/event-schema";

import {
  getEventAuditSpecificityBreakdown,
  getEventSpecificityBreakdown,
} from "./event-specificity";

function createDefinition(id: string, overrides: Partial<EventDefinition> = {}): EventDefinition {
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
    expect(getEventAuditSpecificityBreakdown(createDefinition("audit-broad"))).toMatchObject({
      score: 0,
      authoredScore: 0,
      structuralScore: 0,
      reasons: [],
      broadEvent: true,
      prerequisiteEvidence: "complete",
      prerequisiteKinds: [],
    });
  });

  it("does not label an opaque callback as broad merely because typed prerequisites are unavailable", () => {
    const definition = createDefinition("audit-opaque-not-broad", {
      roles: [
        {
          id: "tribute",
          count: 1,
          isEligible: () => true,
        },
      ],
    });

    expect(getEventAuditSpecificityBreakdown(definition)).toMatchObject({
      score: 0.5,
      broadEvent: false,
      prerequisiteEvidence: "opaque",
      prerequisiteKinds: [],
    });
  });

  it("uses exact typed prerequisites for broad classification without changing production weighting", () => {
    const definition = createDefinition("audit-typed-not-broad", {
      roles: [
        {
          id: "tribute",
          count: 1,
          isEligible: () => true,
          auditEligibility: completeAuditEligibility([
            {
              kind: "stat",
              roleId: "tribute",
              stat: "brains",
              comparison: "gte",
              threshold: 4,
            },
          ]),
        },
      ],
    });

    const audit = getEventAuditSpecificityBreakdown(definition);
    const production = getEventSpecificityBreakdown(definition);

    expect(audit).toMatchObject({
      broadEvent: false,
      prerequisiteEvidence: "complete",
      prerequisiteKinds: ["stat"],
    });
    expect(production).toMatchObject({
      score: 0.5,
      multiplier: 1.25,
      source: "structural",
      reasons: ["custom-eligibility"],
    });
  });

  it("unions authored and structurally inferred specificity", () => {
    const definition = createDefinition("audit-authored-and-structural", {
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
    });

    const breakdown = getEventAuditSpecificityBreakdown(definition);

    expect(breakdown).toMatchObject({
      score: 2,
      authoredScore: 2,
      structuralScore: 0.5,
      broadEvent: false,
    });
    expect(breakdown.reasons).toEqual(["stat-requirement", "custom-eligibility"]);
  });
});
