import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { ResolvedEvent, RoundReference } from "~/game/types/game-state";

import {
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

describe("completeNightRestCoverage", () => {
  it("preserves explicit rest and fills every surviving gap once", () => {
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

    const state = createAuthoringTestGame([sheltered, active, eliminated, unassigned]);

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

    const restChanges = getRestChanges(completed);

    expect(
      restChanges
        .filter(({ change }) => change.tributeId === sheltered.id)
        .map(({ change }) => change.quality),
    ).toEqual(["sheltered"]);

    const activeEvent = completed.find((event) => event.id === "night-activity");

    expect(activeEvent?.text).toMatch(/secure shelter/i);

    expect(
      restChanges
        .filter(({ change }) => change.tributeId === active.id)
        .map(({ change }) => change.quality),
    ).toEqual(["unsheltered"]);

    expect(restChanges.filter(({ change }) => change.tributeId === eliminated.id)).toEqual([]);

    const fallbackEvent = completed.find(
      (event) => event.definitionId === NIGHT_REST_FALLBACK_DEFINITION_ID,
    );

    expect(fallbackEvent).toMatchObject({
      participantTributeIds: [unassigned.id],
    });

    expect(fallbackEvent?.text).toMatch(/secure shelter/i);

    expect(
      restChanges
        .filter(({ change }) => change.tributeId === unassigned.id)
        .map(({ change }) => change.quality),
    ).toEqual(["unsheltered"]);
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

  it("does nothing during daytime sequencing", () => {
    const tribute = createAuthoringTestTribute();

    const state = createAuthoringTestGame([tribute]);
    const events = [createPrimaryEvent("day-event", [tribute.id])];

    const result = completeNightRestCoverage(
      state,
      {
        day: 3,
        period: "day",
      },
      events,
    );

    expect(result).toEqual(events);
  });
});
