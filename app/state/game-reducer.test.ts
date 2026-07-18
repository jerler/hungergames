import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { selectLivingTributes } from "~/game/selectors/game-selectors";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState } from "~/game/types/game-state";

import { gameReducer } from "./game-reducer";

function createTestGame(): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
    "random",
    {
      createId: () => {
        nextId += 1;
        return `id-${nextId}`;
      },
      now: "2026-07-18T12:00:00.000Z",
      seed: "complete-game-seed",
    },
  );
}

function completeGame(initialState: GameState): GameState {
  let state: GameState | null = initialState;

  for (let roundIndex = 0; roundIndex < 20; roundIndex += 1) {
    state = gameReducer(state, {
      type: "round/began",
      now: `2026-07-18T12:${String(roundIndex).padStart(2, "0")}:00.000Z`,
    });

    state = gameReducer(state, {
      type: "round/revealed",
      now: `2026-07-18T12:${String(roundIndex).padStart(2, "0")}:30.000Z`,
    });

    if (!state) {
      throw new Error("The Game unexpectedly disappeared.");
    }

    if (state.phase === "victory") {
      return state;
    }
  }

  throw new Error("The Game did not produce a victor within 20 rounds.");
}

describe("gameReducer", () => {
  it("reveals events and eliminates tributes", () => {
    const initialState = createTestGame();

    const roundState = gameReducer(initialState, {
      type: "round/began",
      now: "2026-07-18T13:00:00.000Z",
    });

    expect(roundState?.phase).toBe("round-events");

    const revealedState = gameReducer(roundState, {
      type: "round/revealed",
      now: "2026-07-18T13:01:00.000Z",
    });

    expect(revealedState?.eventHistory.length).toBeGreaterThan(0);

    expect(revealedState ? selectLivingTributes(revealedState).length : 0).toBeLessThan(
      initialState.tributes.length,
    );
  });

  it("runs deterministically until one victor remains", () => {
    const firstResult = completeGame(createTestGame());

    const secondResult = completeGame(createTestGame());

    expect(firstResult.phase).toBe("victory");

    expect(selectLivingTributes(firstResult)).toHaveLength(1);

    expect(firstResult.victorTributeId).toBe(selectLivingTributes(firstResult)[0].id);

    expect(firstResult.eventHistory).toEqual(secondResult.eventHistory);

    expect(firstResult.victorTributeId).toBe(secondResult.victorTributeId);
  });

  it("never eliminates a tribute twice", () => {
    const result = completeGame(createTestGame());

    const eliminatedTributeIds = result.eventHistory.flatMap((event) =>
      event.changes.map((change) => change.tributeId),
    );

    expect(new Set(eliminatedTributeIds).size).toBe(eliminatedTributeIds.length);
  });
});
