import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";

export function isEventDefinitionEligible(
  definition: EventDefinition,
  context: EventSelectionContext,
): boolean {
  if (!definition.periods.includes(context.round.period)) {
    return false;
  }

  const requiredParticipantCount = definition.roles.reduce((total, role) => total + role.count, 0);

  if (requiredParticipantCount > context.livingTributes.length) {
    return false;
  }

  return definition.isEligible ? definition.isEligible(context) : true;
}
