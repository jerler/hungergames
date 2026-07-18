import { describe, expect, it } from "vitest";

import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";

import { createInitialGameState } from "./create-initial-game-state";
import { resolveRound } from "./resolve-round";

function createTestGame() {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  return createInitialGameState(
    config,
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
    "random",
    {
      createId: (() => {
        let nextId = 0;

        return () => {
          nextId += 1;
          return `id-${nextId}`;
        };
      })(),

      now: "2026-07-18T12:00:00.000Z",
      seed: "deterministic-game",
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

  it("eliminates at least one tribute but not every tribute", () => {
    const state = createTestGame();

    const events = resolveRound(state, {
      day: 1,
      period: "day",
    });

    const eliminationCount = events.flatMap((event) => event.changes).length;

    expect(eliminationCount).toBeGreaterThan(0);

    expect(eliminationCount).toBeLessThan(state.tributes.length);
  });
});
