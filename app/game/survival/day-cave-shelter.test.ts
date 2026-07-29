import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { GameState, ResolvedEvent } from "~/game/types/game-state";

import {
  applyMissingNightRestBookkeeping,
  completeNightRestCoverage,
  NIGHT_REST_FALLBACK_DEFINITION_ID,
  PREPARED_CAVE_NIGHT_DEFINITION_ID,
} from "~/game/survival/night-rest-coverage";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const;

const NIGHT_TWO = {
  day: 2,
  period: "night",
} as const;

function applyVisibleEvents(state: GameState, events: readonly ResolvedEvent[]): GameState {
  const queuedState: GameState = {
    ...state,
    roundEvents: [...events],
    revealedEventCount: events.length,
  };

  return events.reduce((nextState, event) => applyResolvedEvent(nextState, event), queuedState);
}

describe("prepared cave shelter", () => {
  it("gives the successful explorer a visible sheltered payoff without showing generic fallback", () => {
    const actor = createAuthoringTestTribute({
      id: "actor",
      name: "Actor",
    });

    const other = createAuthoringTestTribute({
      id: "other",
      name: "Other",
    });

    const baseState = createAuthoringTestGame([actor, other]);

    const caveEvent: ResolvedEvent = {
      id: "day-2-cave",
      definitionId: "day-discovering-cave-shelter",
      kind: "primary",
      resolutionMode: "standard",
      round: DAY_TWO,
      participantTributeIds: [actor.id],
      text: "Actor prepares a cave.",
      changes: [],
    };

    const state: GameState = {
      ...baseState,
      currentRound: NIGHT_TWO,
      eventHistory: [caveEvent],
    };

    const completed = completeNightRestCoverage(state, NIGHT_TWO, []);

    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      definitionId: PREPARED_CAVE_NIGHT_DEFINITION_ID,
      participantTributeIds: [actor.id],
    });

    expect(completed[0]?.text).toContain("prepared cave");

    const actorRest = completed
      .flatMap((event) => event.changes)
      .find((change) => change.type === "record-night-rest" && change.tributeId === actor.id);

    expect(actorRest).toEqual({
      type: "record-night-rest",
      tributeId: actor.id,
      round: NIGHT_TWO,
      quality: "sheltered",
    });

    expect(
      completed.some((event) => event.definitionId === NIGHT_REST_FALLBACK_DEFINITION_ID),
    ).toBe(false);

    const afterVisibleEvents = applyVisibleEvents(state, completed);

    const afterBookkeeping = applyMissingNightRestBookkeeping(afterVisibleEvents);

    const otherBookkeeping = afterBookkeeping.eventHistory.find(
      (event) =>
        event.definitionId === NIGHT_REST_FALLBACK_DEFINITION_ID &&
        event.participantTributeIds.includes(other.id),
    );

    expect(otherBookkeeping).toMatchObject({
      kind: "preparation",
    });

    expect(otherBookkeeping?.changes).toContainEqual({
      type: "record-night-rest",
      tributeId: other.id,
      round: NIGHT_TWO,
      quality: "unsheltered",
    });
  });

  it("upgrades an explicit unsheltered result", () => {
    const actor = createAuthoringTestTribute({
      id: "actor",
      name: "Actor",
    });

    const other = createAuthoringTestTribute({
      id: "other",
      name: "Other",
    });

    const baseState = createAuthoringTestGame([actor, other]);

    const caveEvent: ResolvedEvent = {
      id: "day-2-cave",
      definitionId: "day-discovering-cave-shelter",
      kind: "primary",
      resolutionMode: "standard",
      round: DAY_TWO,
      participantTributeIds: [actor.id],
      text: "Actor prepares a cave.",
      changes: [],
    };

    const nightEvent: ResolvedEvent = {
      id: "night-2-event",
      definitionId: "test-night-event",
      kind: "primary",
      resolutionMode: "standard",
      round: NIGHT_TWO,
      participantTributeIds: [actor.id],
      text: "Actor remains exposed.",
      changes: [
        {
          type: "record-night-rest",
          tributeId: actor.id,
          round: NIGHT_TWO,
          quality: "unsheltered",
        },
      ],
    };

    const state = {
      ...baseState,
      currentRound: NIGHT_TWO,
      eventHistory: [caveEvent],
    };

    const completed = completeNightRestCoverage(state, NIGHT_TWO, [nightEvent]);

    const actorEvent = completed.find((event) => event.participantTributeIds.includes(actor.id));

    expect(actorEvent?.changes).toContainEqual({
      type: "record-night-rest",
      tributeId: actor.id,
      round: NIGHT_TWO,
      quality: "sheltered",
    });

    expect(actorEvent?.text).toContain("prepared cave");
  });
});
