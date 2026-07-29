import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { GameState, ResolvedEvent, RoundReference } from "~/game/types/game-state";

import { applyMissingNightRestBookkeeping, completeNightRestCoverage } from "./night-rest-coverage";
import { prepareRound } from "./round-preparation";

const NIGHT_ROUND = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

const MORNING_ROUND = {
  day: 3,
  period: "day",
} as const satisfies RoundReference;

function createNightEvent(
  id: string,
  tributeId: string,
  changes: ResolvedEvent["changes"],
): ResolvedEvent {
  return {
    id,
    definitionId: id,

    kind: "primary",
    resolutionMode: "standard",

    round: NIGHT_ROUND,
    participantTributeIds: [tributeId],

    text: `${id} occurs.`,
    changes,
  };
}

function applyEvents(state: GameState, events: readonly ResolvedEvent[]): GameState {
  return events.reduce((nextState, event) => applyResolvedEvent(nextState, event), state);
}

describe("night-rest lifecycle integration", () => {
  it("carries visible night outcomes into the correct morning statuses", () => {
    const comfortable = createAuthoringTestTribute({
      id: "comfortable",
      name: "Comfortable",
    });

    const sheltered = createAuthoringTestTribute({
      id: "sheltered",
      name: "Sheltered",
    });

    const active = createAuthoringTestTribute({
      id: "active",
      name: "Active",
    });

    const doomed = createAuthoringTestTribute({
      id: "doomed",
      name: "Doomed",
    });

    const state = {
      ...createAuthoringTestGame([comfortable, sheltered, active, doomed]),

      currentRound: NIGHT_ROUND,
    };

    const completedEvents = completeNightRestCoverage(state, NIGHT_ROUND, [
      createNightEvent("comfortable-camp", comfortable.id, [
        {
          type: "record-night-rest",

          tributeId: comfortable.id,
          round: NIGHT_ROUND,
          quality: "comfortable",
        },
      ]),

      createNightEvent("sheltered-camp", sheltered.id, [
        {
          type: "record-night-rest",

          tributeId: sheltered.id,
          round: NIGHT_ROUND,
          quality: "sheltered",
        },
      ]),

      createNightEvent("night-activity", active.id, []),

      createNightEvent("night-fatality", doomed.id, [
        {
          type: "eliminate-tribute",

          tributeId: doomed.id,

          causeId: "test-night-fatality",
          causeLabel: "Test night fatality",
          summary: "Doomed dies during the night.",

          killerTributeIds: [],
        },
      ]),
    ]);

    const afterVisibleNight = applyEvents(
      {
        ...state,
        roundEvents: [...completedEvents],
        revealedEventCount: completedEvents.length,
      },
      completedEvents,
    );

    const afterNight = applyMissingNightRestBookkeeping(afterVisibleNight);

    const morning = prepareRound(afterNight, MORNING_ROUND);

    const morningRestEvents = morning.automaticEvents.filter(
      (event) => event.preparation?.mechanic === "morning-rest-resolution",
    );

    expect(morningRestEvents).toHaveLength(3);

    const comfortableAfter = morning.state.tributes.find(
      (tribute) => tribute.id === comfortable.id,
    );

    const shelteredAfter = morning.state.tributes.find((tribute) => tribute.id === sheltered.id);

    const activeAfter = morning.state.tributes.find((tribute) => tribute.id === active.id);

    const doomedAfter = morning.state.tributes.find((tribute) => tribute.id === doomed.id);

    expect(comfortableAfter?.statuses).toContainEqual(
      expect.objectContaining({
        definitionId: "well-rested",
        severity: 2,
      }),
    );

    expect(shelteredAfter?.statuses).toContainEqual(
      expect.objectContaining({
        definitionId: "well-rested",
        severity: 1,
      }),
    );

    expect(activeAfter?.statuses).toContainEqual(
      expect.objectContaining({
        definitionId: "exhausted",
        severity: 1,
      }),
    );

    expect(doomedAfter?.isAlive).toBe(false);

    expect(
      morningRestEvents.some((event) => event.preparation?.actingTributeId === doomed.id),
    ).toBe(false);
  });
});
