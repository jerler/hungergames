import {
  EVENT_PARTICIPANT_SHAPES,
  type EventDefinition,
  type EventParticipantShape,
} from "~/game/events/event-schema";

export { EVENT_PARTICIPANT_SHAPES };
export type { EventParticipantShape };

export const EVENT_PARTICIPANT_SHAPE_WEIGHTING_SCOPES = [
  "bloodbath-cornucopia",
  "bloodbath-flee",
  "later-day",
  "night",
] as const;

export type EventParticipantShapeWeightingScope =
  (typeof EVENT_PARTICIPANT_SHAPE_WEIGHTING_SCOPES)[number];

export type EventParticipantShapeMultipliers = Readonly<Record<EventParticipantShape, number>>;

/**
 * Central balance configuration for future participant-shape weighting.
 *
 * Phase 2 only defines and tests these values. Selectors begin consuming
 * them in the later Bloodbath and ordinary-Day selection phases.
 */
export const EVENT_PARTICIPANT_SHAPE_MULTIPLIERS = {
  "bloodbath-cornucopia": {
    solo: 0.2,
    pair: 1,
    trio: 1,
    "group-four-plus": 1,
  },
  "bloodbath-flee": {
    solo: 0.2,
    pair: 1,
    trio: 1,
    "group-four-plus": 1,
  },
  "later-day": {
    solo: 0.8,
    pair: 1.1,
    trio: 1.15,
    "group-four-plus": 1.15,
  },
  night: {
    solo: 1,
    pair: 1,
    trio: 1,
    "group-four-plus": 1,
  },
} as const satisfies Readonly<
  Record<EventParticipantShapeWeightingScope, EventParticipantShapeMultipliers>
>;

export function getParticipantShapeForCount(participantCount: number): EventParticipantShape {
  if (!Number.isInteger(participantCount) || participantCount <= 0) {
    throw new Error(
      `Participant count must be a positive integer; received ${String(participantCount)}.`,
    );
  }

  if (participantCount === 1) {
    return "solo";
  }

  if (participantCount === 2) {
    return "pair";
  }

  if (participantCount === 3) {
    return "trio";
  }

  return "group-four-plus";
}

export function getParticipantShapeForTributeIds(
  participantTributeIds: readonly string[],
): EventParticipantShape {
  return getParticipantShapeForCount(new Set(participantTributeIds).size);
}

export function getEventParticipantCount(definition: EventDefinition): number {
  return definition.roles.reduce((total, role) => total + role.count, 0);
}

export function getEventParticipantShape(definition: EventDefinition): EventParticipantShape {
  return (
    definition.participantShape ?? getParticipantShapeForCount(getEventParticipantCount(definition))
  );
}

export function getParticipantShapeMultiplier(
  scope: EventParticipantShapeWeightingScope,
  shape: EventParticipantShape,
): number {
  return EVENT_PARTICIPANT_SHAPE_MULTIPLIERS[scope][shape];
}

export function getEventParticipantShapeMultiplier(
  scope: EventParticipantShapeWeightingScope,
  definition: EventDefinition,
): number {
  return getParticipantShapeMultiplier(scope, getEventParticipantShape(definition));
}
