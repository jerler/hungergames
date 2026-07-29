import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { GameState, ResolvedEvent, RoundReference } from "~/game/types/game-state";

import {
  applyMissingNightRestBookkeeping,
  completeNightRestCoverage,
  NIGHT_REST_FALLBACK_DEFINITION_ID,
} from "./night-rest-coverage";

const NIGHT_ROUND = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

function createPrimaryEvent(
  id: string,
  participantTributeIds: readonly string[],
  changes: ResolvedEvent["changes"] = [],
): ResolvedEvent {
  return {
    id,
    definitionId: id,
    kind: "primary",
    resolutionMode: "standard",
    round: NIGHT_ROUND,
    participantTributeIds: [...participantTributeIds],
    text: `${id} occurs.`,
    changes: [...changes],
  };
}

function getRestChanges(events: readonly ResolvedEvent[]) {
  return events.flatMap((event) =>
    event.changes.flatMap((change) =>
      change.type === "record-night-rest"
        ? [
            {
              event,
              change,
            },
          ]
        : [],
    ),
  );
}

function applyVisibleEvents(state: GameState, events: readonly ResolvedEvent[]): GameState {
  const queuedState: GameState = {
    ...state,
    currentRound: NIGHT_ROUND,
    roundEvents: [...events],
    revealedEventCount: events.length,
  };

  return events.reduce((nextState, event) => applyResolvedEvent(nextState, event), queuedState);
}

describe("completeNightRestCoverage", () => {
  it("keeps generic missing rest out of the visible arena events", () => {
    const sheltered = createAuthoringTestTribute({
      id: "sheltered",
      name: "Sheltered",
    });

    const active = createAuthoringTestTribute({
      id: "active",
      name: "Active",
    });

    const eliminated = createAuthoringTestTribute({
      id: "eliminated",
      name: "Eliminated",
    });

    const unassigned = createAuthoringTestTribute({
      id: "unassigned",
      name: "Unassigned",
    });

    const state = {
      ...createAuthoringTestGame([sheltered, active, eliminated, unassigned]),
      currentRound: NIGHT_ROUND,
    };

    const events = [
      createPrimaryEvent(
        "explicit-shelter",
        [sheltered.id],
        [
          {
            type: "record-night-rest",
            tributeId: sheltered.id,
            round: NIGHT_ROUND,
            quality: "sheltered",
          },
        ],
      ),

      createPrimaryEvent("night-activity", [active.id]),

      createPrimaryEvent(
        "night-fatality",
        [eliminated.id],
        [
          {
            type: "eliminate-tribute",
            tributeId: eliminated.id,
            causeId: "test-fatality",
            causeLabel: "Test fatality",
            summary: "Eliminated is killed during testing.",
            killerTributeIds: [],
          },
        ],
      ),
    ];

    const completed = completeNightRestCoverage(state, NIGHT_ROUND, events);

    expect(completed).toHaveLength(events.length);

    expect(
      completed.some((event) => event.definitionId === NIGHT_REST_FALLBACK_DEFINITION_ID),
    ).toBe(false);

    const activeEvent = completed.find((event) => event.id === "night-activity");

    expect(activeEvent?.text).toBe("night-activity occurs.");
    expect(activeEvent?.changes).toEqual([]);

    const visibleRestChanges = getRestChanges(completed);

    expect(
      visibleRestChanges.map(({ change }) => ({
        tributeId: change.tributeId,
        quality: change.quality,
      })),
    ).toEqual([
      {
        tributeId: sheltered.id,
        quality: "sheltered",
      },
    ]);

    const afterVisibleEvents = applyVisibleEvents(state, completed);

    const afterBookkeeping = applyMissingNightRestBookkeeping(afterVisibleEvents);

    const bookkeepingEvents = afterBookkeeping.eventHistory.filter(
      (event) => event.definitionId === NIGHT_REST_FALLBACK_DEFINITION_ID,
    );

    expect(bookkeepingEvents).toHaveLength(2);

    expect(bookkeepingEvents.map((event) => event.participantTributeIds[0])).toEqual(
      expect.arrayContaining([active.id, unassigned.id]),
    );

    expect(bookkeepingEvents.every((event) => event.kind === "preparation")).toBe(true);

    expect(afterBookkeeping.roundEvents.filter((event) => event.kind === "primary")).toHaveLength(
      events.length,
    );

    expect(
      afterBookkeeping.tributes.find((tribute) => tribute.id === active.id)?.statistics
        .eventsSurvived,
    ).toBe(0);
  });

  it("rejects more than one rest outcome for one tribute", () => {
    const tribute = createAuthoringTestTribute({
      id: "duplicate-rest",
    });

    const state = createAuthoringTestGame([tribute]);

    expect(() =>
      completeNightRestCoverage(state, NIGHT_ROUND, [
        createPrimaryEvent(
          "duplicate-rest-event",
          [tribute.id],
          [
            {
              type: "record-night-rest",
              tributeId: tribute.id,
              round: NIGHT_ROUND,
              quality: "sheltered",
            },
            {
              type: "record-night-rest",
              tributeId: tribute.id,
              round: NIGHT_ROUND,
              quality: "unsheltered",
            },
          ],
        ),
      ]),
    ).toThrow(/receives 2 night-rest outcomes/i);
  });

  it("does nothing during daytime sequencing or bookkeeping", () => {
    const tribute = createAuthoringTestTribute();

    const state = createAuthoringTestGame([tribute]);
    const events = [createPrimaryEvent("day-event", [tribute.id])];

    const dayState = {
      ...state,
      currentRound: {
        day: 3,
        period: "day",
      } as const,
    };

    const result = completeNightRestCoverage(dayState, dayState.currentRound, events);

    expect(result).toEqual(events);
    expect(applyMissingNightRestBookkeeping(dayState)).toBe(dayState);
  });
});
