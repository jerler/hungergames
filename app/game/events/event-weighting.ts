import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { getEventCategoryMultiplier } from "~/game/engine/stat-formulas";

export function getEventDefinitionWeight(
  definition: EventDefinition,
  context: EventSelectionContext,
): number {
  const categoryMultiplier = getEventCategoryMultiplier(
    definition.category,
    context.livingTributes.length,
  );

  const definitionMultiplier = definition.getWeightMultiplier?.(context) ?? 1;

  return Math.max(0, definition.baseWeight * categoryMultiplier * definitionMultiplier);
}
