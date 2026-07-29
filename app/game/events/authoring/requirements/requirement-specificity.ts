// Phase 2: authored requirement specificity scoring.
import type { EventSelectionProfile, EventSpecificityReason } from "~/game/events/event-schema";

import type { AuthoredRequirement } from "./requirement-schema";

interface RequirementSpecificity {
  score: number;
  reasons: readonly EventSpecificityReason[];
}

function getRequirementSpecificity(requirement: AuthoredRequirement): RequirementSpecificity {
  switch (requirement.kind) {
    case "minimum-stat":
    case "maximum-stat":
      return {
        score: 1,
        reasons: ["stat-requirement"],
      };

    case "has-status":
      return {
        score: 2,
        reasons: ["status-requirement"],
      };

    case "lacks-status":
      return {
        score: 0.5,
        reasons: ["status-requirement"],
      };

    case "has-any-harmful-status":
      return {
        score: 1.5,
        reasons: ["status-requirement"],
      };

    case "deprivation-status-eligible":
      return {
        score: 2,
        reasons: ["deprivation-requirement"],
      };

    case "in-active-truce":
      return {
        score: 2,
        reasons: ["truce-requirement"],
      };

    case "not-in-same-truce":
      return {
        score: 0.5,
        reasons: ["truce-requirement"],
      };

    case "has-item":
      return {
        score: 2,
        reasons: ["item-requirement"],
      };

    case "has-item-tag":
      return {
        score: 1.5,
        reasons: ["item-requirement"],
      };

    case "has-treatment-for":
      return {
        score: 2.5,
        reasons: ["item-requirement", "status-requirement"],
      };
  }
}

export function createAuthoredEventSelectionProfile(
  requirements: readonly AuthoredRequirement[],
): EventSelectionProfile | undefined {
  if (requirements.length === 0) {
    return undefined;
  }

  const scoredRequirements = requirements.map(getRequirementSpecificity);

  const specificityScore = scoredRequirements.reduce(
    (total, requirement) => total + requirement.score,
    0,
  );

  if (specificityScore <= 0) {
    return undefined;
  }

  return {
    specificityScore,
    specificityReasons: [
      ...new Set(scoredRequirements.flatMap((requirement) => requirement.reasons)),
    ],
  };
}
