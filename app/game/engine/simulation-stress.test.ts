import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { createSeededRandom } from "~/game/engine/random";
import { selectLivingTributes } from "~/game/selectors/game-selectors";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import type { DistrictCount } from "~/game/types/game-config";
import { createDefaultGameConfig } from "~/game/types/game-config";
import { gameReducer } from "~/state/game-reducer";
import { getCommittedItemInstanceIds } from "~/game/items/item-reservations";
import type { GameChange, GameState, ResolvedEvent } from "~/game/types/game-state";

const simulationCache = new Map<string, GameState>();

type TransferItemChange = Extract<
  GameChange,
  {
    type: "transfer-item";
  }
>;

interface SimulateGameOptions {
  useCache?: boolean;
}

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
function expectNoCrossEventItemCommitments(events: readonly ResolvedEvent[], seed: string): void {
  const eventIdByItemInstanceId = new Map<string, string>();

  for (const event of events) {
    /*
     * One event may reference the same item more than once
     * internally. The conflict being tested is commitment
     * by two separate events in the same planned round.
     */
    const eventItemInstanceIds = new Set(getCommittedItemInstanceIds(event.changes));

    for (const itemInstanceId of eventItemInstanceIds) {
      const previousEventId = eventIdByItemInstanceId.get(itemInstanceId);

      expect(
        previousEventId,

        `Simulation "${seed}" committed item ` +
          `"${itemInstanceId}" in both ` +
          `"${previousEventId}" and ` +
          `"${event.id}".`,
      ).toBeUndefined();

      eventIdByItemInstanceId.set(itemInstanceId, event.id);
    }
  }
}

function simulateGame(
  seed: string,
  districtCount: DistrictCount,
  { useCache = true }: SimulateGameOptions = {},
): GameState {
  const cacheKey = `${districtCount}:${seed}`;

  if (useCache) {
    const cachedResult = simulationCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }
  }

  let state: GameState | null = createSimulationGame(seed, districtCount);

  assertGameStateInvariants(state);

  for (let roundIndex = 0; roundIndex < 100; roundIndex += 1) {
    state = gameReducer(state, {
      type: "round/began",

      now: `round-${roundIndex}-start`,
    });

    if (!state) {
      throw new Error(`Simulation "${seed}" lost its GameState while beginning a round.`);
    }

    expectNoCrossEventItemCommitments(state.roundEvents, seed);

    state = gameReducer(state, {
      type: "round/revealed",

      now: `round-${roundIndex}-end`,
    });

    if (!state) {
      throw new Error(`Simulation "${seed}" lost its GameState while revealing a round.`);
    }

    assertGameStateInvariants(state);

    if (state.phase === "victory") {
      if (useCache) {
        simulationCache.set(cacheKey, state);
      }

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

function getStressResults(): GameState[] {
  return [
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

  it("independently replays the same seed identically", () => {
    const firstResult = simulateGame("repeatable-game", 12, {
      useCache: false,
    });

    const secondResult = simulateGame("repeatable-game", 12, {
      useCache: false,
    });

    /*
     * Prove these are two separately simulated objects,
     * not the same cached result.
     */
    expect(firstResult).not.toBe(secondResult);

    expect(secondResult).toEqual(firstResult);
  });

  it("concentrates more than half of all eliminations in the Bloodbath", () => {
    const results = getStressResults();

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

  it("exercises ordinary theft during full-game simulations", () => {
    const theftEvents = getStressResults().flatMap((result) =>
      result.eventHistory.filter((event) => event.definitionId === "steal-from-stronger-tribute"),
    );

    expect(theftEvents.length).toBeGreaterThan(0);

    for (const event of theftEvents) {
      /*
       * Day 1 daytime belongs exclusively to the
       * Bloodbath sequencer.
       */
      expect(event.round.day === 1 && event.round.period === "day").toBe(false);

      const theftTransfers = event.changes.filter(
        (change): change is TransferItemChange =>
          change.type === "transfer-item" && change.reason === "theft",
      );

      expect(theftTransfers.length).toBeLessThanOrEqual(2);

      expect(new Set(theftTransfers.map((change) => change.itemInstanceId)).size).toBe(
        theftTransfers.length,
      );
    }
  });
});
