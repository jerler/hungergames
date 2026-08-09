import { describe, expect, it } from "vitest";

import {
  completeAuditEligibility,
  getEventAuditPrerequisiteEvidence,
  opaqueAuditEligibility,
} from "~/game/events/event-audit-prerequisites";
import type { EventDefinition } from "~/game/events/event-schema";
import { validateEventDefinition } from "~/game/events/validation/validate-event-definition";

function createDefinition(id: string, overrides: Partial<EventDefinition> = {}): EventDefinition {
  return {
    id,
    category: "survival",
    periods: ["day"],
    baseWeight: 1,
    tags: ["survival"],
    roles: [{ id: "actor", count: 1 }],
    resolve: () => ({
      text: "An audit-prerequisite test occurs.",
      changes: [],
    }),
    ...overrides,
  };
}

describe("typed audit prerequisite evidence", () => {
  it("preserves declarative required-item metadata without duplicating authoring", () => {
    const definition = createDefinition("audit-structural-item", {
      roles: [
        {
          id: "actor",
          count: 1,
          requiredItemDefinitionIds: ["knife"],
          requiredItemTags: ["weapon"],
          itemAccess: "owned",
          requiredItemRequireUsable: false,
        },
      ],
    });

    expect(getEventAuditPrerequisiteEvidence(definition)).toEqual({
      evidence: "complete",
      opaqueScopes: [],
      prerequisites: [
        {
          kind: "item-definition",
          roleId: "actor",
          definitionIds: ["knife"],
          access: "owned",
          requireUsable: false,
          usableByRoleId: "actor",
        },
        {
          kind: "item-tag",
          roleId: "actor",
          tags: ["weapon"],
          access: "owned",
          requireUsable: false,
          usableByRoleId: "actor",
        },
      ],
    });
  });

  it("reports callback-only eligibility honestly as opaque", () => {
    const definition = createDefinition("audit-opaque-callback", {
      roles: [
        {
          id: "actor",
          count: 1,
          isEligible: () => true,
        },
      ],
    });

    expect(getEventAuditPrerequisiteEvidence(definition)).toEqual({
      evidence: "opaque",
      prerequisites: [],
      opaqueScopes: ["role:actor"],
    });
  });

  it("reports structural evidence plus an opaque callback as partially structural", () => {
    const definition = createDefinition("audit-partially-structural", {
      roles: [
        {
          id: "actor",
          count: 1,
          isEligible: () => true,
          requiredItemDefinitionIds: ["knife"],
        },
      ],
    });

    expect(getEventAuditPrerequisiteEvidence(definition)).toMatchObject({
      evidence: "partially-structural",
      opaqueScopes: ["role:actor"],
      prerequisites: [
        {
          kind: "item-definition",
          roleId: "actor",
          definitionIds: ["knife"],
          access: "accessible",
          requireUsable: true,
          usableByRoleId: "actor",
        },
      ],
    });
  });

  it("preserves exact typed callback prerequisites when authoring marks coverage complete", () => {
    const definition = createDefinition("audit-complete-callback", {
      roles: [
        {
          id: "actor",
          count: 1,
          isEligible: () => true,
          auditEligibility: completeAuditEligibility([
            {
              kind: "stat",
              roleId: "actor",
              stat: "brains",
              comparison: "gte",
              threshold: 4,
            },
            {
              kind: "status",
              roleId: "actor",
              statusId: "poisoned",
              present: true,
            },
            {
              kind: "deprivation",
              roleId: "actor",
              need: "food",
              deprived: true,
            },
            {
              kind: "truce",
              roleId: "actor",
              truceKind: "standard",
              exactSize: 4,
            },
            {
              kind: "relationship",
              roleId: "actor",
              relationship: "truce",
              relationshipKind: "standard",
            },
          ]),
        },
      ],
    });

    validateEventDefinition(definition);

    const evidence = getEventAuditPrerequisiteEvidence(definition);

    expect(evidence.evidence).toBe("complete");
    expect(evidence.opaqueScopes).toEqual([]);
    expect(evidence.prerequisites).toEqual(definition.roles[0]?.auditEligibility?.prerequisites);
  });

  it("allows known prerequisites while keeping the remaining callback explicitly opaque", () => {
    const definition = createDefinition("audit-known-but-opaque", {
      isEligible: () => true,
      auditEligibility: opaqueAuditEligibility([
        {
          kind: "stat",
          roleId: "actor",
          stat: "luck",
          comparison: "lte",
          threshold: 2,
        },
      ]),
    });

    validateEventDefinition(definition);

    expect(getEventAuditPrerequisiteEvidence(definition)).toEqual({
      evidence: "partially-structural",
      prerequisites: [
        {
          kind: "stat",
          roleId: "actor",
          stat: "luck",
          comparison: "lte",
          threshold: 2,
        },
      ],
      opaqueScopes: ["definition"],
    });
  });

  it("rejects typed item metadata that contradicts declarative required-item fields", () => {
    const definition = createDefinition("audit-contradictory-item", {
      roles: [
        {
          id: "actor",
          count: 1,
          requiredItemDefinitionIds: ["knife"],
          isEligible: () => true,
          auditEligibility: completeAuditEligibility([
            {
              kind: "item-definition",
              roleId: "actor",
              definitionIds: ["spear"],
              access: "accessible",
              requireUsable: true,
              usableByRoleId: "actor",
            },
          ]),
        },
      ],
    });

    expect(() => validateEventDefinition(definition)).toThrow(
      /contradicts its declarative required-item contract/i,
    );
  });

  it("rejects role-scoped metadata that claims a different participant role", () => {
    const definition = createDefinition("audit-role-mismatch", {
      roles: [
        {
          id: "actor",
          count: 1,
          isEligible: () => true,
          auditEligibility: completeAuditEligibility([
            {
              kind: "stat",
              roleId: "target",
              stat: "brawn",
              comparison: "gte",
              threshold: 4,
            },
          ]),
        },
        {
          id: "target",
          count: 1,
        },
      ],
    });

    expect(() => validateEventDefinition(definition)).toThrow(/must reference its own role/i);
  });
});
