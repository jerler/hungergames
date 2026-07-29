import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createNightRestChanges } from "~/game/events/event-change-builders";
import { validateEventResolution } from "~/game/events/validation/validate-event-resolution";
import type {
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";

import type { NightRestQuality } from "./survival-schema";

export const NIGHT_REST_FALLBACK_DEFINITION_ID = "night-rest-fallback";
export const PREPARED_CAVE_SHELTER_DEFINITION_ID = "day-discovering-cave-shelter";
export const PREPARED_CAVE_NIGHT_DEFINITION_ID = "night-prepared-cave-shelter";

function isSameRound(first: RoundReference, second: RoundReference): boolean {
  return first.day === second.day && first.period === second.period;
}

function getEliminatedTributeIds(events: readonly ResolvedEvent[]): ReadonlySet<string> {
  return new Set(
    events.flatMap((event) =>
      event.changes.flatMap((change) =>
        change.type === "eliminate-tribute" ? [change.tributeId] : [],
      ),
    ),
  );
}

function hasPreparedCaveShelter(
  state: GameState,
  round: RoundReference,
  tributeId: string,
): boolean {
  if (round.period !== "night") {
    return false;
  }

  return [...state.eventHistory, ...state.roundEvents].some(
    (event) =>
      event.definitionId === PREPARED_CAVE_SHELTER_DEFINITION_ID &&
      event.round.period === "day" &&
      event.round.day === round.day &&
      event.participantTributeIds.includes(tributeId),
  );
}

function getPreparedCaveText(tribute: GameTribute): string {
  return (
    `${tribute.snapshot.name} returns to the prepared cave ` +
    "and remains sheltered through the night."
  );
}

function applyPreparedCaveShelter(
  state: GameState,
  round: RoundReference,
  event: ResolvedEvent,
): ResolvedEvent {
  const upgradedTributeIds = new Set<string>();

  const changes = event.changes.map((change) => {
    if (
      change.type !== "record-night-rest" ||
      change.quality !== "unsheltered" ||
      !hasPreparedCaveShelter(state, round, change.tributeId)
    ) {
      return change;
    }

    upgradedTributeIds.add(change.tributeId);

    return {
      ...change,
      quality: "sheltered" as const,
    };
  });

  const caveText = [...upgradedTributeIds].flatMap((tributeId) => {
    const tribute = state.tributes.find((candidate) => candidate.id === tributeId);

    return tribute ? [getPreparedCaveText(tribute)] : [];
  });

  return {
    ...event,
    participantTributeIds: [...event.participantTributeIds],
    text: caveText.length > 0 ? `${event.text} ${caveText.join(" ")}` : event.text,
    changes,
  };
}

function countRestOutcomes(events: readonly ResolvedEvent[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const event of events) {
    for (const change of event.changes) {
      if (change.type !== "record-night-rest") {
        continue;
      }

      counts.set(change.tributeId, (counts.get(change.tributeId) ?? 0) + 1);
    }
  }

  return counts;
}

function getParticipantEventIndexes(events: readonly ResolvedEvent[], tributeId: string): number[] {
  return events.flatMap((event, index) =>
    event.participantTributeIds.includes(tributeId) ? [index] : [],
  );
}

function validateResolvedEvent(event: ResolvedEvent): void {
  validateEventResolution({
    eventId: event.id,
    definitionId: event.definitionId,
    round: event.round,

    resolution: {
      text: event.text,
      changes: event.changes,
    },
  });
}

function createPreparedCaveEvent(
  round: RoundReference,
  eventIndex: number,
  tribute: GameTribute,
): ResolvedEvent {
  const [restChange] = createNightRestChanges([tribute], round, "sheltered");

  if (!restChange) {
    throw new Error(`Could not create prepared-cave rest for "${tribute.id}".`);
  }

  const event: ResolvedEvent = {
    id: [round.period, round.day, eventIndex, PREPARED_CAVE_NIGHT_DEFINITION_ID].join("-"),
    definitionId: PREPARED_CAVE_NIGHT_DEFINITION_ID,

    kind: "primary",
    resolutionMode: "standard",

    round: {
      ...round,
    },

    participantTributeIds: [tribute.id],

    text: getPreparedCaveText(tribute),

    changes: [
      restChange,
      {
        type: "increment-statistic",
        tributeId: tribute.id,
        statistic: "eventsSurvived",
        amount: 1,
      },
    ],
  };

  validateResolvedEvent(event);

  return event;
}

/**
 * Completes authored night-event presentation.
 *
 * Explicit rest outcomes remain authoritative. A prepared cave may
 * upgrade an authored unsheltered outcome or create one visible payoff
 * event when its tribute otherwise received no event.
 *
 * Ordinary missing rest outcomes are intentionally not converted into
 * visible arena events. They are applied later by
 * applyMissingNightRestBookkeeping() when the round completes.
 */
export function completeNightRestCoverage(
  state: GameState,
  round: RoundReference,
  events: readonly ResolvedEvent[],
): ResolvedEvent[] {
  if (round.period !== "night") {
    return [...events];
  }

  const completedEvents = events.map((event) => applyPreparedCaveShelter(state, round, event));

  const eliminatedTributeIds = getEliminatedTributeIds(completedEvents);
  const restCounts = countRestOutcomes(completedEvents);

  for (const [tributeId, count] of restCounts) {
    if (count > 1) {
      throw new Error(
        `Tribute "${tributeId}" receives ${count} ` + "night-rest outcomes in one round.",
      );
    }
  }

  for (const tribute of state.tributes.filter((candidate) => candidate.isAlive)) {
    if ((restCounts.get(tribute.id) ?? 0) === 1) {
      continue;
    }

    if (eliminatedTributeIds.has(tribute.id)) {
      continue;
    }

    const participantEventIndexes = getParticipantEventIndexes(completedEvents, tribute.id);

    if (participantEventIndexes.length > 1) {
      throw new Error(
        `Tribute "${tribute.id}" appears in more than one ` +
          "primary event during the same night.",
      );
    }

    if (!hasPreparedCaveShelter(state, round, tribute.id)) {
      continue;
    }

    const [restChange] = createNightRestChanges([tribute], round, "sheltered");

    if (!restChange) {
      throw new Error(`Could not create prepared-cave rest for "${tribute.id}".`);
    }

    const participantEventIndex = participantEventIndexes[0];

    if (participantEventIndex === undefined) {
      completedEvents.push(createPreparedCaveEvent(round, completedEvents.length, tribute));
      restCounts.set(tribute.id, 1);
      continue;
    }

    const event = completedEvents[participantEventIndex];

    if (!event) {
      throw new Error(`Could not recover the primary event for "${tribute.id}".`);
    }

    const completedEvent: ResolvedEvent = {
      ...event,
      text: `${event.text} ${getPreparedCaveText(tribute)}`,
      changes: [...event.changes, restChange],
    };

    validateResolvedEvent(completedEvent);

    completedEvents[participantEventIndex] = completedEvent;
    restCounts.set(tribute.id, 1);
  }

  return completedEvents;
}

function hasRecordedRestForRound(
  state: GameState,
  round: RoundReference,
  tributeId: string,
): boolean {
  return state.eventHistory.some(
    (event) =>
      isSameRound(event.round, round) &&
      event.changes.some(
        (change) =>
          change.type === "record-night-rest" &&
          change.tributeId === tributeId &&
          isSameRound(change.round, round),
      ),
  );
}

function createNightRestBookkeepingEvent(
  state: GameState,
  round: RoundReference,
  eventIndex: number,
  tribute: GameTribute,
): ResolvedEvent {
  const quality: NightRestQuality = hasPreparedCaveShelter(state, round, tribute.id)
    ? "sheltered"
    : "unsheltered";

  const [restChange] = createNightRestChanges([tribute], round, quality);

  if (!restChange) {
    throw new Error(`Could not create night-rest bookkeeping for "${tribute.id}".`);
  }

  const event: ResolvedEvent = {
    id: [round.period, round.day, "bookkeeping", eventIndex, tribute.id].join("-"),
    definitionId: NIGHT_REST_FALLBACK_DEFINITION_ID,

    kind: "preparation",
    resolutionMode: "standard",

    round: {
      ...round,
    },

    participantTributeIds: [tribute.id],

    /*
     * Preparation events require valid text for event-history integrity,
     * but the arena feed filters them from player-facing presentation.
     */
    text: `Automatic night-rest bookkeeping for ${tribute.snapshot.name}.`,

    changes: [restChange],

    preparation: {
      mechanic: "night-rest-preparation",
      actingTributeId: tribute.id,
      restQuality: quality,
    },
  };

  validateResolvedEvent(event);

  return event;
}

/**
 * Applies missing night-rest records after every authored event has
 * already been revealed.
 *
 * The generated preparation events are applied directly to tribute
 * state and event history. They never enter roundEvents, so players
 * neither click through nor see generic fallback cards. They exist only
 * to preserve the morning exhaustion/well-rested lifecycle.
 */
export function applyMissingNightRestBookkeeping(state: GameState): GameState {
  const round = state.currentRound;

  if (!round || round.period !== "night") {
    return state;
  }

  const bookkeepingEvents = state.tributes
    .filter((tribute) => tribute.isAlive && !hasRecordedRestForRound(state, round, tribute.id))
    .map((tribute, eventIndex) =>
      createNightRestBookkeepingEvent(state, round, eventIndex, tribute),
    );

  if (bookkeepingEvents.length === 0) {
    return state;
  }

  return bookkeepingEvents.reduce(
    (nextState, event) => applyResolvedEvent(nextState, event),
    state,
  );
}
