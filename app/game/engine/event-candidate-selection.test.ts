// Phase 1 feasible ordinary-event candidate selection tests.
import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type {
  EventDefinition,
  EventSelectionContext,
  ParticipantRoleDefinition,
} from "~/game/events/event-schema";
import { sequenceRoundEvents } from "~/game/engine/event-sequencer";
import { NIGHT_REST_FALLBACK_DEFINITION_ID } from "~/game/survival/night-rest-coverage";
import type { TributeStatValue } from "~/game/types/tribute";

import {
  createEventCandidateSelectionSeed,
  createFeasibleEventCandidates,
  selectFeasibleEventCandidate,
  type FeasibleEventCandidate,
} from "./event-candidate-selection";

const DAY_ROUND = {
  day: 2,
  period: "day",
} as const;

const STAT_VALUES = [1, 2, 3, 4, 5] as const satisfies readonly TributeStatValue[];

function getStatValue(index: number): TributeStatValue {
  const value = STAT_VALUES[index % STAT_VALUES.length];

  if (value === undefined) {
    throw new Error("Could not create a test tribute stat value.");
  }

  return value;
}

function createDefinition({
  id,
  baseWeight = 1,
  role = {
    id: "actor",
    count: 1,
  },
}: {
  id: string;
  baseWeight?: number;
  role?: ParticipantRoleDefinition;
}): EventDefinition {
  return {
    id,
    category: "survival",
    periods: ["day"],
    baseWeight,
    tags: ["survival"],
    roles: [role],
    resolve: () => ({
      text: `${id} occurs.`,
      changes: [],
    }),
  };
}

function createContext(): EventSelectionContext {
  const tributes = Array.from(
    {
      length: 6,
    },
    (_, index) =>
      createAuthoringTestTribute({
        id: `tribute-${index + 1}`,
        name: `Tribute ${index + 1}`,
        stats: {
          brains: getStatValue(index),
          brawn: getStatValue(index + 2),
          luck: getStatValue(index + 4),
        },
      }),
  );

  const state = {
    ...createAuthoringTestGame(tributes),
    seed: "feasible-candidate-test",
    currentRound: DAY_ROUND,
  };

  return {
    state,
    round: DAY_ROUND,
    livingTributes: state.tributes,
  };
}

function createCandidates(
  definitions: readonly EventDefinition[],
  context = createContext(),
  previousCandidates: readonly FeasibleEventCandidate[] = [],
) {
  return createFeasibleEventCandidates({
    definitions,
    context,
    unavailableTributeIds: new Set<string>(),
    unavailableItemInstanceIds: new Set<string>(),
    selectionSeed: createEventCandidateSelectionSeed(context.state.seed, context.round, 0),
    previousSelectionsByDefinitionId: new Map(
      previousCandidates.map((candidate) => [
        candidate.definition.id,
        candidate.feasibilitySelection,
      ]),
    ),
  });
}

describe("feasible ordinary-event candidates", () => {
  it("removes a high-weight definition that cannot form its required item assignment", () => {
    const impossibleItemEvent = createDefinition({
      id: "impossible-item-event",
      baseWeight: 10_000,
      role: {
        id: "actor",
        count: 1,
        requiredItemDefinitionIds: ["knife"],
        itemAccess: "owned",
      },
    });

    const ordinaryEvent = createDefinition({
      id: "ordinary-event",
      baseWeight: 1,
    });

    const candidates = createCandidates([impossibleItemEvent, ordinaryEvent]);

    expect(candidates.map((candidate) => candidate.definition.id)).toEqual(["ordinary-event"]);

    expect(selectFeasibleEventCandidate(candidates, () => 0)).toMatchObject({
      definition: {
        id: "ordinary-event",
      },
    });
  });

  it("evaluates every feasible definition before performing the weighted draw", () => {
    const evaluatedDefinitions = new Set<string>();

    const createObservedDefinition = (id: string, baseWeight: number) =>
      createDefinition({
        id,
        baseWeight,
        role: {
          id: "actor",
          count: 1,
          isEligible: () => {
            evaluatedDefinitions.add(id);
            return true;
          },
        },
      });

    const candidates = createCandidates([
      createObservedDefinition("rare-specific-event", 1),
      createObservedDefinition("common-general-event", 100),
    ]);

    expect(evaluatedDefinitions).toEqual(new Set(["rare-specific-event", "common-general-event"]));

    expect(candidates.map((candidate) => candidate.definition.id)).toEqual([
      "rare-specific-event",
      "common-general-event",
    ]);
  });

  it("keeps each definition's feasibility witness stable when catalogue order changes", () => {
    const firstDefinition = createDefinition({
      id: "first-definition",
    });
    const secondDefinition = createDefinition({
      id: "second-definition",
    });

    const context = createContext();

    const forward = createCandidates([firstDefinition, secondDefinition], context);
    const reversed = createCandidates([secondDefinition, firstDefinition], context);

    const toParticipantMap = (candidates: readonly FeasibleEventCandidate[]) =>
      Object.fromEntries(
        candidates.map((candidate) => [
          candidate.definition.id,
          candidate.feasibilitySelection.participantTributeIds,
        ]),
      );

    expect(toParticipantMap(reversed)).toEqual(toParticipantMap(forward));
  });

  it("reuses an unaffected feasibility witness in the next event slot", () => {
    let eligibilityChecks = 0;

    const definition = createDefinition({
      id: "cached-feasibility",
      role: {
        id: "actor",
        count: 1,
        isEligible: () => {
          eligibilityChecks += 1;
          return true;
        },
      },
    });

    const context = createContext();
    const firstCandidates = createCandidates([definition], context);
    const checksAfterFirstSlot = eligibilityChecks;

    const secondCandidates = createCandidates([definition], context, firstCandidates);

    expect(secondCandidates).toHaveLength(1);
    expect(eligibilityChecks).toBe(checksAfterFirstSlot);
  });

  it("consumes the main random stream only for the final weighted draw", () => {
    const candidates = createCandidates([
      createDefinition({
        id: "first-feasible",
      }),
      createDefinition({
        id: "second-feasible",
      }),
    ]);

    let randomCalls = 0;

    const selected = selectFeasibleEventCandidate(candidates, () => {
      randomCalls += 1;
      return 0.5;
    });

    expect(selected).not.toBeNull();
    expect(randomCalls).toBe(1);
  });

  it("does not repeat an ordinary definition within one round", () => {
    const context = createContext();
    const events = sequenceRoundEvents(context.state, DAY_ROUND);

    const ordinaryDefinitionIds = events
      .filter((event) => event.definitionId !== NIGHT_REST_FALLBACK_DEFINITION_ID)
      .map((event) => event.definitionId);

    expect(new Set(ordinaryDefinitionIds).size).toBe(ordinaryDefinitionIds.length);
  });
});
