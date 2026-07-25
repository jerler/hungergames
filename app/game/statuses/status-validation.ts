import type { StatusDefinition, StatusEffectId } from "./status-schema";

const STATUS_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MODIFIER_KEYS = [
  "combatPerSeverity",
  "survivalPerSeverity",
  "awarenessPerSeverity",
  "foragingPerSeverity",
] as const;

function fail(statusId: string, message: string): never {
  throw new Error(`Invalid status "${statusId}": ${message}`);
}

function hasOwnProperty(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}

function requireNonEmptyString(statusId: string, label: string, value: unknown): void {
  if (typeof value !== "string" || !value.trim()) {
    fail(statusId, `must declare a non-empty ${label}.`);
  }
}

export function validateStatusDefinition(definition: StatusDefinition): void {
  if (!STATUS_ID_PATTERN.test(definition.id)) {
    fail(definition.id, "ID must be non-empty kebab-case text.");
  }

  requireNonEmptyString(definition.id, "label", definition.label);

  requireNonEmptyString(definition.id, "description", definition.description);

  if (definition.kind !== "harmful" && definition.kind !== "beneficial") {
    fail(definition.id, "declares an invalid kind.");
  }

  if (definition.maxSeverity !== 3) {
    fail(definition.id, "must support exactly three severity levels.");
  }

  for (const modifierKey of MODIFIER_KEYS) {
    const modifier = definition.modifiers[modifierKey];

    if (!Number.isFinite(modifier)) {
      fail(definition.id, `declares an invalid ${modifierKey}.`);
    }
  }

  const duration = definition.duration;

  if (duration.kind === "timed") {
    if (!Number.isInteger(duration.defaultRounds) || duration.defaultRounds <= 0) {
      fail(definition.id, "declares an invalid default duration.");
    }

    if (duration.expiration !== "fatal" && duration.expiration !== "recover") {
      fail(definition.id, "declares an invalid timed expiration.");
    }
  } else if (duration.kind !== "persistent") {
    fail(definition.id, "declares an invalid duration kind.");
  }

  const definitionRecord = definition as unknown as Record<string, unknown>;

  const hasFatalCauseLabel = hasOwnProperty(definition, "fatalCauseLabel");

  const hasFatalSummary = hasOwnProperty(definition, "fatalSummary");

  const isFatal = duration.kind === "timed" && duration.expiration === "fatal";

  if (isFatal) {
    if (definition.kind !== "harmful") {
      fail(definition.id, "fatal statuses must be harmful.");
    }

    requireNonEmptyString(definition.id, "fatal cause label", definitionRecord.fatalCauseLabel);

    requireNonEmptyString(definition.id, "fatal summary", definitionRecord.fatalSummary);
  } else if (hasFatalCauseLabel || hasFatalSummary) {
    fail(definition.id, "only fatal statuses may declare fatality copy.");
  }

  const hasRemovalDescription = hasOwnProperty(definition, "removalDescription");

  if (duration.kind === "persistent") {
    requireNonEmptyString(
      definition.id,
      "removal description",
      definitionRecord.removalDescription,
    );
  } else if (hasRemovalDescription) {
    fail(definition.id, "only persistent statuses may declare removal instructions.");
  }
}

export function validateStatusCatalogue(definitions: readonly StatusDefinition[]): void {
  const statusIds = definitions.map((definition) => definition.id);

  if (new Set(statusIds).size !== statusIds.length) {
    throw new Error("Status catalogue contains duplicate IDs.");
  }

  for (const definition of definitions) {
    validateStatusDefinition(definition);
  }
}

export function assertKnownStatusId(
  statusId: string,
  definitions: readonly StatusDefinition[],
): asserts statusId is StatusEffectId {
  if (!definitions.some((definition) => definition.id === statusId)) {
    throw new Error(`Unknown status definition "${statusId}".`);
  }
}
