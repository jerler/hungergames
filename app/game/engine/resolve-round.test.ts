import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { MAX_CONSECUTIVE_NON_ELIMINATION_ROUNDS } from "~/game/engine/event-sequencer";
import { createSeededRandom } from "~/game/engine/random";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";

import { resolveRound } from "./resolve-round";

function createTestGame(seed = "deterministic-game") {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, createSeededRandom(`${seed}:reaping`)),
    "random",
    {
      createId: () => {
        nextId += 1;
        return `id-${nextId}`;
      },

      now: "2026-07-18T12:00:00.000Z",
      seed,
    },
  );
}

describe("resolveRound", () => {
  it("produces identical events for the same state and round", () => {
    const state = createTestGame();

    const round = {
      day: 1,
      period: "day" as const,
    };

    expect(resolveRound(state, round)).toEqual(resolveRound(state, round));
  });

  it("only selects living tributes once within a round", () => {
    const state = createTestGame();

    const events = resolveRound(state, {
      day: 1,
      period: "day",
    });

    const participantIds = events.flatMap((event) => event.participantTributeIds);

    expect(new Set(participantIds).size).toBe(participantIds.length);
  });

  it("forces an elimination after too many safe rounds", () => {
    const state = createTestGame();

    const stalledState = {
      ...state,

      engine: {
        ...state.engine,

        consecutiveNonEliminationRounds: MAX_CONSECUTIVE_NON_ELIMINATION_ROUNDS,
      },
    };

    const events = resolveRound(stalledState, {
      day: 3,
      period: "day",
    });

    expect(events.some((event) => event.resolutionMode === "safety")).toBe(true);

    expect(
      events.some((event) => event.changes.some((change) => change.type === "eliminate-tribute")),
    ).toBe(true);
  });
});
