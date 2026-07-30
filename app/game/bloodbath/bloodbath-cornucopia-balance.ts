import type { EventDefinition } from "~/game/events/event-schema";
import { getEventParticipantCount } from "~/game/events/event-participant-shape";

export interface CornucopiaFatalProfile {
  definition: EventDefinition;
  minImmediateEliminations: number;
  maxImmediateEliminations: number;
}

export const BLOODBATH_FATAL_SOLO_TUNING_MULTIPLIER = 0.15;
export const BLOODBATH_FATAL_NON_SOLO_TUNING_MULTIPLIER = 1.5;
export const BLOODBATH_FATAL_VARIABLE_OUTCOME_TUNING_MULTIPLIER = 0.35;
export const BLOODBATH_FATAL_ADDITIONAL_GUARANTEED_DEATH_MULTIPLIER = 1.5;

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

function assertProfile(profile: CornucopiaFatalProfile): void {
  assertNonNegativeInteger(
    profile.minImmediateEliminations,
    `Minimum eliminations for "${profile.definition.id}"`,
  );
  assertNonNegativeInteger(
    profile.maxImmediateEliminations,
    `Maximum eliminations for "${profile.definition.id}"`,
  );

  if (profile.maxImmediateEliminations < profile.minImmediateEliminations) {
    throw new Error(
      `Cornucopia fatal profile "${profile.definition.id}" has an invalid elimination range.`,
    );
  }
}

/**
 * Phase 3C tuning for the existing unified fatal candidate pool.
 *
 * The ordinary participant-shape multiplier remains responsible for the
 * general solo penalty. This additional multiplier reflects fatal-planning
 * efficiency: guaranteed multi-participant progress is preferred, while
 * variable outcomes remain available without competing like guaranteed kills.
 *
 * Explicit profile multipliers are handled by the fatal planner and bypass
 * this policy, so intentionally rare delayed fatalities retain their authored
 * weight.
 */
export function getBloodbathFatalTuningMultiplier(profile: CornucopiaFatalProfile): number {
  assertProfile(profile);

  const participantCount = getEventParticipantCount(profile.definition);
  const participantMultiplier =
    participantCount === 1
      ? BLOODBATH_FATAL_SOLO_TUNING_MULTIPLIER
      : BLOODBATH_FATAL_NON_SOLO_TUNING_MULTIPLIER;
  const guaranteedEliminationMultiplier =
    profile.minImmediateEliminations === 0
      ? BLOODBATH_FATAL_VARIABLE_OUTCOME_TUNING_MULTIPLIER
      : 1 +
        Math.max(0, profile.minImmediateEliminations - 1) *
          BLOODBATH_FATAL_ADDITIONAL_GUARANTEED_DEATH_MULTIPLIER;

  return participantMultiplier * guaranteedEliminationMultiplier;
}
