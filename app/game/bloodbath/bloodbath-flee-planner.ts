import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
import {
  getEventParticipantCount,
  getEventParticipantShapeMultiplier,
} from "~/game/events/event-participant-shape";

export function getBloodbathFleeDefinitionWeight(
  definition: EventDefinition,
  context: EventSelectionContext,
): number {
  return (
    getEventDefinitionWeight(definition, context) *
    getEventParticipantShapeMultiplier("bloodbath-flee", definition)
  );
}

export function canCoverBloodbathFleeParticipants({
  definitions,
  participantCount,
}: {
  definitions: readonly EventDefinition[];
  participantCount: number;
}): boolean {
  if (!Number.isInteger(participantCount) || participantCount < 0) {
    throw new Error("Bloodbath flee participant count must be a non-negative integer.");
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

export function canCoverBloodbathFleeParticipantsAfterDefinition({
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

  return canCoverBloodbathFleeParticipants({
    definitions: remainingDefinitions,
    participantCount: availableParticipantCount - selectedParticipantCount,
  });
}
