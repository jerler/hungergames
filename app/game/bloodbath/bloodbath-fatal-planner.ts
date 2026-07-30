import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
import { getBloodbathFatalTuningMultiplier } from "./bloodbath-cornucopia-balance";
import {
  getEventParticipantCount,
  getEventParticipantShapeMultiplier,
} from "~/game/events/event-participant-shape";

export interface BloodbathFatalSelectionProfile {
  definition: EventDefinition;
  minImmediateEliminations: number;
  maxImmediateEliminations: number;
  selectionWeightMultiplier?: number;
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
  const tuningMultiplier =
    profile.selectionWeightMultiplier === undefined
      ? getBloodbathFatalTuningMultiplier(profile)
      : 1;

  return (
    getEventDefinitionWeight(profile.definition, context) *
    getEventParticipantShapeMultiplier("bloodbath-cornucopia", profile.definition) *
    tuningMultiplier *
    (profile.selectionWeightMultiplier ?? 1)
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

export function getBestEffortBloodbathFatalProfiles(
  profiles: readonly BloodbathFatalSelectionProfile[],
): BloodbathFatalSelectionProfile[] {
  if (profiles.length === 0) {
    return [];
  }

  const survivorCost = (profile: BloodbathFatalSelectionProfile): number =>
    getEventParticipantCount(profile.definition) - profile.minImmediateEliminations;

  const minimumSurvivorCost = Math.min(...profiles.map(survivorCost));
  const mostParticipantEfficientProfiles = profiles.filter(
    (profile) => survivorCost(profile) === minimumSurvivorCost,
  );
  const maximumGuaranteedEliminations = Math.max(
    ...mostParticipantEfficientProfiles.map((profile) => profile.minImmediateEliminations),
  );

  return mostParticipantEfficientProfiles.filter(
    (profile) => profile.minImmediateEliminations === maximumGuaranteedEliminations,
  );
}

export function getMaximumReachablePostTargetReservation({
  profiles,
  totalParticipantCount,
  fatalityDeficit,
  requestedReservation,
}: {
  profiles: readonly BloodbathFatalSelectionProfile[];
  totalParticipantCount: number;
  fatalityDeficit: number;
  requestedReservation: number;
}): number {
  for (const [label, value] of [
    ["Total fatal participant count", totalParticipantCount],
    ["Bloodbath fatality deficit", fatalityDeficit],
    ["Requested post-target reservation", requestedReservation],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative integer.`);
    }
  }

  const guaranteedProfiles = profiles.map((profile) => ({
    ...profile,
    maxImmediateEliminations: profile.minImmediateEliminations,
  }));
  const maximumReservation = Math.min(requestedReservation, totalParticipantCount);

  for (let reservation = maximumReservation; reservation >= 0; reservation -= 1) {
    if (
      canReachBloodbathFatalityTarget({
        profiles: guaranteedProfiles,
        availableParticipantCount: totalParticipantCount - reservation,
        fatalityDeficit,
      })
    ) {
      return reservation;
    }
  }

  return 0;
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
