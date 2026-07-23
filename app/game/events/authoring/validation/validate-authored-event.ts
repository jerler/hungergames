import type {
  AuthoredEventConfiguration,
  EventResolutionStrategy,
} from "~/game/events/authoring/builder/event-builder-types";
import {
  getRequirementRoleIds,
  type AuthoredRequirement,
} from "~/game/events/authoring/requirements/requirement-schema";
import type { AuthoredRoleSpecification } from "~/game/events/authoring/roles/role-schema";

const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateRole(
  eventId: string,
  role: AuthoredRoleSpecification,
  knownRoleIds: ReadonlySet<string>,
): void {
  if (!role.id.trim()) {
    throw new Error(`Event "${eventId}" contains an empty participant role ID.`);
  }

  if (!Number.isInteger(role.count) || role.count <= 0) {
    throw new Error(`Event "${eventId}" role "${role.id}" must have a positive integer count.`);
  }

  for (const opposedRoleId of role.opposesRoleIds) {
    if (opposedRoleId === role.id) {
      throw new Error(`Event "${eventId}" role "${role.id}" cannot oppose itself.`);
    }

    if (!knownRoleIds.has(opposedRoleId)) {
      throw new Error(
        `Event "${eventId}" role "${role.id}" opposes unknown role "${opposedRoleId}".`,
      );
    }
  }
}

function validateRequirement(
  eventId: string,
  requirement: AuthoredRequirement,
  knownRoleIds: ReadonlySet<string>,
): void {
  for (const roleId of getRequirementRoleIds(requirement)) {
    if (!knownRoleIds.has(roleId)) {
      throw new Error(
        `Event "${eventId}": requirement "${requirement.kind}" references unknown role "${roleId}".`,
      );
    }
  }

  if (
    requirement.kind === "not-in-same-truce" &&
    requirement.firstRoleId === requirement.secondRoleId
  ) {
    throw new Error(
      `Event "${eventId}": requirement "not-in-same-truce" must reference two different roles.`,
    );
  }
}

export function validateAuthoredEvent(
  configuration: AuthoredEventConfiguration,
  strategy: EventResolutionStrategy,
): void {
  const { id, baseWeight, periods, roles, requirements } = configuration;

  if (!EVENT_ID_PATTERN.test(id)) {
    throw new Error(`Event ID "${id}" must be non-empty kebab-case text.`);
  }

  if (!Number.isFinite(baseWeight) || baseWeight <= 0) {
    throw new Error(`Event "${id}" must have a positive finite weight.`);
  }

  if (periods.length === 0) {
    throw new Error(`Event "${id}" must declare at least one period.`);
  }

  if (new Set(periods).size !== periods.length) {
    throw new Error(`Event "${id}" declares the same period more than once.`);
  }

  if (roles.length === 0) {
    throw new Error(`Event "${id}" must declare at least one participant role.`);
  }

  const roleIds = roles.map((role) => role.id);

  if (new Set(roleIds).size !== roleIds.length) {
    throw new Error(`Event "${id}" declares duplicate participant role IDs.`);
  }

  const knownRoleIds = new Set(roleIds);

  for (const role of roles) {
    validateRole(id, role, knownRoleIds);
  }

  for (const requirement of requirements) {
    validateRequirement(id, requirement, knownRoleIds);
  }

  strategy.validate(id, roleIds);
}
