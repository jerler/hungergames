// Phase 3: authored recovery-target validation.
import type { EventRecoveryTarget } from "~/game/events/event-schema";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";

function getTargetKey(target: EventRecoveryTarget): string {
  switch (target.kind) {
    case "survival-need":
      return [target.kind, target.roleId, target.need].join(":");

    case "status":
      return [target.kind, target.roleId, [...target.statusIds].sort().join(",")].join(":");
  }
}

export function validateAuthoredRecoveryTargets(
  eventId: string,
  targets: readonly EventRecoveryTarget[],
  knownRoleIds: ReadonlySet<string>,
): void {
  const keys = targets.map(getTargetKey);

  if (new Set(keys).size !== keys.length) {
    throw new Error(`Event "${eventId}" declares duplicate recovery targets.`);
  }

  for (const target of targets) {
    if (!knownRoleIds.has(target.roleId)) {
      throw new Error(
        `Event "${eventId}" recovery target references unknown role "${target.roleId}".`,
      );
    }

    if (target.kind !== "status") {
      continue;
    }

    if (target.statusIds.length === 0) {
      throw new Error(
        `Event "${eventId}" status recovery target must declare at least one status.`,
      );
    }

    if (new Set(target.statusIds).size !== target.statusIds.length) {
      throw new Error(`Event "${eventId}" status recovery target declares duplicate statuses.`);
    }

    for (const statusId of target.statusIds) {
      const definition = getStatusDefinition(statusId);

      if (definition.kind !== "harmful") {
        throw new Error(
          `Event "${eventId}" cannot prioritize recovery for beneficial status "${statusId}".`,
        );
      }
    }
  }
}
