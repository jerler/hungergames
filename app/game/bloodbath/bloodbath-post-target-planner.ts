import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import {
  getEventParticipantCount,
  getEventParticipantShape,
  getEventParticipantShapeMultiplier,
} from "~/game/events/event-participant-shape";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";

export const BLOODBATH_POST_TARGET_SOLO_CEILING = 0.3;
export const BLOODBATH_POST_TARGET_SOLO_CEILING_WEIGHT_MULTIPLIER = 0.25;

export const HALF_GAME_MINIMUM_BLOODBATH_FATALITIES = 5;
export const FULL_GAME_MINIMUM_BLOODBATH_FATALITIES = 10;

export function getBloodbathFatalityTargetForPostTargetReservation({
  fatalityTarget,
  startingTributeCount,
  requestedPostTargetCount,
}: {
  fatalityTarget: number;
  startingTributeCount: number;
  requestedPostTargetCount: number;
}): number {
  for (const [label, value] of [
    ["Bloodbath fatality target", fatalityTarget],
    ["Starting tribute count", startingTributeCount],
    ["Requested post-target participant count", requestedPostTargetCount],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative integer.`);
    }
  }

  if (requestedPostTargetCount < 3) {
    return fatalityTarget;
  }

  const minimumFatalityFloor =
    startingTributeCount > 12
      ? FULL_GAME_MINIMUM_BLOODBATH_FATALITIES
      : HALF_GAME_MINIMUM_BLOODBATH_FATALITIES;

  return Math.min(fatalityTarget, minimumFatalityFloor);
}

export interface BloodbathPostTargetWeightContext {
  selectedEventCount: number;
  selectedSoloEventCount: number;
  hasNonSoloCandidate: boolean;
}

function assertSelectionCounts({
  selectedEventCount,
  selectedSoloEventCount,
}: BloodbathPostTargetWeightContext): void {
  if (
    !Number.isInteger(selectedEventCount) ||
    selectedEventCount < 0 ||
    !Number.isInteger(selectedSoloEventCount) ||
    selectedSoloEventCount < 0 ||
    selectedSoloEventCount > selectedEventCount
  ) {
    throw new Error("Bloodbath post-target selection counts are invalid.");
  }
}

export function wouldExceedBloodbathPostTargetSoloCeiling({
  selectedEventCount,
  selectedSoloEventCount,
}: Pick<
  BloodbathPostTargetWeightContext,
  "selectedEventCount" | "selectedSoloEventCount"
>): boolean {
  if (
    !Number.isInteger(selectedEventCount) ||
    selectedEventCount < 0 ||
    !Number.isInteger(selectedSoloEventCount) ||
    selectedSoloEventCount < 0 ||
    selectedSoloEventCount > selectedEventCount
  ) {
    throw new Error("Bloodbath post-target selection counts are invalid.");
  }

  return (
    (selectedSoloEventCount + 1) / (selectedEventCount + 1) > BLOODBATH_POST_TARGET_SOLO_CEILING
  );
}

export function getBloodbathPostTargetDefinitionWeight(
  definition: EventDefinition,
  context: EventSelectionContext,
  weightContext: BloodbathPostTargetWeightContext,
): number {
  assertSelectionCounts(weightContext);

  const shape = getEventParticipantShape(definition);
  const ceilingMultiplier =
    shape === "solo" &&
    weightContext.hasNonSoloCandidate &&
    wouldExceedBloodbathPostTargetSoloCeiling(weightContext)
      ? BLOODBATH_POST_TARGET_SOLO_CEILING_WEIGHT_MULTIPLIER
      : 1;

  return (
    getEventDefinitionWeight(definition, context) *
    getEventParticipantShapeMultiplier("bloodbath-cornucopia", definition) *
    ceilingMultiplier
  );
}

export function canCoverBloodbathPostTargetParticipants({
  definitions,
  participantCount,
}: {
  definitions: readonly EventDefinition[];
  participantCount: number;
}): boolean {
  if (!Number.isInteger(participantCount) || participantCount < 0) {
    throw new Error("Bloodbath post-target participant count must be a non-negative integer.");
  }

  if (participantCount === 0) {
    return true;
  }

  let reachableParticipantCounts = new Set<number>([0]);

  for (const definition of definitions) {
    const definitionParticipantCount = getEventParticipantCount(definition);
    const nextReachableParticipantCounts = new Set(reachableParticipantCounts);

    for (const reachableParticipantCount of reachableParticipantCounts) {
      const nextParticipantCount = reachableParticipantCount + definitionParticipantCount;

      if (nextParticipantCount <= participantCount) {
        nextReachableParticipantCounts.add(nextParticipantCount);
      }
    }

    reachableParticipantCounts = nextReachableParticipantCounts;

    if (reachableParticipantCounts.has(participantCount)) {
      return true;
    }
  }

  return false;
}

export function canCoverBloodbathPostTargetParticipantsAfterDefinition({
  definition,
  remainingDefinitions,
  availableParticipantCount,
}: {
  definition: EventDefinition;
  remainingDefinitions: readonly EventDefinition[];
  availableParticipantCount: number;
}): boolean {
  const selectedParticipantCount = getEventParticipantCount(definition);

  if (selectedParticipantCount > availableParticipantCount) {
    return false;
  }

  return canCoverBloodbathPostTargetParticipants({
    definitions: remainingDefinitions,
    participantCount: availableParticipantCount - selectedParticipantCount,
  });
}
