import type {
  AuthoredEventConfiguration,
  EventResolutionStrategy,
} from "~/game/events/authoring/builder/event-builder-types";

const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateAuthoredEvent(
  configuration: AuthoredEventConfiguration,

  strategy: EventResolutionStrategy,
): void {
  const { id, baseWeight, periods, roles } = configuration;

  if (!EVENT_ID_PATTERN.test(id)) {
    throw new Error(`Event ID "${id}" must be ` + "non-empty kebab-case text.");
  }

  if (!Number.isFinite(baseWeight) || baseWeight <= 0) {
    throw new Error(`Event "${id}" must have ` + "a positive finite weight.");
  }

  if (periods.length === 0) {
    throw new Error(`Event "${id}" must declare ` + "at least one period.");
  }

  for (const period of periods) {
    if (period !== "day" && period !== "night") {
      throw new Error(`Event "${id}" declares ` + `invalid period "${period}".`);
    }
  }

  if (new Set(periods).size !== periods.length) {
    throw new Error(`Event "${id}" declares the ` + "same period more than once.");
  }

  if (roles.length === 0) {
    throw new Error(`Event "${id}" must declare at ` + "least one participant role.");
  }

  const roleIds = roles.map((role) => role.id);

  if (new Set(roleIds).size !== roleIds.length) {
    throw new Error(`Event "${id}" declares duplicate ` + "participant role IDs.");
  }

  for (const role of roles) {
    if (!role.id.trim()) {
      throw new Error(`Event "${id}" contains an ` + "empty participant role ID.");
    }

    if (!Number.isInteger(role.count) || role.count <= 0) {
      throw new Error(`Event "${id}" role "${role.id}" ` + "must have a positive integer count.");
    }
  }

  strategy.validate(id, roleIds);
}
