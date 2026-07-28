import { createNightRestChanges } from "~/game/events/event-change-builders";
import { validateEventResolution } from "~/game/events/validation/validate-event-resolution";
import type { NightRestQuality } from "./survival-schema";
import type {
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";

export const NIGHT_REST_FALLBACK_DEFINITION_ID = "night-rest-fallback";
export const PREPARED_CAVE_SHELTER_DEFINITION_ID = "day-discovering-cave-shelter";

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

function getFallbackText(tribute: GameTribute, quality: NightRestQuality): string {
  if (quality === "sheltered") {
    return getPreparedCaveText(tribute);
  }

  return (
    `${tribute.snapshot.name} finds no time to secure shelter ` +
    "and remains exposed through the night."
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

/**
 * Completes night-rest coverage after ordinary primary events
 * have been selected.
 *
 * Explicit shelter outcomes remain authoritative. Every living
 * tribute who survives the planned night without an explicit
 * outcome receives exactly one visible unsheltered result.
 *
 * A tribute already participating in an event receives the
 * fallback on that same event, preserving the one-primary-event
 * slot. An otherwise unassigned tribute receives one standalone
 * visible fallback event.
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

  let fallbackIndex = 0;

  for (const tribute of state.tributes.filter((candidate) => candidate.isAlive)) {
    const existingRestCount = restCounts.get(tribute.id) ?? 0;

    if (existingRestCount === 1) {
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

    const restQuality: NightRestQuality = hasPreparedCaveShelter(state, round, tribute.id)
      ? "sheltered"
      : "unsheltered";
    const [restChange] = createNightRestChanges([tribute], round, restQuality);

    if (!restChange) {
      throw new Error(`Could not create a night-rest change for "${tribute.id}".`);
    }

    const fallbackText = getFallbackText(tribute, restQuality);
    const participantEventIndex = participantEventIndexes[0];

    if (participantEventIndex !== undefined) {
      const event = completedEvents[participantEventIndex];

      if (!event) {
        throw new Error(`Could not recover the primary event for "${tribute.id}".`);
      }

      const completedEvent: ResolvedEvent = {
        ...event,

        text: `${event.text} ${fallbackText}`,

        changes: [...event.changes, restChange],
      };

      validateResolvedEvent(completedEvent);

      completedEvents[participantEventIndex] = completedEvent;
      restCounts.set(tribute.id, 1);

      continue;
    }

    const eventId = [
      round.period,
      round.day,
      events.length + fallbackIndex,
      NIGHT_REST_FALLBACK_DEFINITION_ID,
    ].join("-");

    fallbackIndex += 1;

    const fallbackEvent: ResolvedEvent = {
      id: eventId,
      definitionId: NIGHT_REST_FALLBACK_DEFINITION_ID,

      kind: "primary",
      resolutionMode: "standard",

      round: {
        ...round,
      },

      participantTributeIds: [tribute.id],

      text: fallbackText,

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

    validateResolvedEvent(fallbackEvent);

    completedEvents.push(fallbackEvent);
    restCounts.set(tribute.id, 1);
  }

  for (const tribute of state.tributes.filter(
    (candidate) => candidate.isAlive && !eliminatedTributeIds.has(candidate.id),
  )) {
    const restCount = restCounts.get(tribute.id) ?? 0;

    if (restCount !== 1) {
      throw new Error(
        `Surviving tribute "${tribute.id}" received ` + `${restCount} night-rest outcomes.`,
      );
    }
  }

  return completedEvents;
}
