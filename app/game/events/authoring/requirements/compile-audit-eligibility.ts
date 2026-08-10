import type {
  EventAuditEligibilityMetadata,
  EventAuditPrerequisite,
} from "~/game/events/event-schema";

import { isCandidateRequirement, type CandidateRequirement } from "./evaluate-requirement";
import type { AuthoredRequirement } from "./requirement-schema";

function getRoleCandidateRequirements(
  roleId: string,
  requirements: readonly AuthoredRequirement[],
): CandidateRequirement[] {
  return requirements
    .filter(isCandidateRequirement)
    .filter((requirement) => requirement.roleId === roleId);
}

function compileKnownPrerequisite(
  requirement: CandidateRequirement,
): EventAuditPrerequisite | null {
  switch (requirement.kind) {
    case "minimum-stat":
      return {
        kind: "stat",
        roleId: requirement.roleId,
        stat: requirement.stat,
        comparison: "gte",
        threshold: requirement.value,
        valueSource: "effective",
      };

    case "maximum-stat":
      return {
        kind: "stat",
        roleId: requirement.roleId,
        stat: requirement.stat,
        comparison: "lte",
        threshold: requirement.value,
        valueSource: "effective",
      };

    case "has-status":
      return {
        kind: "status",
        roleId: requirement.roleId,
        statusId: requirement.statusId,
        present: true,
      };

    case "lacks-status":
      return {
        kind: "status",
        roleId: requirement.roleId,
        statusId: requirement.statusId,
        present: false,
      };

    case "in-active-truce":
      return {
        kind: "truce",
        roleId: requirement.roleId,
      };

    case "has-any-harmful-status":
    case "deprivation-status-eligible":
      return null;
  }
}

export function compileAuthoredRoleAuditEligibility({
  roleId,
  requirements,
  hasCustomEligibility,
}: {
  roleId: string;
  requirements: readonly AuthoredRequirement[];
  hasCustomEligibility: boolean;
}): EventAuditEligibilityMetadata | undefined {
  const roleRequirements = getRoleCandidateRequirements(roleId, requirements);

  if (roleRequirements.length === 0) {
    return undefined;
  }

  const prerequisites = roleRequirements
    .map(compileKnownPrerequisite)
    .filter((prerequisite): prerequisite is EventAuditPrerequisite => prerequisite !== null);
  const allRequirementsRepresented = prerequisites.length === roleRequirements.length;

  return {
    coverage: !hasCustomEligibility && allRequirementsRepresented ? "complete" : "opaque",
    prerequisites,
  };
}
