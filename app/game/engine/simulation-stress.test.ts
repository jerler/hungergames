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
      return state;
    }
  }

  throw new Error(`Simulation "${seed}" failed to produce a victor.`);
}

describe("simulation stress tests", () => {
  it("completes 200 Half Games without violating invariants", () => {
    for (let index = 0; index < 200; index += 1) {
      const result = simulateGame(`half-game-${index}`, 6);

      expect(selectLivingTributes(result)).toHaveLength(1);

      expect(result.victorTributeId).toBe(selectLivingTributes(result)[0].id);
    }
  });

  it("completes 100 Full Games without violating invariants", () => {
    for (let index = 0; index < 100; index += 1) {
      const result = simulateGame(`full-game-${index}`, 12);

      expect(selectLivingTributes(result)).toHaveLength(1);
    }
  });

  it("replays the same seed identically", () => {
    const firstResult = simulateGame("repeatable-game", 12);

    const secondResult = simulateGame("repeatable-game", 12);

    expect(firstResult.eventHistory).toEqual(secondResult.eventHistory);

    expect(firstResult.victorTributeId).toBe(secondResult.victorTributeId);
  });
});
