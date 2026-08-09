import type {
  EventAuditEligibilityMetadata,
  EventAuditPrerequisite,
  EventAuditPrerequisiteEvidence,
  EventDefinition,
  ParticipantRoleDefinition,
} from "~/game/events/event-schema";

export interface EventAuditPrerequisiteEvidenceSummary {
  evidence: EventAuditPrerequisiteEvidence;
  prerequisites: readonly EventAuditPrerequisite[];
  opaqueScopes: readonly string[];
}

export function completeAuditEligibility(
  prerequisites: readonly EventAuditPrerequisite[],
): EventAuditEligibilityMetadata {
  return {
    coverage: "complete",
    prerequisites,
  };
}

export function opaqueAuditEligibility(
  prerequisites: readonly EventAuditPrerequisite[] = [],
): EventAuditEligibilityMetadata {
  return {
    coverage: "opaque",
    prerequisites,
  };
}

function createStructuralItemPrerequisites(
  role: ParticipantRoleDefinition,
): EventAuditPrerequisite[] {
  const access = role.itemAccess ?? "accessible";
  const requireUsable = role.requiredItemRequireUsable ?? true;
  const usableByRoleId = role.requiredItemUsableByRoleId ?? role.id;
  const prerequisites: EventAuditPrerequisite[] = [];

  if ((role.requiredItemDefinitionIds?.length ?? 0) > 0) {
    prerequisites.push({
      kind: "item-definition",
      roleId: role.id,
      definitionIds: [...(role.requiredItemDefinitionIds ?? [])],
      access,
      requireUsable,
      usableByRoleId,
    });
  }

  if ((role.requiredItemTags?.length ?? 0) > 0) {
    prerequisites.push({
      kind: "item-tag",
      roleId: role.id,
      tags: [...(role.requiredItemTags ?? [])],
      access,
      requireUsable,
      usableByRoleId,
    });
  }

  return prerequisites;
}

function createPrerequisiteKey(prerequisite: EventAuditPrerequisite): string {
  switch (prerequisite.kind) {
    case "item-definition":
      return JSON.stringify({
        ...prerequisite,
        definitionIds: [...prerequisite.definitionIds].sort(),
      });
    case "item-tag":
      return JSON.stringify({
        ...prerequisite,
        tags: [...prerequisite.tags].sort(),
      });
    default:
      return JSON.stringify(prerequisite);
  }
}

function deduplicatePrerequisites(
  prerequisites: readonly EventAuditPrerequisite[],
): EventAuditPrerequisite[] {
  const seen = new Set<string>();
  const deduplicated: EventAuditPrerequisite[] = [];

  for (const prerequisite of prerequisites) {
    const key = createPrerequisiteKey(prerequisite);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduplicated.push(prerequisite);
  }

  return deduplicated;
}

function addCallbackEvidence({
  scope,
  hasCallback,
  metadata,
  prerequisites,
  opaqueScopes,
}: {
  scope: string;
  hasCallback: boolean;
  metadata: EventAuditEligibilityMetadata | undefined;
  prerequisites: EventAuditPrerequisite[];
  opaqueScopes: string[];
}): void {
  if (metadata) {
    prerequisites.push(...metadata.prerequisites);
  }

  if (!hasCallback) {
    return;
  }

  if (!metadata || metadata.coverage === "opaque") {
    opaqueScopes.push(scope);
  }
}

export function getEventAuditPrerequisiteEvidence(
  definition: EventDefinition,
): EventAuditPrerequisiteEvidenceSummary {
  const prerequisites: EventAuditPrerequisite[] = [];
  const opaqueScopes: string[] = [];

  for (const role of definition.roles) {
    prerequisites.push(...createStructuralItemPrerequisites(role));

    addCallbackEvidence({
      scope: `role:${role.id}`,
      hasCallback: role.isEligible !== undefined,
      metadata: role.auditEligibility,
      prerequisites,
      opaqueScopes,
    });
  }

  addCallbackEvidence({
    scope: "definition",
    hasCallback: definition.isEligible !== undefined,
    metadata: definition.auditEligibility,
    prerequisites,
    opaqueScopes,
  });

  const deduplicatedPrerequisites = deduplicatePrerequisites(prerequisites);

  const evidence: EventAuditPrerequisiteEvidence =
    opaqueScopes.length === 0
      ? "complete"
      : deduplicatedPrerequisites.length > 0
        ? "partially-structural"
        : "opaque";

  return {
    evidence,
    prerequisites: deduplicatedPrerequisites,
    opaqueScopes,
  };
}

export function getEventAuditPrerequisiteKinds(
  definition: EventDefinition,
): EventAuditPrerequisite["kind"][] {
  return [
    ...new Set(
      getEventAuditPrerequisiteEvidence(definition).prerequisites.map(
        (prerequisite) => prerequisite.kind,
      ),
    ),
  ];
}
