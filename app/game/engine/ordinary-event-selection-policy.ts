import { getEventParticipantShapeMultiplier } from "~/game/events/event-participant-shape";
import type { EventDefinition } from "~/game/events/event-schema";
import type { ParticipantSelection } from "~/game/events/participant-selection";
import type { RoundReference } from "~/game/types/game-state";

/**
 * Bloodbath selection is handled by its dedicated sequencer.
 *
 * Every ordinary daytime event is therefore a later-Day event and receives
 * the moderate shape preference. Night remains deliberately neutral.
 */
export function getOrdinaryEventParticipantShapeMultiplier(
  definition: EventDefinition,
  round: RoundReference,
): number {
  return getEventParticipantShapeMultiplier(
    round.period === "night" ? "night" : "later-day",
    definition,
  );
}

/**
 * Returns every tribute whose availability is committed by a feasibility
 * selection, including a hidden truce partner who owns a borrowed item.
 */
export function getSelectionReservedTributeIds(
  selection: ParticipantSelection,
): ReadonlySet<string> {
  return new Set([
    ...selection.participantTributeIds,
    ...Object.values(selection.itemsByRole)
      .flat()
      .map(({ owner }) => owner.id),
  ]);
}

/**
 * Large events may be selected only when they leave at least one available
 * tribute for every remaining ordinary event slot.
 *
 * The sequencer falls back to the complete feasible pool when no candidate can
 * satisfy this look-ahead, so low-population rounds and unavoidable group
 * events still resolve rather than deadlocking.
 */
export function canPreserveRemainingEventSlots({
  selection,
  availableTributeCount,
  remainingEventSlotCount,
}: {
  selection: ParticipantSelection;
  availableTributeCount: number;
  remainingEventSlotCount: number;
}): boolean {
  if (!Number.isInteger(availableTributeCount) || availableTributeCount < 0) {
    throw new Error("Available tribute count must be a non-negative integer.");
  }

  if (!Number.isInteger(remainingEventSlotCount) || remainingEventSlotCount < 0) {
    throw new Error("Remaining event-slot count must be a non-negative integer.");
  }

  return (
    availableTributeCount - getSelectionReservedTributeIds(selection).size >=
    remainingEventSlotCount
  );
}
