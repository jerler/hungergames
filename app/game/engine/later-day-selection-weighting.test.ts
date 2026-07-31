import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  createEventCandidateSelectionSeed,
  createFeasibleEventCandidates,
} from "./event-candidate-selection";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import type { RoundReference } from "~/game/types/game-state";

function createDefinition({
  id,
  participantCount,
  specificityScore = 0,
}: {
  id: string;
  participantCount: number;
  specificityScore?: number;
}): EventDefinition {
  return {
    id,
    category: "survival",
    tags: ["survival"],
    periods: ["day", "night"],
    baseWeight: 1,
    ...(specificityScore > 0
      ? {
          selectionProfile: {
            specificityScore,
            specificityReasons: ["item-requirement"] as const,
          },
        }
      : {}),
    roles: [{ id: "tributes", count: participantCount }],
    resolve: () => ({
      text: `${id} occurs.`,
      changes: [],
    }),
  };
}

function createContext(round: RoundReference): EventSelectionContext {
  const tributes = Array.from({ length: 6 }, (_, index) =>
    createAuthoringTestTribute({
      id: `tribute-${index + 1}`,
    }),
  );
  const state = {
    ...createAuthoringTestGame(tributes),
    seed: "later-day-shape-weighting",
    currentRound: round,
  };

  return {
    state,
    round,
    livingTributes: state.tributes,
  };
}

function getWeights(
  definitions: readonly EventDefinition[],
  round: RoundReference,
): Map<string, number> {
  const context = createContext(round);
  const candidates = createFeasibleEventCandidates({
    definitions,
    context,
    unavailableTributeIds: new Set<string>(),
    unavailableItemInstanceIds: new Set<string>(),
    selectionSeed: createEventCandidateSelectionSeed(context.state.seed, round, 0),
  });

  return new Map(
    candidates.map((candidate) => [candidate.definition.id, candidate.effectiveWeight]),
  );
}

describe("later-Day selection weighting", () => {
  it("moderately favours non-solo definitions without escalating by group size", () => {
    const weights = getWeights(
      [
        createDefinition({ id: "solo", participantCount: 1 }),
        createDefinition({ id: "pair", participantCount: 2 }),
        createDefinition({ id: "trio", participantCount: 3 }),
        createDefinition({ id: "group", participantCount: 4 }),
      ],
      {
        day: 2,
        period: "day",
      },
    );
    const soloWeight = weights.get("solo") ?? 0;

    expect((weights.get("pair") ?? 0) / soloWeight).toBeCloseTo(1.1 / 0.8, 10);
    expect((weights.get("trio") ?? 0) / soloWeight).toBeCloseTo(1.15 / 0.8, 10);
    expect(weights.get("group")).toBeCloseTo(weights.get("trio") ?? 0, 10);
  });

  it("leaves otherwise identical Night definitions equally weighted", () => {
    const weights = getWeights(
      [
        createDefinition({ id: "night-solo", participantCount: 1 }),
        createDefinition({ id: "night-pair", participantCount: 2 }),
        createDefinition({ id: "night-trio", participantCount: 3 }),
        createDefinition({ id: "night-group", participantCount: 4 }),
      ],
      {
        day: 2,
        period: "night",
      },
    );

    expect(new Set(weights.values()).size).toBe(1);
  });

  it("keeps a meaningfully specific solo event above a generic pair event", () => {
    const weights = getWeights(
      [
        createDefinition({
          id: "specific-solo",
          participantCount: 1,
          specificityScore: 2,
        }),
        createDefinition({
          id: "generic-pair",
          participantCount: 2,
        }),
      ],
      {
        day: 2,
        period: "day",
      },
    );

    expect(weights.get("specific-solo")).toBeGreaterThan(weights.get("generic-pair") ?? 0);
  });
});
