// Phase 3: active-problem recovery priority.
import type { EventDefinition, EventRecoveryTarget } from "~/game/events/event-schema";
import type { ParticipantSelection } from "~/game/events/participant-selection";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { GameTribute } from "~/game/types/game-state";

export type RecoveryPrioritySeverity = 0 | 1 | 2 | 3;

export interface EventRecoveryPriorityBreakdown {
  severity: RecoveryPrioritySeverity;
  multiplier: number;
  activeTributeIds: readonly string[];
  activeTargetKinds: readonly EventRecoveryTarget["kind"][];
}

const SURVIVAL_NEED_STATUS_IDS = {
  food: "hungry",
  water: "thirsty",
} as const satisfies Record<"food" | "water", StatusEffectId>;

export function getRecoveryPriorityMultiplier(severity: RecoveryPrioritySeverity): number {
  switch (severity) {
    case 0:
      return 1;
    case 1:
      return 2.5;
    case 2:
      return 4;
    case 3:
      return 6;
  }
}

export function getRecoveryParticipantWeightMultiplier(severity: RecoveryPrioritySeverity): number {
  return severity === 0 ? 1 : getRecoveryPriorityMultiplier(severity) * 2;
}

function getTargetStatusIds(target: EventRecoveryTarget): readonly StatusEffectId[] {
  return target.kind === "status" ? target.statusIds : [SURVIVAL_NEED_STATUS_IDS[target.need]];
}

export function getTributeRecoveryTargetSeverity(
  tribute: GameTribute,
  target: EventRecoveryTarget,
): RecoveryPrioritySeverity {
  const statusIds = new Set(getTargetStatusIds(target));

  return tribute.statuses.reduce(
    (highestSeverity, status) =>
      statusIds.has(status.definitionId)
        ? (Math.max(highestSeverity, status.severity) as RecoveryPrioritySeverity)
        : highestSeverity,
    0 as RecoveryPrioritySeverity,
  );
}

function getRoleTargets(
  definition: EventDefinition,
  roleId: string,
): readonly EventRecoveryTarget[] {
  return definition.recoveryProfile?.targets.filter((target) => target.roleId === roleId) ?? [];
}

export function getParticipantRecoveryPriorityMultiplier(
  definition: EventDefinition,
  roleId: string,
  tribute: GameTribute,
): number {
  const severity = getRoleTargets(definition, roleId).reduce(
    (highestSeverity, target) =>
      Math.max(
        highestSeverity,
        getTributeRecoveryTargetSeverity(tribute, target),
      ) as RecoveryPrioritySeverity,
    0 as RecoveryPrioritySeverity,
  );

  return getRecoveryParticipantWeightMultiplier(severity);
}

export function getEventSelectionRecoveryPriorityBreakdown(
  definition: EventDefinition,
  selection: ParticipantSelection,
): EventRecoveryPriorityBreakdown {
  const profile = definition.recoveryProfile;

  if (!profile || profile.targets.length === 0) {
    return {
      severity: 0,
      multiplier: 1,
      activeTributeIds: [],
      activeTargetKinds: [],
    };
  }

  let severity: RecoveryPrioritySeverity = 0;
  const activeTributeIds = new Set<string>();
  const activeTargetKinds = new Set<EventRecoveryTarget["kind"]>();

  for (const target of profile.targets) {
    const participants = selection.participantsByRole[target.roleId] ?? [];

    for (const tribute of participants) {
      const targetSeverity = getTributeRecoveryTargetSeverity(tribute, target);

      if (targetSeverity === 0) {
        continue;
      }

      severity = Math.max(severity, targetSeverity) as RecoveryPrioritySeverity;
      activeTributeIds.add(tribute.id);
      activeTargetKinds.add(target.kind);
    }
  }

  return {
    severity,
    multiplier: getRecoveryPriorityMultiplier(severity),
    activeTributeIds: [...activeTributeIds],
    activeTargetKinds: [...activeTargetKinds],
  };
}

export function getEventSelectionRecoveryPriorityMultiplier(
  definition: EventDefinition,
  selection: ParticipantSelection,
): number {
  return getEventSelectionRecoveryPriorityBreakdown(definition, selection).multiplier;
}
