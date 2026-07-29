// Phase 3: compiled recovery-profile validation.
import type { EventDefinition, EventRecoveryTarget } from "~/game/events/event-schema";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";

function getTargetKey(target: EventRecoveryTarget): string {
  switch (target.kind) {
    case "survival-need":
      return [target.kind, target.roleId, target.need].join(":");

    case "status":
      return [target.kind, target.roleId, [...target.statusIds].sort().join(",")].join(":");
  }
}

export function validateEventRecoveryProfile(definition: EventDefinition): void {
  const profile = definition.recoveryProfile;

  if (!profile) {
    return;
  }

  if (profile.targets.length === 0) {
    throw new Error(`Event "${definition.id}" declares an empty recovery profile.`);
  }

  const roleIds = new Set(definition.roles.map((role) => role.id));
  const keys = profile.targets.map(getTargetKey);

  if (new Set(keys).size !== keys.length) {
    throw new Error(`Event "${definition.id}" declares duplicate recovery targets.`);
  }

  for (const target of profile.targets) {
    if (!roleIds.has(target.roleId)) {
      throw new Error(
        `Event "${definition.id}" recovery target references unknown role "${target.roleId}".`,
      );
    }

    if (target.kind !== "status") {
      continue;
    }

    if (target.statusIds.length === 0) {
      throw new Error(
        `Event "${definition.id}" status recovery target must declare at least one status.`,
      );
    }

    if (new Set(target.statusIds).size !== target.statusIds.length) {
      throw new Error(
        `Event "${definition.id}" status recovery target declares duplicate statuses.`,
      );
    }

    for (const statusId of target.statusIds) {
      if (getStatusDefinition(statusId).kind !== "harmful") {
        throw new Error(
          `Event "${definition.id}" cannot prioritize recovery for beneficial status "${statusId}".`,
        );
      }
    }
  }
}
