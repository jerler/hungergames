/**
 * Event type system and contracts.
 *
 * This file defines the structure shared by every game event:
 * participant roles, eligibility, weighting, resolution context,
 * and the explicit changes an event may produce.
 *
 * It does not contain playable event content. Playable event
 * definitions live under `events/catalogue`, grouped by their
 * primary eligibility and ownership rules.
 */

import type { RandomSource } from "~/game/engine/random";
import type { GameChange, GameState, GameTribute, RoundReference } from "~/game/types/game-state";
import type { ItemDefinitionId, ItemTag } from "~/game/items/item-schema";

export type EventCategory = "fatal" | "survival" | "hazard";

export type EventTag =
  | "fatal"
  | "survival"
  | "hazard"
  | "combat"
  | "environment"
  | "weapon"
  | "tool"
  | "item"
  | "status"
  | "resource"
  | "truce"
  | "cooperative"
  | "romantic"
  | "victory";

export interface EventSelectionContext {
  state: GameState;
  round: RoundReference;
  livingTributes: readonly GameTribute[];
}

export type ParticipantsByRole = Readonly<Record<string, readonly GameTribute[]>>;

export interface ParticipantSelectionContext extends EventSelectionContext {
  /**
   * Participants already selected for
   * earlier roles and earlier positions
   * within the current role.
   */
  participantsByRole: ParticipantsByRole;
}

export interface ParticipantRoleDefinition {
  id: string;
  count: number;

  isEligible?: (tribute: GameTribute, context: ParticipantSelectionContext) => boolean;

  getWeight?: (tribute: GameTribute, context: ParticipantSelectionContext) => number;

  requiredItemTags?: readonly ItemTag[];

  requiredItemDefinitionIds?: readonly ItemDefinitionId[];

  opposesRoleIds?: readonly string[];
}

export interface EventResolutionContext extends EventSelectionContext {
  eventId: string;
  random: RandomSource;
  participantsByRole: ParticipantsByRole;
}

export interface EventResolution {
  text: string;
  changes: GameChange[];
}

export interface EventDefinition {
  id: string;
  category: EventCategory;
  periods: readonly RoundReference["period"][];
  baseWeight: number;
  tags: readonly EventTag[];

  roles: readonly ParticipantRoleDefinition[];

  isEligible?: (context: EventSelectionContext) => boolean;

  getWeightMultiplier?: (context: EventSelectionContext) => number;

  resolve: (context: EventResolutionContext) => EventResolution;
}

export function requireSingleParticipant(
  participantsByRole: ParticipantsByRole,
  roleId: string,
): GameTribute {
  const participant = participantsByRole[roleId]?.[0];

  if (!participant) {
    throw new Error(`Event resolution is missing participant role "${roleId}".`);
  }

  return participant;
}

export function requireParticipants(
  participantsByRole: ParticipantsByRole,
  roleId: string,
): readonly GameTribute[] {
  const participants = participantsByRole[roleId];

  if (!participants) {
    throw new Error(`Event resolution is missing participant role "${roleId}".`);
  }

  return participants;
}
