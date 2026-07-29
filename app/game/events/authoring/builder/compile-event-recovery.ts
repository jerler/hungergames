// Phase 3: authored recovery-profile compilation.
import type { EventRecoveryProfile, EventRecoveryTarget } from "~/game/events/event-schema";
import type { AuthoredRequirement } from "~/game/events/authoring/requirements/requirement-schema";

function getTargetKey(target: EventRecoveryTarget): string {
  switch (target.kind) {
    case "survival-need":
      return [target.kind, target.roleId, target.need].join(":");

    case "status":
      return [target.kind, target.roleId, [...target.statusIds].sort().join(",")].join(":");
  }
}

export function createAuthoredEventRecoveryProfile(
  explicitTargets: readonly EventRecoveryTarget[],
  requirements: readonly AuthoredRequirement[],
): EventRecoveryProfile | undefined {
  const inferredTreatmentTargets = requirements.flatMap((requirement): EventRecoveryTarget[] =>
    requirement.kind === "has-treatment-for"
      ? [
          {
            kind: "status",
            roleId: requirement.roleId,
            statusIds: [requirement.statusId],
          },
        ]
      : [],
  );

  const targetsByKey = new Map(
    [...explicitTargets, ...inferredTreatmentTargets].map((target) => [
      getTargetKey(target),
      target,
    ]),
  );

  if (targetsByKey.size === 0) {
    return undefined;
  }

  return {
    targets: [...targetsByKey.values()],
  };
}
