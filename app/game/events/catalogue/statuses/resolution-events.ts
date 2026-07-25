import { createDelayedFatalChanges } from "~/game/events/event-change-builders";

import { getStatusDefinition } from "~/game/statuses/status-catalogue";

import type {
  GameChange,
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
  StatusEffect,
} from "~/game/types/game-state";

function getAttributedSource(state: GameState, status: StatusEffect): GameTribute | null {
  if (status.sourceTributeId === null) {
    return null;
  }

  const source = state.tributes.find((tribute) => tribute.id === status.sourceTributeId);

  if (!source) {
    throw new Error(
      `Status "${status.id}" references missing source tribute ` + `"${status.sourceTributeId}".`,
    );
  }

  return source;
}

function createFatalStatusText(
  tribute: GameTribute,
  status: StatusEffect,
  source: GameTribute | null,
): string {
  const definition = getStatusDefinition(status.definitionId);

  if (definition.id === "poisoned" && source) {
    return `${tribute.snapshot.name} succumbs to poison ` + `delivered by ${source.snapshot.name}.`;
  }

  const fatalSummary = definition.fatalSummary;

  if (!fatalSummary) {
    throw new Error(`Fatal status "${definition.id}" has no fatal summary.`);
  }

  return `${tribute.snapshot.name} ` + fatalSummary;
}

/**
 * Creates the player-facing event produced when an untreated
 * fatal status reaches the end of its duration.
 */
export function createFatalStatusResolutionEvent(
  state: GameState,
  tribute: GameTribute,
  status: StatusEffect,
  round: RoundReference,
): ResolvedEvent {
  const definition = getStatusDefinition(status.definitionId);

  const fatalCauseLabel = definition.fatalCauseLabel;

  if (
    definition.duration.kind !== "timed" ||
    definition.duration.expiration !== "fatal" ||
    !fatalCauseLabel ||
    !definition.fatalSummary
  ) {
    throw new Error(
      `Nonfatal status "${definition.id}" ` + "cannot create a fatal resolution event.",
    );
  }

  const source = getAttributedSource(state, status);

  const text = createFatalStatusText(tribute, status, source);

  const eventId =
    `status-fatality:${round.day}:` + `${round.period}:` + `${tribute.id}:` + status.id;

  /*
   * Death resolves every remaining status on the tribute.
   * These removals must occur after elimination.
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

    round: {
      ...round,
    },

    participantTributeIds: [tribute.id, ...(source ? [source.id] : [])],

    text,

    changes: [
      ...createDelayedFatalChanges(
        tribute,
        `status:${definition.id}`,
        fatalCauseLabel,
        text,
        source,
      ),

      ...removeStatusChanges,
    ],
  };
}
