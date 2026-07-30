import type { EventDefinition } from "~/game/events/event-schema";
import type { GameChange, ResolvedEvent, RoundReference } from "~/game/types/game-state";

export interface RoundLethalityProfile {
  preferredEliminations: number;
  maxEliminations: number;
  lethalEventWeightMultiplier: number;
}

const MAX_DAY_ELIMINATIONS = 6;
const MAX_NIGHT_ELIMINATIONS = 5;
const PREFERRED_KILL_URGENCY_MULTIPLIER = 4;

export function isBloodbathRound(round: RoundReference): boolean {
  return round.day === 1 && round.period === "day";
}

export function getRoundLethalityProfile(
  round: RoundReference,
  livingTributeCount: number,
): RoundLethalityProfile {
  const survivorSafeMaximum = Math.max(0, livingTributeCount - 1);

  if (isBloodbathRound(round)) {
    return {
      preferredEliminations: survivorSafeMaximum,
      maxEliminations: survivorSafeMaximum,
      lethalEventWeightMultiplier: 1,
    };
  }

  if (round.period === "night") {
    const scheduledMaximum = round.day === 1 ? 1 : Math.min(MAX_NIGHT_ELIMINATIONS, round.day - 1);

    const maxEliminations = Math.min(survivorSafeMaximum, scheduledMaximum);

    return {
      preferredEliminations: Math.min(maxEliminations, Math.max(0, scheduledMaximum - 1)),
      maxEliminations,
      lethalEventWeightMultiplier: Math.min(2.5, 0.08 + Math.max(0, round.day - 1) * 0.2),
    };
  }

  const scheduledMaximum = Math.min(MAX_DAY_ELIMINATIONS, Math.max(2, round.day));

  const maxEliminations = Math.min(survivorSafeMaximum, scheduledMaximum);

  return {
    preferredEliminations: Math.min(maxEliminations, Math.max(1, scheduledMaximum - 1)),
    maxEliminations,
    lethalEventWeightMultiplier: Math.min(4, 0.4 + Math.max(0, round.day - 2) * 0.65),
  };
}

export function isPotentiallyLethalDefinition(definition: EventDefinition): boolean {
  return (
    definition.category === "fatal" ||
    ("safetyResolution" in definition && definition.safetyResolution === "force-success")
  );
}

export function getLethalCandidateWeightMultiplier(
  profile: RoundLethalityProfile,
  plannedEliminationCount: number,
): number {
  const urgencyMultiplier =
    plannedEliminationCount < profile.preferredEliminations ? PREFERRED_KILL_URGENCY_MULTIPLIER : 1;

  return profile.lethalEventWeightMultiplier * urgencyMultiplier;
}

export function countEliminationChanges(changes: readonly GameChange[]): number {
  return new Set(
    changes.flatMap((change) => (change.type === "eliminate-tribute" ? [change.tributeId] : [])),
  ).size;
}

export function countEventEliminations(events: readonly ResolvedEvent[]): number {
  return new Set(
    events.flatMap((event) =>
      event.changes.flatMap((change) =>
        change.type === "eliminate-tribute" ? [change.tributeId] : [],
      ),
    ),
  ).size;
}
