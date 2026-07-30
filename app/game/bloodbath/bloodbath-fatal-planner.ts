import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
import {
  getEventParticipantCount,
  getEventParticipantShapeMultiplier,
} from "~/game/events/event-participant-shape";

export interface BloodbathFatalSelectionProfile {
  definition: EventDefinition;
  minImmediateEliminations: number;
  maxImmediateEliminations: number;
}

function assertProfile(profile: BloodbathFatalSelectionProfile): void {
  const { minImmediateEliminations, maxImmediateEliminations } = profile;

  if (
    !Number.isInteger(minImmediateEliminations) ||
    minImmediateEliminations < 0 ||
    !Number.isInteger(maxImmediateEliminations) ||
    maxImmediateEliminations < minImmediateEliminations
  ) {
    throw new Error(
      `Bloodbath fatal profile "${profile.definition.id}" has an invalid elimination range.`,
    );
  }
}

function getPossibleEliminationCounts(profile: BloodbathFatalSelectionProfile): number[] {
  assertProfile(profile);

  return Array.from(
    {
      length: profile.maxImmediateEliminations - profile.minImmediateEliminations + 1,
    },
    (_, index) => profile.minImmediateEliminations + index,
  );
}

export function getBloodbathFatalProfileWeight(
  profile: BloodbathFatalSelectionProfile,
  context: EventSelectionContext,
): number {
  return (
    getEventDefinitionWeight(profile.definition, context) *
    getEventParticipantShapeMultiplier("bloodbath-cornucopia", profile.definition)
  );
}

export function canReachBloodbathFatalityTarget({
  profiles,
  availableParticipantCount,
  fatalityDeficit,
}: {
  profiles: readonly BloodbathFatalSelectionProfile[];
  availableParticipantCount: number;
  fatalityDeficit: number;
}): boolean {
  if (!Number.isInteger(availableParticipantCount) || availableParticipantCount < 0) {
    throw new Error("Available fatal participant count must be a non-negative integer.");
  }

  if (!Number.isInteger(fatalityDeficit) || fatalityDeficit < 0) {
    throw new Error("Bloodbath fatality deficit must be a non-negative integer.");
  }

  if (fatalityDeficit === 0) {
    return true;
  }

  const maximumAcceptedEliminations = fatalityDeficit + 1;
  let eliminationsByParticipantCount = Array.from(
    {
      length: availableParticipantCount + 1,
    },
    () => new Set<number>(),
  );

  eliminationsByParticipantCount[0]?.add(0);

  for (const profile of profiles) {
    const participantCount = getEventParticipantCount(profile.definition);

    if (participantCount > availableParticipantCount) {
      continue;
    }

    const nextEliminationsByParticipantCount = eliminationsByParticipantCount.map(
      (eliminationCounts) => new Set(eliminationCounts),
    );

    for (
      let usedParticipantCount = 0;
      usedParticipantCount + participantCount <= availableParticipantCount;
      usedParticipantCount += 1
    ) {
      const currentEliminationCounts = eliminationsByParticipantCount[usedParticipantCount];

      if (!currentEliminationCounts || currentEliminationCounts.size === 0) {
        continue;
      }

      for (const currentEliminationCount of currentEliminationCounts) {
        for (const profileEliminationCount of getPossibleEliminationCounts(profile)) {
          const nextEliminationCount = currentEliminationCount + profileEliminationCount;

          if (nextEliminationCount > maximumAcceptedEliminations) {
            continue;
          }

          nextEliminationsByParticipantCount[usedParticipantCount + participantCount]?.add(
            nextEliminationCount,
          );
        }
      }
    }

    eliminationsByParticipantCount = nextEliminationsByParticipantCount;
  }

  return eliminationsByParticipantCount.some(
    (eliminationCounts) =>
      eliminationCounts.has(fatalityDeficit) || eliminationCounts.has(fatalityDeficit + 1),
  );
}

export function canCompleteBloodbathFatalityTargetAfterProfile({
  profile,
  remainingProfiles,
  availableParticipantCount,
  fatalityDeficit,
}: {
  profile: BloodbathFatalSelectionProfile;
  remainingProfiles: readonly BloodbathFatalSelectionProfile[];
  availableParticipantCount: number;
  fatalityDeficit: number;
}): boolean {
  const participantCount = getEventParticipantCount(profile.definition);

  if (participantCount > availableParticipantCount) {
    return false;
  }

  const remainingParticipantCount = availableParticipantCount - participantCount;

  return getPossibleEliminationCounts(profile).every((profileEliminationCount) => {
    if (profileEliminationCount > fatalityDeficit + 1) {
      return false;
    }

    const remainingFatalityDeficit = fatalityDeficit - profileEliminationCount;

    if (remainingFatalityDeficit <= 0) {
      return true;
    }

    return canReachBloodbathFatalityTarget({
      profiles: remainingProfiles,
      availableParticipantCount: remainingParticipantCount,
      fatalityDeficit: remainingFatalityDeficit,
    });
  });
}
