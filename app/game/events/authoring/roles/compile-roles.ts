import type { ParticipantRoleDefinition } from "~/game/events/event-schema";

import {
  evaluateCandidateRequirement,
  isCandidateRequirement,
  isRelationshipOppositionRequirement,
} from "../requirements/evaluate-requirement";
import {
  getTreatmentItemDefinitionIds,
  isItemRequirement,
} from "../requirements/item-requirements";
import type { AuthoredRequirement, ItemRequirement } from "../requirements/requirement-schema";
import type { AuthoredRoleSpecification } from "./role-schema";

function addUniqueRoleId(roleIds: string[], roleId: string): void {
  if (!roleIds.includes(roleId)) {
    roleIds.push(roleId);
  }
}

function createOppositionMap(
  roles: readonly AuthoredRoleSpecification[],
  requirements: readonly AuthoredRequirement[],
): ReadonlyMap<string, readonly string[]> {
  const oppositionMap = new Map<string, string[]>();

  for (const role of roles) {
    oppositionMap.set(role.id, [...role.opposesRoleIds]);
  }

  for (const requirement of requirements) {
    if (!isRelationshipOppositionRequirement(requirement)) {
      continue;
    }

    const firstOppositions = [...(oppositionMap.get(requirement.firstRoleId) ?? [])];

    const secondOppositions = [...(oppositionMap.get(requirement.secondRoleId) ?? [])];

    addUniqueRoleId(firstOppositions, requirement.secondRoleId);

    addUniqueRoleId(secondOppositions, requirement.firstRoleId);

    oppositionMap.set(requirement.firstRoleId, firstOppositions);

    oppositionMap.set(requirement.secondRoleId, secondOppositions);
  }

  return oppositionMap;
}

function getCandidateRequirementsForRole(
  roleId: string,
  requirements: readonly AuthoredRequirement[],
) {
  return requirements
    .filter(isCandidateRequirement)
    .filter((requirement) => requirement.roleId === roleId);
}

function getItemRequirementForRole(
  roleId: string,
  requirements: readonly AuthoredRequirement[],
): ItemRequirement | undefined {
  return requirements
    .filter(isItemRequirement)
    .find((requirement) => requirement.roleId === roleId);
}

function compileItemRequirement(
  requirement: ItemRequirement | undefined,
): Partial<ParticipantRoleDefinition> {
  if (!requirement) {
    return {};
  }

  switch (requirement.kind) {
    case "has-item":
      return {
        requiredItemDefinitionIds: [...requirement.definitionIds],

        itemAccess: requirement.access,
      };

    case "has-item-tag":
      return {
        requiredItemTags: [...requirement.tags],

        itemAccess: requirement.access,
      };

    case "has-treatment-for":
      return {
        requiredItemDefinitionIds: getTreatmentItemDefinitionIds(requirement.statusId),

        itemAccess: requirement.access,
      };
  }
}

export function compileAuthoredRoles(
  roles: readonly AuthoredRoleSpecification[],
  requirements: readonly AuthoredRequirement[] = [],
): ParticipantRoleDefinition[] {
  const oppositionMap = createOppositionMap(roles, requirements);

  return roles.map((role): ParticipantRoleDefinition => {
    const roleRequirements = getCandidateRequirementsForRole(role.id, requirements);

    const itemRequirement = getItemRequirementForRole(role.id, requirements);

    const opposedRoleIds = oppositionMap.get(role.id) ?? [];

    return {
      id: role.id,
      count: role.count,

      ...(role.getWeight
        ? {
            getWeight: role.getWeight,
          }
        : {}),

      ...(opposedRoleIds.length > 0
        ? {
            opposesRoleIds: [...opposedRoleIds],
          }
        : {}),

      ...(role.optionalItemDefinitionIds
        ? {
            optionalItemDefinitionIds: [...role.optionalItemDefinitionIds],
          }
        : {}),

      ...(role.optionalItemTags
        ? {
            optionalItemTags: [...role.optionalItemTags],
          }
        : {}),

      ...(role.optionalItemAccess
        ? {
            optionalItemAccess: role.optionalItemAccess,
          }
        : {}),

      ...compileItemRequirement(itemRequirement),

      ...(roleRequirements.length > 0
        ? {
            isEligible: (tribute, context) =>
              roleRequirements.every((requirement) =>
                evaluateCandidateRequirement(requirement, tribute, context),
              ),
          }
        : {}),
    };
  });
}
