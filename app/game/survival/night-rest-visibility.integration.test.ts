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
} from "./night-rest-coverage";

const NIGHT_ONE = {
  day: 1,
  period: "night",
} as const;

describe("night-rest presentation boundary", () => {
  it("keeps generic rest bookkeeping out of the visible reveal queue", () => {
    const tributes = Array.from(
      {
        length: 4,
      },
      (_, index) =>
        createAuthoringTestTribute({
          id: `tribute-${index + 1}`,
          name: `Tribute ${index + 1}`,
        }),
    );

    const state: GameState = {
      ...createAuthoringTestGame(tributes),
      currentRound: NIGHT_ONE,
    };

    const authoredEvent: ResolvedEvent = {
      id: "night-1-0-authored",
      definitionId: "authored-night-event",
      kind: "primary",
      resolutionMode: "standard",
      round: NIGHT_ONE,
      participantTributeIds: [tributes[0]?.id ?? ""],
      text: "Tribute 1 receives an authored night event.",
      changes: [],
    };

    const visibleEvents = completeNightRestCoverage(state, NIGHT_ONE, [authoredEvent]);

    expect(visibleEvents).toEqual([authoredEvent]);

    const queuedState: GameState = {
      ...state,
      roundEvents: [...visibleEvents],
      revealedEventCount: visibleEvents.length,
    };

    const stateAfterVisibleEvent = applyResolvedEvent(queuedState, authoredEvent);

    const completedState = applyMissingNightRestBookkeeping(stateAfterVisibleEvent);

    /*
     * Only the authored card belongs in the reveal queue.
     */
    expect(completedState.roundEvents).toEqual([authoredEvent]);

    expect(
      completedState.roundEvents.some(
        (event) =>
          event.kind === "preparation" || event.definitionId === NIGHT_REST_FALLBACK_DEFINITION_ID,
      ),
    ).toBe(false);

    expect(
      completedState.roundEvents.some((event) =>
        /secure shelter|remains exposed/i.test(event.text),
      ),
    ).toBe(false);

    /*
     * The rest records still exist in history and tribute state.
     */
    const bookkeepingEvents = completedState.eventHistory.filter(
      (event) => event.definitionId === NIGHT_REST_FALLBACK_DEFINITION_ID,
    );

    expect(bookkeepingEvents).toHaveLength(tributes.length);

    expect(
      bookkeepingEvents.every(
        (event) =>
          event.kind === "preparation" && event.preparation?.mechanic === "night-rest-preparation",
      ),
    ).toBe(true);

    const restCounts = new Map<string, number>();

    for (const event of completedState.eventHistory) {
      for (const change of event.changes) {
        if (change.type !== "record-night-rest") {
          continue;
        }

        restCounts.set(change.tributeId, (restCounts.get(change.tributeId) ?? 0) + 1);
      }
    }

    for (const tribute of completedState.tributes) {
      expect(restCounts.get(tribute.id) ?? 0).toBe(1);

      expect(tribute.survival.lastNightRest).toEqual({
        round: NIGHT_ONE,
        quality: "unsheltered",
      });
    }
  });
});
