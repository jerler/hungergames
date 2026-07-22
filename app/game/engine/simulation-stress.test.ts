import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { createSeededRandom } from "~/game/engine/random";
import { selectLivingTributes } from "~/game/selectors/game-selectors";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import type { DistrictCount } from "~/game/types/game-config";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState } from "~/game/types/game-state";
import { gameReducer } from "~/state/game-reducer";

const simulationCache = new Map<string, GameState>();

function createSimulationGame(seed: string, districtCount: DistrictCount): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount,
  };

  let nextId = 0;

  return createInitialGameState(
    config,
    createRandomTributeDrafts(
      districtCount,
      DEFAULT_TRIBUTES,
      createSeededRandom(`${seed}:reaping`),
    ),
    "random",
    {
      createId: () => {
        nextId += 1;

        return `${seed}-id-${nextId}`;
      },

      now: "2026-07-18T12:00:00.000Z",
      seed,
    },
  );
}

function simulateGame(seed: string, districtCount: DistrictCount): GameState {
  let state: GameState | null = createSimulationGame(seed, districtCount);

  const cacheKey = `${districtCount}:${seed}`;

  const cachedResult = simulationCache.get(cacheKey);

  if (cachedResult) {
    return cachedResult;
  }

  assertGameStateInvariants(state);

  for (let roundIndex = 0; roundIndex < 100; roundIndex += 1) {
    state = gameReducer(state, {
      type: "round/began",
      now: `round-${roundIndex}-start`,
    });

    state = gameReducer(state, {
      type: "round/revealed",
      now: `round-${roundIndex}-end`,
    });

    if (!state) {
      throw new Error(`Simulation "${seed}" lost its GameState.`);
    }

    assertGameStateInvariants(state);

    if (state.phase === "victory") {
      simulationCache.set(cacheKey, state);

      return state;
    }
  }

  throw new Error(`Simulation "${seed}" failed to produce a victor.`);
}

function expectValidVictoryOutcome(result: GameState): void {
  const victoryOutcome = result.victoryOutcome;

  expect(victoryOutcome).not.toBeNull();

  if (!victoryOutcome) {
    throw new Error("The completed simulation has no victory outcome.");
  }

  const livingTributes = selectLivingTributes(result);

  expect([1, 2]).toContain(livingTributes.length);

  expect(livingTributes).toHaveLength(victoryOutcome.victorTributeIds.length);

  expect(new Set(victoryOutcome.victorTributeIds)).toEqual(
    new Set(livingTributes.map((tribute) => tribute.id)),
  );
}

function getEliminationCount(state: GameState, day?: number, period?: "day" | "night"): number {
  return state.eventHistory.reduce(
    (total, event) => {
      if (day !== undefined && event.round.day !== day) {
        return total;
      }

      if (period !== undefined && event.round.period !== period) {
        return total;
      }

      return total + event.changes.filter((change) => change.type === "eliminate-tribute").length;
    },

    0,
  );
}

function getRoundEliminationTotals(results: readonly GameState[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const result of results) {
    for (const event of result.eventHistory) {
      const eliminationCount = event.changes.filter(
        (change) => change.type === "eliminate-tribute",
      ).length;

      if (eliminationCount === 0) {
        continue;
      }

      const key = `${event.round.period}-` + `${event.round.day}`;

      totals.set(key, (totals.get(key) ?? 0) + eliminationCount);
    }
  }

  return totals;
}

describe("simulation stress tests", () => {
  it("completes 200 Half Games without violating invariants", () => {
    for (let index = 0; index < 200; index += 1) {
      const result = simulateGame(`half-game-${index}`, 6);

      expectValidVictoryOutcome(result);
    }
  });

  it("completes 100 Full Games without violating invariants", () => {
    for (let index = 0; index < 100; index += 1) {
      const result = simulateGame(`full-game-${index}`, 12);

      expectValidVictoryOutcome(result);
    }
  });

  it("replays the same seed identically", () => {
    const firstResult = simulateGame("repeatable-game", 12);

    const secondResult = simulateGame("repeatable-game", 12);

    expect(firstResult.eventHistory).toEqual(secondResult.eventHistory);

    expect(firstResult.victoryOutcome).toEqual(secondResult.victoryOutcome);
  });

  it("concentrates more than half of all eliminations in the Bloodbath", () => {
    const results = [
      ...Array.from(
        {
          length: 200,
        },

        (_, index) => simulateGame(`half-game-${index}`, 6),
      ),

      ...Array.from(
        {
          length: 100,
        },

        (_, index) => simulateGame(`full-game-${index}`, 12),
      ),
    ];

    const dayOneEliminations = results.reduce(
      (total, result) => total + getEliminationCount(result, 1, "day"),

      0,
    );

    const totalEliminations = results.reduce(
      (total, result) => total + getEliminationCount(result),

      0,
    );

    expect(dayOneEliminations / totalEliminations).toBeGreaterThan(0.5);

    const roundTotals = getRoundEliminationTotals(results);

    const dayOneAverage = dayOneEliminations / results.length;

    for (const [roundKey, eliminationTotal] of roundTotals) {
      if (roundKey === "day-1") {
        continue;
      }

      expect(dayOneAverage).toBeGreaterThan(eliminationTotal / results.length);
    }
  });
});
