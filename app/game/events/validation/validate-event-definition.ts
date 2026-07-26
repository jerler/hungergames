import type { EventDefinition, ParticipantRoleDefinition } from "~/game/events/event-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { ITEM_TAGS, type ItemDefinitionId, type ItemTag } from "~/game/items/item-schema";

const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const EVENT_CATEGORIES = new Set(["fatal", "survival", "hazard"]);

const EVENT_PERIODS = new Set(["day", "night"]);

const EVENT_TAGS = new Set([
  "fatal",
  "survival",
  "hazard",
  "combat",
  "ambush",
  "environment",
  "weapon",
  "tool",
  "item",
  "status",
  "deprivation",
  "resource",
  "truce",
  "cooperative",
  "romantic",
  "victory",
]);

const ITEM_TAG_SET = new Set<ItemTag>(ITEM_TAGS);

function validateUniqueValues(eventId: string, label: string, values: readonly string[]): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Event "${eventId}" declares duplicate ${label}.`);
  }
}

function validateItemDefinitionIds(
  eventId: string,
  roleId: string,
  label: string,
  itemIds: readonly ItemDefinitionId[],
): void {
  validateUniqueValues(eventId, `${label} item definitions for role "${roleId}"`, itemIds);

  for (const itemId of itemIds) {
    try {
      getItemDefinition(itemId);
    } catch {
      throw new Error(
        `Event "${eventId}" role "${roleId}" references unknown ${label} item "${itemId}".`,
      );
    }
  }
}

function validateItemTags(
  eventId: string,
  roleId: string,
  label: string,
  tags: readonly ItemTag[],
): void {
  validateUniqueValues(eventId, `${label} item tags for role "${roleId}"`, tags);

  for (const tag of tags) {
    if (!ITEM_TAG_SET.has(tag)) {
      throw new Error(
        `Event "${eventId}" role "${roleId}" references unknown ${label} item tag "${tag}".`,
      );
    }
  }
}

function validateRole(
  eventId: string,
  role: ParticipantRoleDefinition,
  knownRoleIds: ReadonlySet<string>,
  earlierRoleIds: ReadonlySet<string>,
): void {
  if (!role.id.trim()) {
    throw new Error(`Event "${eventId}" contains an empty participant role ID.`);
  }

  if (!Number.isInteger(role.count) || role.count <= 0) {
    throw new Error(`Event "${eventId}" role "${role.id}" must have a positive integer count.`);
  }

  if (
    role.targeting !== undefined &&
    role.targeting !== "neutral" &&
    role.targeting !== "hostile"
  ) {
    throw new Error(`Event "${eventId}" role "${role.id}" ` + "has invalid targeting metadata.");
  }

  if (role.isEligible !== undefined && typeof role.isEligible !== "function") {
    throw new Error(`Event "${eventId}" role "${role.id}" has an invalid eligibility callback.`);
  }

  if (role.getWeight !== undefined && typeof role.getWeight !== "function") {
    throw new Error(`Event "${eventId}" role "${role.id}" has an invalid weighting callback.`);
  }

  const opposedRoleIds = role.opposesRoleIds ?? [];

  validateUniqueValues(eventId, `opposed roles for role "${role.id}"`, opposedRoleIds);

  for (const opposedRoleId of opposedRoleIds) {
    if (opposedRoleId === role.id) {
      throw new Error(`Event "${eventId}" role "${role.id}" cannot oppose itself.`);
    }

    if (!knownRoleIds.has(opposedRoleId)) {
      throw new Error(
        `Event "${eventId}" role "${role.id}" opposes unknown role "${opposedRoleId}".`,
      );
    }
  }

  const requiredItemDefinitionIds = role.requiredItemDefinitionIds ?? [];

  const requiredItemTags = role.requiredItemTags ?? [];

  const optionalItemDefinitionIds = role.optionalItemDefinitionIds ?? [];

  const optionalItemTags = role.optionalItemTags ?? [];

  const hasRequiredItem = requiredItemDefinitionIds.length > 0 || requiredItemTags.length > 0;

  const hasOptionalItem = optionalItemDefinitionIds.length > 0 || optionalItemTags.length > 0;

  const requiredItemUsableByRoleId = role.requiredItemUsableByRoleId;

  if (requiredItemUsableByRoleId !== undefined) {
    if (!requiredItemUsableByRoleId.trim()) {
      throw new Error(
        `Event "${eventId}" role ` +
          `"${role.id}" declares an empty ` +
          "required-item usability role.",
      );
    }

    if (!hasRequiredItem) {
      throw new Error(
        `Event "${eventId}" role ` +
          `"${role.id}" declares delegated ` +
          "required-item usability without " +
          "a required item.",
      );
    }

    if (requiredItemUsableByRoleId === role.id) {
      throw new Error(
        `Event "${eventId}" role ` +
          `"${role.id}" cannot evaluate ` +
          "required-item usability against itself.",
      );
    }

    if (!knownRoleIds.has(requiredItemUsableByRoleId)) {
      throw new Error(
        `Event "${eventId}" role ` +
          `"${role.id}" references unknown ` +
          `usability role ` +
          `"${requiredItemUsableByRoleId}".`,
      );
    }

    if (!earlierRoleIds.has(requiredItemUsableByRoleId)) {
      throw new Error(
        `Event "${eventId}" role ` +
          `"${role.id}" must reference an ` +
          "earlier role for required-item usability.",
      );
    }
  }

  if (hasRequiredItem && hasOptionalItem) {
    throw new Error(
      `Event "${eventId}" role "${role.id}" cannot select both a required and optional item.`,
    );
  }

  if (
    role.requiredItemRequireUsable !== undefined &&
    typeof role.requiredItemRequireUsable !== "boolean"
  ) {
    throw new Error(
      `Event "${eventId}" role "${role.id}" ` + "has invalid required-item usability.",
    );
  }

  if (role.requiredItemRequireUsable !== undefined && !hasRequiredItem) {
    throw new Error(
      `Event "${eventId}" role "${role.id}" ` +
        "declares required-item usability " +
        "without a required item.",
    );
  }

  if (role.itemAccess !== undefined && !hasRequiredItem) {
    throw new Error(
      `Event "${eventId}" role "${role.id}" declares required-item access without a required item.`,
    );
  }

  if (role.optionalItemAccess !== undefined && !hasOptionalItem) {
    throw new Error(
      `Event "${eventId}" role "${role.id}" declares optional-item access without an optional item.`,
    );
  }

  if (
    role.itemAccess !== undefined &&
    role.itemAccess !== "accessible" &&
    role.itemAccess !== "owned"
  ) {
    throw new Error(`Event "${eventId}" role "${role.id}" has invalid required-item access.`);
  }

  if (
    role.optionalItemAccess !== undefined &&
    role.optionalItemAccess !== "accessible" &&
    role.optionalItemAccess !== "owned"
  ) {
    throw new Error(`Event "${eventId}" role "${role.id}" has invalid optional-item access.`);
  }

  validateItemDefinitionIds(eventId, role.id, "required", requiredItemDefinitionIds);

  validateItemTags(eventId, role.id, "required", requiredItemTags);

  validateItemDefinitionIds(eventId, role.id, "optional", optionalItemDefinitionIds);

  validateItemTags(eventId, role.id, "optional", optionalItemTags);
}

export function validateEventDefinition(definition: EventDefinition): void {
  if (!EVENT_ID_PATTERN.test(definition.id)) {
    throw new Error(`Event ID "${definition.id}" must be non-empty kebab-case text.`);
  }

  if (!EVENT_CATEGORIES.has(definition.category)) {
    throw new Error(
      `Event "${definition.id}" has invalid category "${String(definition.category)}".`,
    );
  }

  if (
    definition.safetyResolution !== undefined &&
    definition.safetyResolution !== "force-success"
  ) {
    throw new Error(`Event "${definition.id}" has invalid safety-resolution metadata.`);
  }

  if (!Number.isFinite(definition.baseWeight) || definition.baseWeight <= 0) {
    throw new Error(`Event "${definition.id}" must have a positive finite weight.`);
  }

  if (definition.periods.length === 0) {
    throw new Error(`Event "${definition.id}" must declare at least one period.`);
  }

  validateUniqueValues(definition.id, "periods", definition.periods);

  for (const period of definition.periods) {
    if (!EVENT_PERIODS.has(period)) {
      throw new Error(`Event "${definition.id}" has invalid period "${String(period)}".`);
    }
  }

  validateUniqueValues(definition.id, "tags", definition.tags);

  for (const tag of definition.tags) {
    if (!EVENT_TAGS.has(tag)) {
      throw new Error(`Event "${definition.id}" has invalid tag "${String(tag)}".`);
    }
  }

  if (definition.roles.length === 0) {
    throw new Error(`Event "${definition.id}" must declare at least one participant role.`);
  }

  const roleIds = definition.roles.map((role) => role.id);

  validateUniqueValues(definition.id, "participant role IDs", roleIds);

  const knownRoleIds = new Set(roleIds);

  const earlierRoleIds = new Set<string>();

  for (const role of definition.roles) {
    validateRole(definition.id, role, knownRoleIds, earlierRoleIds);

    earlierRoleIds.add(role.id);
  }

  if (definition.isEligible !== undefined && typeof definition.isEligible !== "function") {
    throw new Error(`Event "${definition.id}" has an invalid eligibility callback.`);
  }

  if (
    definition.getWeightMultiplier !== undefined &&
    typeof definition.getWeightMultiplier !== "function"
  ) {
    throw new Error(`Event "${definition.id}" has an invalid weight multiplier.`);
  }

  if (typeof definition.resolve !== "function") {
    throw new Error(`Event "${definition.id}" must declare a resolver.`);
  }
}
