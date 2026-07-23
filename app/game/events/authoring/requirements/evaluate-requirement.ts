import type { ParticipantSelectionContext } from "~/game/events/event-schema";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import { getActiveTruceForTribute } from "~/game/truces/truce-engine";
import type { GameTribute } from "~/game/types/game-state";

import type {
  AuthoredRequirement,
  HasAnyHarmfulStatusRequirement,
  HasStatusRequirement,
  InActiveTruceRequirement,
  LacksStatusRequirement,
  MaximumStatRequirement,
  MinimumStatRequirement,
  NotInSameTruceRequirement,
} from "./requirement-schema";

export type CandidateRequirement =
  | HasStatusRequirement
  | LacksStatusRequirement
  | HasAnyHarmfulStatusRequirement
  | MinimumStatRequirement
  | MaximumStatRequirement
  | InActiveTruceRequirement;

export function isCandidateRequirement(
  requirement: AuthoredRequirement,
): requirement is CandidateRequirement {
  switch (requirement.kind) {
    case "has-status":
    case "lacks-status":
    case "has-any-harmful-status":
    case "minimum-stat":
    case "maximum-stat":
    case "in-active-truce":
      return true;

    case "not-in-same-truce":
    case "has-item":
    case "has-item-tag":
    case "has-treatment-for":
      return false;
  }
}

export function isRelationshipOppositionRequirement(
  requirement: AuthoredRequirement,
): requirement is NotInSameTruceRequirement {
  return requirement.kind === "not-in-same-truce";
}

/**
 * Evaluates a requirement that can be checked against
 * one candidate while the existing participant selector
 * fills a role.
 */
export function evaluateCandidateRequirement(
  requirement: CandidateRequirement,
  tribute: GameTribute,
  context: ParticipantSelectionContext,
): boolean {
  switch (requirement.kind) {
    case "has-status":
      return tribute.statuses.some((status) => status.definitionId === requirement.statusId);

    case "lacks-status":
      return tribute.statuses.every((status) => status.definitionId !== requirement.statusId);

    case "has-any-harmful-status":
      return tribute.statuses.some(
        (status) => getStatusDefinition(status.definitionId).kind === "harmful",
      );

    case "minimum-stat":
      return tribute.snapshot.stats[requirement.stat] >= requirement.value;

    case "maximum-stat":
      return tribute.snapshot.stats[requirement.stat] <= requirement.value;

    case "in-active-truce":
      return getActiveTruceForTribute(context.state, tribute.id) !== null;
  }
}
