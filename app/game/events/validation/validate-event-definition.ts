import {
  EVENT_PARTICIPANT_SHAPES,
  type EventAuditEligibilityMetadata,
  type EventAuditPrerequisite,
  type EventDefinition,
  type ParticipantRoleDefinition,
} from "~/game/events/event-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { ITEM_TAGS, type ItemDefinitionId, type ItemTag } from "~/game/items/item-schema";
import { validateEventRecoveryProfile } from "./validate-event-recovery-profile";

const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const EVENT_CATEGORIES = new Set(["fatal", "survival", "hazard"]);

const EVENT_PARTICIPANT_SHAPE_SET = new Set(EVENT_PARTICIPANT_SHAPES);

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

const EVENT_SPECIFICITY_REASONS = new Set([
  "stat-requirement",
  "status-requirement",
  "deprivation-requirement",
  "truce-requirement",
  "item-requirement",
  "custom-eligibility",
]);

const EVENT_AUDIT_ELIGIBILITY_COVERAGE = new Set(["complete", "opaque"]);
const EVENT_AUDIT_STATS = new Set(["brains", "brawn", "luck"]);
const EVENT_AUDIT_STAT_COMPARISONS = new Set(["eq", "gte", "lte"]);
const EVENT_AUDIT_STAT_VALUE_SOURCES = new Set(["base", "effective"]);
const EVENT_AUDIT_RELATIONSHIPS = new Set(["truce", "vendetta"]);
const EVENT_AUDIT_RELATIONSHIP_KINDS = new Set(["standard", "romantic"]);
const EVENT_AUDIT_ITEM_ACCESS = new Set(["accessible", "owned"]);
const EVENT_AUDIT_SURVIVAL_NEEDS = new Set(["food", "water"]);

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

function validateAuditRoleReference(
  eventId: string,
  label: string,
  roleId: string,
  knownRoleIds: ReadonlySet<string>,
): void {
  if (!roleId.trim() || !knownRoleIds.has(roleId)) {
    throw new Error(`Event "${eventId}" ${label} references unknown role "${roleId}".`);
  }
}

function validateAuditStatCondition(
  eventId: string,
  condition: {
    stat: string;
    comparison: string;
    threshold: number;
    valueSource?: string;
  },
): void {
  if (!EVENT_AUDIT_STATS.has(condition.stat)) {
    throw new Error(`Event "${eventId}" has invalid audit stat "${String(condition.stat)}".`);
  }

  if (!EVENT_AUDIT_STAT_COMPARISONS.has(condition.comparison)) {
    throw new Error(
      `Event "${eventId}" has invalid audit stat comparison ` +
        `"${String(condition.comparison)}".`,
    );
  }

  if (
    !Number.isInteger(condition.threshold) ||
    condition.threshold < 1 ||
    condition.threshold > 5
  ) {
    throw new Error(
      `Event "${eventId}" has invalid audit stat threshold ` + `"${String(condition.threshold)}".`,
    );
  }

  if (
    condition.valueSource !== undefined &&
    !EVENT_AUDIT_STAT_VALUE_SOURCES.has(condition.valueSource)
  ) {
    throw new Error(
      `Event "${eventId}" has invalid audit stat value source ` +
        `"${String(condition.valueSource)}".`,
    );
  }
}

function validateAuditStatusCondition(
  eventId: string,
  condition: {
    statusId: string;
    present: boolean;
    minimumSeverity?: number;
    maximumSeverity?: number;
  },
): void {
  if (!String(condition.statusId).trim()) {
    throw new Error(`Event "${eventId}" has an empty audit status prerequisite.`);
  }

  if (typeof condition.present !== "boolean") {
    throw new Error(`Event "${eventId}" has invalid audit status presence metadata.`);
  }

  for (const [label, severity] of [
    ["minimum", condition.minimumSeverity],
    ["maximum", condition.maximumSeverity],
  ] as const) {
    if (severity !== undefined && (!Number.isInteger(severity) || severity < 1)) {
      throw new Error(
        `Event "${eventId}" has invalid audit status ${label} severity ` + `"${String(severity)}".`,
      );
    }
  }

  if (
    !condition.present &&
    (condition.minimumSeverity !== undefined || condition.maximumSeverity !== undefined)
  ) {
    throw new Error(
      `Event "${eventId}" cannot declare audit status severity bounds when presence is false.`,
    );
  }

  if (
    condition.minimumSeverity !== undefined &&
    condition.maximumSeverity !== undefined &&
    condition.minimumSeverity > condition.maximumSeverity
  ) {
    throw new Error(
      `Event "${eventId}" audit status minimum severity exceeds its maximum severity.`,
    );
  }
}

function validateAuditMinimumMatchingCount(
  eventId: string,
  minimumMatchingCount: number | undefined,
): void {
  if (
    minimumMatchingCount !== undefined &&
    (!Number.isInteger(minimumMatchingCount) || minimumMatchingCount < 1)
  ) {
    throw new Error(
      `Event "${eventId}" audit status minimum matching count must be a positive integer.`,
    );
  }
}

function validateAuditPrerequisite(
  eventId: string,
  prerequisite: EventAuditPrerequisite,
  knownRoleIds: ReadonlySet<string>,
  scopeRoleId?: string,
): void {
  validateAuditRoleReference(
    eventId,
    `audit prerequisite "${prerequisite.kind}"`,
    prerequisite.roleId,
    knownRoleIds,
  );

  if (scopeRoleId !== undefined && prerequisite.roleId !== scopeRoleId) {
    throw new Error(
      `Event "${eventId}" role "${scopeRoleId}" audit prerequisite ` +
        `must reference its own role, not "${prerequisite.roleId}".`,
    );
  }

  switch (prerequisite.kind) {
    case "stat":
      validateAuditStatCondition(eventId, prerequisite);
      return;

    case "stat-any":
      if (prerequisite.alternatives.length < 2) {
        throw new Error(
          `Event "${eventId}" audit stat-any prerequisite requires at least two alternatives.`,
        );
      }

      validateUniqueValues(
        eventId,
        `audit stat alternatives for role "${prerequisite.roleId}"`,
        prerequisite.alternatives.map((alternative) => JSON.stringify(alternative)),
      );

      for (const alternative of prerequisite.alternatives) {
        validateAuditStatCondition(eventId, alternative);
      }
      return;

    case "status":
      validateAuditStatusCondition(eventId, prerequisite);
      validateAuditMinimumMatchingCount(eventId, prerequisite.minimumMatchingCount);
      return;

    case "status-any":
      if (prerequisite.alternatives.length < 2) {
        throw new Error(
          `Event "${eventId}" audit status-any prerequisite requires at least two alternatives.`,
        );
      }

      validateUniqueValues(
        eventId,
        `audit status alternatives for role "${prerequisite.roleId}"`,
        prerequisite.alternatives.map((alternative) => JSON.stringify(alternative)),
      );

      for (const alternative of prerequisite.alternatives) {
        validateAuditStatusCondition(eventId, alternative);
      }

      validateAuditMinimumMatchingCount(eventId, prerequisite.minimumMatchingCount);
      return;

    case "deprivation":
      if (!EVENT_AUDIT_SURVIVAL_NEEDS.has(prerequisite.need)) {
        throw new Error(
          `Event "${eventId}" has invalid audit deprivation need ` +
            `"${String(prerequisite.need)}".`,
        );
      }

      if (typeof prerequisite.deprived !== "boolean") {
        throw new Error(`Event "${eventId}" has invalid audit deprivation metadata.`);
      }
      return;

    case "relationship":
      if (!EVENT_AUDIT_RELATIONSHIPS.has(prerequisite.relationship)) {
        throw new Error(
          `Event "${eventId}" has invalid audit relationship ` +
            `"${String(prerequisite.relationship)}".`,
        );
      }

      if (
        prerequisite.relationshipKind !== undefined &&
        !EVENT_AUDIT_RELATIONSHIP_KINDS.has(prerequisite.relationshipKind)
      ) {
        throw new Error(
          `Event "${eventId}" has invalid audit relationship kind ` +
            `"${String(prerequisite.relationshipKind)}".`,
        );
      }

      if (prerequisite.relatedRoleId !== undefined) {
        validateAuditRoleReference(
          eventId,
          "audit relationship prerequisite",
          prerequisite.relatedRoleId,
          knownRoleIds,
        );
      }
      return;

    case "truce": {
      if (
        prerequisite.truceKind !== undefined &&
        !EVENT_AUDIT_RELATIONSHIP_KINDS.has(prerequisite.truceKind)
      ) {
        throw new Error(
          `Event "${eventId}" has invalid audit truce kind ` +
            `"${String(prerequisite.truceKind)}".`,
        );
      }

      const sizes = [
        prerequisite.exactSize,
        prerequisite.minimumSize,
        prerequisite.maximumSize,
      ].filter((value): value is number => value !== undefined);

      for (const size of sizes) {
        if (!Number.isInteger(size) || size < 2) {
          throw new Error(`Event "${eventId}" audit truce sizes must be integers of at least two.`);
        }
      }

      if (
        prerequisite.exactSize !== undefined &&
        (prerequisite.minimumSize !== undefined || prerequisite.maximumSize !== undefined)
      ) {
        throw new Error(
          `Event "${eventId}" audit truce prerequisite cannot combine exact and ranged sizes.`,
        );
      }

      if (
        prerequisite.minimumSize !== undefined &&
        prerequisite.maximumSize !== undefined &&
        prerequisite.minimumSize > prerequisite.maximumSize
      ) {
        throw new Error(`Event "${eventId}" audit truce minimum size exceeds its maximum size.`);
      }
      return;
    }

    case "item-definition":
      if (prerequisite.definitionIds.length === 0) {
        throw new Error(`Event "${eventId}" has an empty audit item-definition prerequisite.`);
      }

      validateItemDefinitionIds(eventId, prerequisite.roleId, "audit", prerequisite.definitionIds);

      if (!EVENT_AUDIT_ITEM_ACCESS.has(prerequisite.access)) {
        throw new Error(`Event "${eventId}" has invalid audit item access.`);
      }

      if (typeof prerequisite.requireUsable !== "boolean") {
        throw new Error(`Event "${eventId}" has invalid audit item usability.`);
      }

      validateAuditRoleReference(
        eventId,
        "audit item usability",
        prerequisite.usableByRoleId,
        knownRoleIds,
      );
      return;

    case "item-tag":
      if (prerequisite.tags.length === 0) {
        throw new Error(`Event "${eventId}" has an empty audit item-tag prerequisite.`);
      }

      validateItemTags(eventId, prerequisite.roleId, "audit", prerequisite.tags);

      if (!EVENT_AUDIT_ITEM_ACCESS.has(prerequisite.access)) {
        throw new Error(`Event "${eventId}" has invalid audit item access.`);
      }

      if (typeof prerequisite.requireUsable !== "boolean") {
        throw new Error(`Event "${eventId}" has invalid audit item usability.`);
      }

      validateAuditRoleReference(
        eventId,
        "audit item usability",
        prerequisite.usableByRoleId,
        knownRoleIds,
      );
      return;
  }
}

function validateAuditEligibilityMetadata({
  eventId,
  scopeLabel,
  scopeRoleId,
  metadata,
  hasEligibilityCallback,
  knownRoleIds,
}: {
  eventId: string;
  scopeLabel: string;
  scopeRoleId?: string;
  metadata: EventAuditEligibilityMetadata | undefined;
  hasEligibilityCallback: boolean;
  knownRoleIds: ReadonlySet<string>;
}): void {
  if (!metadata) {
    return;
  }

  if (!hasEligibilityCallback) {
    throw new Error(
      `Event "${eventId}" ${scopeLabel} declares audit eligibility metadata ` +
        "without an eligibility callback.",
    );
  }

  if (!EVENT_AUDIT_ELIGIBILITY_COVERAGE.has(metadata.coverage)) {
    throw new Error(`Event "${eventId}" ${scopeLabel} has invalid audit eligibility coverage.`);
  }

  const prerequisiteKeys = metadata.prerequisites.map((prerequisite) =>
    JSON.stringify(prerequisite),
  );

  validateUniqueValues(eventId, `${scopeLabel} audit prerequisites`, prerequisiteKeys);

  for (const prerequisite of metadata.prerequisites) {
    validateAuditPrerequisite(eventId, prerequisite, knownRoleIds, scopeRoleId);
  }
}

function sortedStrings(values: readonly string[]): string[] {
  return [...values].sort();
}

function sameStrings(first: readonly string[], second: readonly string[]): boolean {
  return JSON.stringify(sortedStrings(first)) === JSON.stringify(sortedStrings(second));
}

function validateAuditItemContradictions(definition: EventDefinition): void {
  const explicitPrerequisites = [
    ...(definition.auditEligibility?.prerequisites ?? []),
    ...definition.roles.flatMap((role) => role.auditEligibility?.prerequisites ?? []),
  ];

  for (const role of definition.roles) {
    const access = role.itemAccess ?? "accessible";
    const requireUsable = role.requiredItemRequireUsable ?? true;
    const usableByRoleId = role.requiredItemUsableByRoleId ?? role.id;
    const structuralDefinitionIds = role.requiredItemDefinitionIds ?? [];
    const structuralTags = role.requiredItemTags ?? [];

    for (const prerequisite of explicitPrerequisites) {
      if (prerequisite.roleId !== role.id) {
        continue;
      }

      if (
        prerequisite.kind === "item-definition" &&
        structuralDefinitionIds.length > 0 &&
        (!sameStrings(prerequisite.definitionIds, structuralDefinitionIds) ||
          prerequisite.access !== access ||
          prerequisite.requireUsable !== requireUsable ||
          prerequisite.usableByRoleId !== usableByRoleId)
      ) {
        throw new Error(
          `Event "${definition.id}" role "${role.id}" has audit item-definition ` +
            "metadata that contradicts its declarative required-item contract.",
        );
      }

      if (
        prerequisite.kind === "item-tag" &&
        structuralTags.length > 0 &&
        (!sameStrings(prerequisite.tags, structuralTags) ||
          prerequisite.access !== access ||
          prerequisite.requireUsable !== requireUsable ||
          prerequisite.usableByRoleId !== usableByRoleId)
      ) {
        throw new Error(
          `Event "${definition.id}" role "${role.id}" has audit item-tag ` +
            "metadata that contradicts its declarative required-item contract.",
        );
      }
    }
  }
}

function validateSelectionProfile(definition: EventDefinition): void {
  const profile = definition.selectionProfile;

  if (!profile) {
    return;
  }

  if (!Number.isFinite(profile.specificityScore) || profile.specificityScore <= 0) {
    throw new Error(`Event "${definition.id}" has an invalid specificity score.`);
  }

  if (profile.specificityReasons.length === 0) {
    throw new Error(`Event "${definition.id}" declares specificity without any reasons.`);
  }

  validateUniqueValues(definition.id, "specificity reasons", profile.specificityReasons);

  for (const reason of profile.specificityReasons) {
    if (!EVENT_SPECIFICITY_REASONS.has(reason)) {
      throw new Error(
        `Event "${definition.id}" has invalid specificity reason "${String(reason)}".`,
      );
    }
  }
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

  if (
    definition.participantShape !== undefined &&
    !EVENT_PARTICIPANT_SHAPE_SET.has(definition.participantShape)
  ) {
    throw new Error(`Event "${definition.id}" has invalid participant-shape metadata.`);
  }

  if (!Number.isFinite(definition.baseWeight) || definition.baseWeight <= 0) {
    throw new Error(`Event "${definition.id}" must have a positive finite weight.`);
  }

  validateSelectionProfile(definition);
  validateEventRecoveryProfile(definition);

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

    validateAuditEligibilityMetadata({
      eventId: definition.id,
      scopeLabel: `role "${role.id}"`,
      scopeRoleId: role.id,
      metadata: role.auditEligibility,
      hasEligibilityCallback: role.isEligible !== undefined,
      knownRoleIds,
    });

    earlierRoleIds.add(role.id);
  }

  validateAuditEligibilityMetadata({
    eventId: definition.id,
    scopeLabel: "definition",
    metadata: definition.auditEligibility,
    hasEligibilityCallback: definition.isEligible !== undefined,
    knownRoleIds,
  });

  validateAuditItemContradictions(definition);

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
