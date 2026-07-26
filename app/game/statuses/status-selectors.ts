import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import { compareStatusesByUrgency } from "~/game/statuses/status-presentation";
import type { GameTribute, StatusEffect } from "~/game/types/game-state";

const ROUND_PERIOD_ORDER = {
  day: 0,
  night: 1,
} as const;

export function isActiveStatus(status: StatusEffect): boolean {
  return status.remainingRounds === null || status.remainingRounds > 0;
}

function compareAppliedRoundsNewestFirst(
  firstStatus: StatusEffect,
  secondStatus: StatusEffect,
): number {
  return (
    secondStatus.appliedRound.day - firstStatus.appliedRound.day ||
    ROUND_PERIOD_ORDER[secondStatus.appliedRound.period] -
      ROUND_PERIOD_ORDER[firstStatus.appliedRound.period]
  );
}

/**
 * Duplicate definitions should not normally survive the status engine's
 * upsert policy. This defensive comparison makes legacy or malformed state
 * deterministic while keeping only one instance of each non-stackable status.
 */
function compareDuplicateCandidates(firstStatus: StatusEffect, secondStatus: StatusEffect): number {
  const definition = getStatusDefinition(firstStatus.definitionId);

  const severityDifference = secondStatus.severity - firstStatus.severity;

  if (severityDifference !== 0) {
    return severityDifference;
  }

  if (
    definition.duration.kind === "timed" &&
    firstStatus.remainingRounds !== null &&
    secondStatus.remainingRounds !== null
  ) {
    const durationDifference =
      definition.duration.expiration === "fatal"
        ? firstStatus.remainingRounds - secondStatus.remainingRounds
        : secondStatus.remainingRounds - firstStatus.remainingRounds;

    if (durationDifference !== 0) {
      return durationDifference;
    }
  }

  return (
    compareAppliedRoundsNewestFirst(firstStatus, secondStatus) ||
    firstStatus.id.localeCompare(secondStatus.id)
  );
}

/**
 * Returns every displayable status in a stable order.
 *
 * Ordering:
 * 1. Fatal conditions, soonest expiration first.
 * 2. Severity 3 harmful timed statuses.
 * 3. Severity 2 harmful timed statuses.
 * 4. Severity 1 harmful timed statuses.
 * 5. Persistent harmful needs such as Hungry and Thirsty.
 * 6. Beneficial statuses such as Well Fed and Well Rested.
 * 7. Alphabetical tie-breakers within a group.
 */
export function getActiveStatuses(tribute: GameTribute): StatusEffect[] {
  const statusByDefinitionId = new Map<StatusEffect["definitionId"], StatusEffect>();

  for (const status of tribute.statuses) {
    if (!isActiveStatus(status)) {
      continue;
    }

    const existingStatus = statusByDefinitionId.get(status.definitionId);

    if (!existingStatus || compareDuplicateCandidates(status, existingStatus) < 0) {
      statusByDefinitionId.set(status.definitionId, status);
    }
  }

  return [...statusByDefinitionId.values()].sort(compareStatusesByUrgency);
}
