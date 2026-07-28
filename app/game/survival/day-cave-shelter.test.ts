import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { completeNightRestCoverage } from "~/game/survival/night-rest-coverage";
import type { ResolvedEvent } from "~/game/types/game-state";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const;

const NIGHT_TWO = {
  day: 2,
  period: "night",
} as const;

describe("prepared cave shelter", () => {
  it("gives the successful explorer sheltered rest that night", () => {
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
    const state = {
      ...baseState,
      currentRound: NIGHT_TWO,
      eventHistory: [caveEvent],
    };

    const completed = completeNightRestCoverage(state, NIGHT_TWO, []);
    const actorRest = completed
      .flatMap((event) => event.changes)
      .find((change) => change.type === "record-night-rest" && change.tributeId === actor.id);
    const otherRest = completed
      .flatMap((event) => event.changes)
      .find((change) => change.type === "record-night-rest" && change.tributeId === other.id);

    expect(actorRest).toEqual({
      type: "record-night-rest",
      tributeId: actor.id,
      round: NIGHT_TWO,
      quality: "sheltered",
    });
    expect(otherRest).toEqual({
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
