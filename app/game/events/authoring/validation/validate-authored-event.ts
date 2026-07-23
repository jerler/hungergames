import type {
  AuthoredEventConfiguration,
  EventResolutionStrategy,
} from "~/game/events/authoring/builder/event-builder-types";
import {
  getTreatmentItemDefinitionIds,
  isItemRequirement,
} from "~/game/events/authoring/requirements/item-requirements";
import {
  getRequirementRoleIds,
  type AuthoredRequirement,
  type ItemRequirement,
} from "~/game/events/authoring/requirements/requirement-schema";
import type { AuthoredRoleSpecification } from "~/game/events/authoring/roles/role-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemTag } from "~/game/items/item-schema";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";

const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ITEM_TAGS = new Set<ItemTag>([
  "consumable",
  "water",
  "food",
  "medicine",
  "shelter",
  "fire",
  "tool",
  "weapon",
  "defense",
  "navigation",
  "trap",
  "camouflage",
  "hunting",
  "fishing",
]);

function validateOptionalItemSelection(eventId: string, role: AuthoredRoleSpecification): void {
  const definitionIds = role.optionalItemDefinitionIds ?? [];
  const tags = role.optionalItemTags ?? [];

  const declaresOptionalItem =
    role.optionalItemAccess !== undefined || definitionIds.length > 0 || tags.length > 0;

  if (!declaresOptionalItem) {
    return;
  }

  if (definitionIds.length === 0 && tags.length === 0) {
    throw new Error(
      `Event "${eventId}" role "${role.id}" declares optional item selection without item definitions or tags.`,
    );
  }

  if (role.optionalItemAccess !== "accessible" && role.optionalItemAccess !== "owned") {
    throw new Error(
      `Event "${eventId}" role "${role.id}" has invalid optional item access "${String(
        role.optionalItemAccess,
      )}".`,
    );
  }

  if (new Set(definitionIds).size !== definitionIds.length) {
    throw new Error(
      `Event "${eventId}" role "${role.id}" declares duplicate optional item definitions.`,
    );
  }

  for (const itemId of definitionIds) {
    try {
      getItemDefinition(itemId);
    } catch {
      throw new Error(
        `Event "${eventId}" role "${role.id}" references unknown optional item "${itemId}".`,
      );
    }
  }

  if (new Set(tags).size !== tags.length) {
    throw new Error(`Event "${eventId}" role "${role.id}" declares duplicate optional item tags.`);
  }

  for (const tag of tags) {
    if (!ITEM_TAGS.has(tag)) {
      throw new Error(
        `Event "${eventId}" role "${role.id}" references unknown optional item tag "${tag}".`,
      );
    }
  }
}

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

  validateOptionalItemSelection(eventId, role);
}

function validateItemRequirement(eventId: string, requirement: ItemRequirement): void {
  if (requirement.access !== "accessible" && requirement.access !== "owned") {
    throw new Error(
      `Event "${eventId}": requirement "${requirement.kind}" has invalid item access "${String(
        requirement.access,
      )}".`,
    );
  }

  switch (requirement.kind) {
    case "has-item": {
      if (requirement.definitionIds.length === 0) {
        throw new Error(
          `Event "${eventId}": requirement "has-item" must declare at least one item definition.`,
        );
      }

      if (new Set(requirement.definitionIds).size !== requirement.definitionIds.length) {
        throw new Error(
          `Event "${eventId}": requirement "has-item" declares duplicate item definitions.`,
        );
      }

      for (const itemId of requirement.definitionIds) {
        try {
          getItemDefinition(itemId);
        } catch {
          throw new Error(
            `Event "${eventId}": requirement "has-item" references unknown item "${itemId}".`,
          );
        }
      }

      return;
    }

    case "has-item-tag": {
      if (requirement.tags.length === 0) {
        throw new Error(
          `Event "${eventId}": requirement "has-item-tag" must declare at least one item tag.`,
        );
      }

      if (new Set(requirement.tags).size !== requirement.tags.length) {
        throw new Error(
          `Event "${eventId}": requirement "has-item-tag" declares duplicate item tags.`,
        );
      }

      for (const tag of requirement.tags) {
        if (!ITEM_TAGS.has(tag)) {
          throw new Error(
            `Event "${eventId}": requirement "has-item-tag" references unknown item tag "${tag}".`,
          );
        }
      }

      return;
    }

    case "has-treatment-for": {
      try {
        getStatusDefinition(requirement.statusId);
      } catch {
        throw new Error(
          `Event "${eventId}": requirement "has-treatment-for" references unknown status "${requirement.statusId}".`,
        );
      }

      if (getTreatmentItemDefinitionIds(requirement.statusId).length === 0) {
        throw new Error(`Event "${eventId}": no item can treat status "${requirement.statusId}".`);
      }
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

  if (isItemRequirement(requirement)) {
    validateItemRequirement(eventId, requirement);
  }
}

function validateRequiredItemCounts(
  eventId: string,
  requirements: readonly AuthoredRequirement[],
): void {
  const itemRequirementsByRole = new Map<string, number>();

  for (const requirement of requirements) {
    if (!isItemRequirement(requirement)) {
      continue;
    }

    const count = itemRequirementsByRole.get(requirement.roleId) ?? 0;

    itemRequirementsByRole.set(requirement.roleId, count + 1);
  }

  for (const [roleId, count] of itemRequirementsByRole) {
    if (count > 1) {
      throw new Error(
        `Event "${eventId}": role "${roleId}" declares more than one required-item requirement.`,
      );
    }
  }
}

function validateItemSelectionKinds(
  eventId: string,
  roles: readonly AuthoredRoleSpecification[],
  requirements: readonly AuthoredRequirement[],
): void {
  const requiredItemRoleIds = new Set(
    requirements.filter(isItemRequirement).map((requirement) => requirement.roleId),
  );

  for (const role of roles) {
    const hasOptionalItem =
      role.optionalItemAccess !== undefined ||
      (role.optionalItemDefinitionIds?.length ?? 0) > 0 ||
      (role.optionalItemTags?.length ?? 0) > 0;

    if (hasOptionalItem && requiredItemRoleIds.has(role.id)) {
      throw new Error(
        `Event "${eventId}" role "${role.id}" cannot declare both required and optional item selection.`,
      );
    }
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

  validateRequiredItemCounts(id, requirements);
  validateItemSelectionKinds(id, roles, requirements);

  const requiredItemRoleIds = [
    ...new Set(requirements.filter(isItemRequirement).map((requirement) => requirement.roleId)),
  ];

  strategy.validate(id, roleIds, requiredItemRoleIds);
}
