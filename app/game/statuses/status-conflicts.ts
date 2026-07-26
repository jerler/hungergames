import type { GameTribute, StatusEffect } from "~/game/types/game-state";

import type { StatusEffectId } from "./status-schema";

/**
 * Statuses removed when a new status is applied.
 *
 * This implements "latest status wins":
 *
 * - Applying well-fed removes hungry.
 * - Applying hungry removes well-fed.
 * - Applying alert or well-rested removes exhausted.
 * - Applying exhausted removes alert and well-rested.
 *
 * Alert and well-rested intentionally do not conflict.
 */
export const STATUS_CONFLICTS: Partial<Record<StatusEffectId, readonly StatusEffectId[]>> = {
  "well-fed": ["hungry"],

  hungry: ["well-fed"],

  "well-rested": ["exhausted"],

  alert: ["exhausted"],

  exhausted: ["well-rested", "alert"],
};

export function getConflictingStatusIds(
  incomingStatusId: StatusEffectId,
): readonly StatusEffectId[] {
  return STATUS_CONFLICTS[incomingStatusId] ?? [];
}

/**
 * Removes statuses that conflict with an incoming status.
 *
 * This does not add or merge the incoming status. That is
 * handled by upsertStatusEffect() in status-engine.ts.
 */
export function removeConflictingStatuses(
  statuses: readonly StatusEffect[],
  incomingStatusId: StatusEffectId,
): StatusEffect[] {
  const conflictingStatusIds = new Set(getConflictingStatusIds(incomingStatusId));

  if (conflictingStatusIds.size === 0) {
    return [...statuses];
  }

  return statuses.filter((status) => !conflictingStatusIds.has(status.definitionId));
}

/**
 * Detects an invalid state even if some future code bypasses
 * the normal status insertion helper.
 */
export function assertValidStatusCombination(tribute: GameTribute): void {
  const activeStatusIds = new Set(tribute.statuses.map((status) => status.definitionId));

  for (const statusId of activeStatusIds) {
    for (const conflictingStatusId of getConflictingStatusIds(statusId)) {
      if (!activeStatusIds.has(conflictingStatusId)) {
        continue;
      }

      throw new Error(
        `Tribute "${tribute.id}" cannot have both ` + `"${statusId}" and "${conflictingStatusId}".`,
      );
    }
  }
}
