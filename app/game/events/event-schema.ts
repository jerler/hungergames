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
import type {
  EventResolutionMode,
  GameChange,
  GameState,
  GameTribute,
  InventoryItem,
  RoundReference,
} from "~/game/types/game-state";
import type { ItemDefinitionId, ItemTag } from "~/game/items/item-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { SurvivalNeed } from "~/game/survival/survival-schema";

export type EventCategory = "fatal" | "survival" | "hazard";

export const EVENT_PARTICIPANT_SHAPES = ["solo", "pair", "trio", "group-four-plus"] as const;

export type EventParticipantShape = (typeof EVENT_PARTICIPANT_SHAPES)[number];

export type EventSafetyResolution = "force-success";

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
  | "deprivation"
  | "resource"
  | "truce"
  | "cooperative"
  | "romantic"
  | "ambush"
  | "victory";

export type EventSpecificityReason =
  | "stat-requirement"
  | "status-requirement"
  | "deprivation-requirement"
  | "truce-requirement"
  | "item-requirement"
  | "custom-eligibility";

export interface EventSelectionProfile {
  /**
   * Additive authored specificity points.
   *
   * The engine converts these points into a capped weighting multiplier.
   */
  specificityScore: number;

  /**
   * Human-readable categories retained for tests and future balance reports.
   */
  specificityReasons: readonly EventSpecificityReason[];
}

export type EventRecoveryTarget =
  | {
      kind: "status";
      roleId: string;
      statusIds: readonly StatusEffectId[];
    }
  | {
      kind: "survival-need";
      roleId: string;
      need: SurvivalNeed;
    };

export interface EventRecoveryProfile {
  targets: readonly EventRecoveryTarget[];
}

export interface EventSelectionContext {
  state: GameState;
  round: RoundReference;
  livingTributes: readonly GameTribute[];
}

export type ParticipantsByRole = Readonly<Record<string, readonly GameTribute[]>>;
export interface EventItemSelection {
  userTributeId: string;
  owner: GameTribute;
  item: InventoryItem;
}

export type EventItemsByRole = Readonly<Record<string, readonly EventItemSelection[]>>;
export interface ParticipantSelectionContext extends EventSelectionContext {
  /**
   * Participants already selected for
   * earlier roles and earlier positions
   * within the current role.
   */
  participantsByRole: ParticipantsByRole;
}

export type ParticipantTargeting = "neutral" | "hostile";

export interface ParticipantRoleDefinition {
  id: string;
  count: number;

  /**
   * Describes whether selection represents an
   * ordinary hostile attempt to target this tribute.
   *
   * Undefined is treated as neutral.
   */
  targeting?: ParticipantTargeting;

  isEligible?: (tribute: GameTribute, context: ParticipantSelectionContext) => boolean;

  getWeight?: (tribute: GameTribute, context: ParticipantSelectionContext) => number;

  requiredItemTags?: readonly ItemTag[];

  requiredItemDefinitionIds?: readonly ItemDefinitionId[];

  /**
   * Controls where a required item may come from.
   *
   * - "accessible": the tribute or an active truce partner
   * - "owned": only the tribute's personal inventory
   *
   * Defaults to "accessible" for backward compatibility.
   */
  itemAccess?: "accessible" | "owned";

  /**
   * Whether a required item must be usable by
   * the acting tribute.
   *
   * Defaults to true.
   */
  requiredItemRequireUsable?: boolean;

  /**
   * Evaluates a required item's stat requirements using
   * the first participant selected for an earlier role.
   *
   * The current role still controls the item's owner,
   * access rules, and reservation.
   */
  requiredItemUsableByRoleId?: string;

  /**
   * Optionally selects and reserves an item for this role.
   *
   * Unlike required-item fields, the participant remains eligible
   * when no matching item is available.
   */
  optionalItemTags?: readonly ItemTag[];

  optionalItemDefinitionIds?: readonly ItemDefinitionId[];

  /**
   * Controls where an optional item may come from.
   *
   * Defaults to "accessible".
   */
  optionalItemAccess?: "accessible" | "owned";

  opposesRoleIds?: readonly string[];
}

export interface EventResolutionContext extends EventSelectionContext {
  eventId: string;
  random: RandomSource;
  participantsByRole: ParticipantsByRole;

  /**
   * Identifies whether the event is resolving normally
   * or as the engine's forced-progress fallback.
   *
   * Optional so direct event unit tests remain backward
   * compatible. Omitted is treated as standard.
   */
  resolutionMode?: EventResolutionMode;

  /**
   * Required items reserved during participant
   * selection, aligned with each role's participants.
   *
   * Optional so individual event unit tests may
   * still resolve definitions directly.
   */
  itemsByRole?: EventItemsByRole;

  /**
   * Items already claimed by earlier events in
   * this round. Opportunistic item lookups must
   * exclude these instances.
   */
  unavailableItemInstanceIds?: ReadonlySet<string>;
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

  /**
   * Describes why an event is unusually narrow once its prerequisites exist.
   *
   * Authored events receive this automatically from declarative requirements.
   * Direct definitions may provide it explicitly.
   */
  selectionProfile?: EventSelectionProfile;

  /**
   * Active problems this event can attempt to fix.
   */
  recoveryProfile?: EventRecoveryProfile;

  /**
   * Declares how this definition behaves when selected
   * as the forced-progress safety event.
   *
   * Only direct checked attacks use this in Phase 10.
   */
  safetyResolution?: EventSafetyResolution;

  /**
   * Optional authored override for participant-shape classification.
   *
   * Most definitions infer their shape by summing role counts. Use this only
   * when those technical roles do not represent the event's meaningful cast.
   */
  participantShape?: EventParticipantShape;

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
