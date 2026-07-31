import { describe, expect, it } from "vitest";

import type { ResolvedEvent, ResolvedEventKind } from "~/game/types/game-state";
import {
  createEventRepeatCycleState,
  getCanonicalPrimaryEventHistory,
  recordEventRepeatCycleSelection,
  selectEventRepeatCycleCandidates,
} from "./event-repeat-cycle";

function createEvent({
  definitionId,
  id,
  day = 2,
  period = "day",
  kind = "primary",
}: {
  definitionId: string;
  id: string;
  day?: number;
  period?: "day" | "night";
  kind?: ResolvedEventKind;
}): ResolvedEvent {
  return {
    id,
    definitionId,
    kind,
    resolutionMode: "standard",
    round: {
      day,
      period,
    },
    participantTributeIds: [],
    text: `${definitionId} occurs.`,
    changes: [],
  };
}

function createCandidate(id: string) {
  return {
    definition: {
      id,
    },
  };
}

describe("event repeat cycle", () => {
  it("tracks unique primary definitions across Day and Night", () => {
    const state = createEventRepeatCycleState([
      createEvent({
        id: "day-2-0-fallen-cliff",
        definitionId: "fallen-cliff",
      }),
      createEvent({
        id: "night-2-0-cold-rain",
        definitionId: "cold-rain",
        period: "night",
      }),
    ]);

    expect(state.usedDefinitionIds).toEqual(new Set(["fallen-cliff", "cold-rain"]));
  });

  it("uses canonical planning order instead of shuffled presentation order", () => {
    const shuffledPresentationHistory = [
      createEvent({
        id: "day-2-3-event-c",
        definitionId: "event-c",
      }),
      createEvent({
        id: "day-2-1-event-b",
        definitionId: "event-b",
      }),
      createEvent({
        id: "day-2-2-event-a",
        definitionId: "event-a",
      }),
      createEvent({
        id: "day-2-0-event-a",
        definitionId: "event-a",
      }),
    ];

    expect(
      getCanonicalPrimaryEventHistory(shuffledPresentationHistory).map(
        (event) => event.definitionId,
      ),
    ).toEqual(["event-a", "event-b", "event-a", "event-c"]);

    expect(createEventRepeatCycleState(shuffledPresentationHistory).usedDefinitionIds).toEqual(
      new Set(["event-a", "event-c"]),
    );
  });

  it("ignores preparation, aftermath, and status-resolution history", () => {
    const state = createEventRepeatCycleState([
      createEvent({
        id: "day-2-0-event-a",
        definitionId: "event-a",
      }),
      createEvent({
        id: "day-2-preparation-event-a",
        definitionId: "event-a",
        kind: "preparation",
      }),
      createEvent({
        id: "day-2-aftermath-event-a",
        definitionId: "event-a",
        kind: "aftermath",
      }),
      createEvent({
        id: "day-2-status-event-a",
        definitionId: "event-a",
        kind: "status-resolution",
      }),
    ]);

    expect(state.usedDefinitionIds).toEqual(new Set(["event-a"]));
  });

  it("prefers unused definitions from the currently selectable pool", () => {
    const state = {
      usedDefinitionIds: new Set(["fallen-cliff", "river-current"]),
    };
    const selection = selectEventRepeatCycleCandidates(
      [
        createCandidate("fallen-cliff"),
        createCandidate("tactical-attack"),
        createCandidate("river-current"),
      ],
      state,
    );

    expect(selection.resetsCycle).toBe(false);
    expect(selection.candidates.map((candidate) => candidate.definition.id)).toEqual([
      "tactical-attack",
    ]);
  });

  it("resets only when every currently selectable definition is used", () => {
    const state = {
      usedDefinitionIds: new Set([
        "fallen-cliff",
        "river-current",
        "unused-but-currently-infeasible",
      ]),
    };
    const candidates = [createCandidate("fallen-cliff"), createCandidate("river-current")];
    const selection = selectEventRepeatCycleCandidates(candidates, state);

    expect(selection.resetsCycle).toBe(true);
    expect(selection.candidates).toEqual(candidates);

    recordEventRepeatCycleSelection(state, "river-current", selection.resetsCycle);

    expect(state.usedDefinitionIds).toEqual(new Set(["river-current"]));
  });

  it("does not reset or record anything when no normal candidate is selectable", () => {
    const state = {
      usedDefinitionIds: new Set(["fallen-cliff"]),
    };
    const selection = selectEventRepeatCycleCandidates([], state);

    expect(selection).toEqual({
      candidates: [],
      resetsCycle: false,
    });
    expect(state.usedDefinitionIds).toEqual(new Set(["fallen-cliff"]));
  });

  it("does not mutate the cycle until an accepted selection is recorded", () => {
    const state = {
      usedDefinitionIds: new Set(["event-a", "event-b"]),
    };
    const selection = selectEventRepeatCycleCandidates(
      [createCandidate("event-a"), createCandidate("event-b")],
      state,
    );

    expect(selection.resetsCycle).toBe(true);
    expect(state.usedDefinitionIds).toEqual(new Set(["event-a", "event-b"]));

    recordEventRepeatCycleSelection(state, "event-b", selection.resetsCycle);

    expect(state.usedDefinitionIds).toEqual(new Set(["event-b"]));
  });
});
