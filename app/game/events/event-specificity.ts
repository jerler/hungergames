// Phase 2: event specificity weighting.
import type { EventDefinition, EventSpecificityReason } from "~/game/events/event-schema";

export const MAX_EVENT_SPECIFICITY_MULTIPLIER = 4;
export const EVENT_SPECIFICITY_MULTIPLIER_PER_POINT = 0.5;

export interface EventSpecificityBreakdown {
  score: number;
  multiplier: number;
  source: "authored" | "structural" | "none";
  reasons: readonly EventSpecificityReason[];
}

function hasRequiredItemRole(definition: EventDefinition): boolean {
  return definition.roles.some(
    (role) =>
      (role.requiredItemDefinitionIds?.length ?? 0) > 0 || (role.requiredItemTags?.length ?? 0) > 0,
  );
}

function getStructuralSpecificity(
  definition: EventDefinition,
): Pick<EventSpecificityBreakdown, "score" | "reasons"> {
  let score = 0;
  const reasons = new Set<EventSpecificityReason>();

  if (definition.isEligible) {
    score += 0.5;
    reasons.add("custom-eligibility");
  }

  if (definition.roles.some((role) => role.isEligible)) {
    score += 0.5;
    reasons.add("custom-eligibility");
  }

  if (hasRequiredItemRole(definition)) {
    score += 2;
    reasons.add("item-requirement");
  }

  if (definition.roles.some((role) => (role.opposesRoleIds?.length ?? 0) > 0)) {
    score += 0.5;
    reasons.add("custom-eligibility");
  }

  return {
    score,
    reasons: [...reasons],
  };
}

export function getEventSpecificityMultiplier(specificityScore: number): number {
  if (!Number.isFinite(specificityScore) || specificityScore <= 0) {
    return 1;
  }

  return Math.min(
    MAX_EVENT_SPECIFICITY_MULTIPLIER,
    1 + specificityScore * EVENT_SPECIFICITY_MULTIPLIER_PER_POINT,
  );
}

export function getEventSpecificityBreakdown(
  definition: EventDefinition,
): EventSpecificityBreakdown {
  if (definition.selectionProfile) {
    const score = definition.selectionProfile.specificityScore;

    return {
      score,
      multiplier: getEventSpecificityMultiplier(score),
      source: "authored",
      reasons: [...definition.selectionProfile.specificityReasons],
    };
  }

  const structural = getStructuralSpecificity(definition);

  if (structural.score <= 0) {
    return {
      score: 0,
      multiplier: 1,
      source: "none",
      reasons: [],
    };
  }

  return {
    ...structural,
    multiplier: getEventSpecificityMultiplier(structural.score),
    source: "structural",
  };
}

export function getEventDefinitionSpecificityScore(definition: EventDefinition): number {
  return getEventSpecificityBreakdown(definition).score;
}

export function getEventDefinitionSpecificityMultiplier(definition: EventDefinition): number {
  return getEventSpecificityBreakdown(definition).multiplier;
}
