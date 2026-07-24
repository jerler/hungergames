import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import { createFatalChanges } from "~/game/events/event-change-builders";
import type {
  GameChange,
  GameTribute,
  ResolvedEvent,
  RoundReference,
  StatusEffect,
} from "~/game/types/game-state";

/**
 * Creates the player-facing event produced when an untreated
 * fatal status reaches the end of its duration.
 *
 * Status-resolution events are derived from active game state.
 * They are not selected from the weighted EVENT_CATALOGUE.
 */
export function createFatalStatusResolutionEvent(
  tribute: GameTribute,
  status: StatusEffect,
  round: RoundReference,
): ResolvedEvent {
  const definition = getStatusDefinition(status.definitionId);

  const fatalCauseLabel = definition.fatalCauseLabel;
  const fatalSummary = definition.fatalSummary;

  if (
    definition.duration.kind !== "timed" ||
    definition.duration.expiration !== "fatal" ||
    !fatalCauseLabel ||
    !fatalSummary
  ) {
    throw new Error(
      `Nonfatal status "${definition.id}" ` + "cannot create a fatal resolution event.",
    );
  }

  const text = `${tribute.snapshot.name} ` + fatalSummary;
  const eventId =
    `status-fatality:${round.day}:` + `${round.period}:` + `${tribute.id}:` + status.id;
  /*
   * Death resolves every remaining status on the tribute.
   * These removals must occur after the elimination change
   * so the event retains the fatal status as its cause.
   */
  const removeStatusChanges: GameChange[] = tribute.statuses.map((activeStatus) => ({
    type: "remove-status",
    tributeId: tribute.id,
    statusId: activeStatus.id,
  }));

  return {
    id: eventId,
    definitionId: `status-fatality:${definition.id}`,
    kind: "status-resolution",
    resolutionMode: "standard",
    round: { ...round },
    participantTributeIds: [tribute.id],
    text,
    changes: [
      ...createFatalChanges(tribute, `status:${definition.id}`, fatalCauseLabel, text),
      ...removeStatusChanges,
    ],
  };
}
