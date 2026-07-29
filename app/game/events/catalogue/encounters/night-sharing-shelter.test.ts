import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { NIGHT_EVENTS } from "~/game/events/catalogue/encounters/night-events";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, RoundReference } from "~/game/types/game-state";

function createGame(): GameState {
  let nextId = 0;

  return createInitialGameState(
    {
      ...createDefaultGameConfig(),
      districtCount: 6,
    },
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
    "random",
    {
      createId: () => {
        nextId += 1;
        return `sharing-shelter-${nextId}`;
      },
      seed: "sharing-shelter-eligibility",
      now: "2026-07-29T12:00:00.000Z",
    },
  );
}

function requireSharingShelterEvent() {
  const event = NIGHT_EVENTS.find((candidate) => candidate.id === "night-sharing-shelter");

  if (!event) {
    throw new Error("Missing night-sharing-shelter event.");
  }

  return event;
}

function isEligible(state: GameState, round: RoundReference): boolean {
  const event = requireSharingShelterEvent();

  return (
    event.isEligible?.({
      state,
      round,
      livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    }) ?? true
  );
}

describe("night-sharing-shelter", () => {
  it("may form a standard truce before Day 4", () => {
    const game = createGame();

    expect(
      isEligible(game, {
        day: 3,
        period: "night",
      }),
    ).toBe(true);
  });

  it("cannot form a standard truce on or after Day 4", () => {
    const game = createGame();

    expect(
      isEligible(game, {
        day: 4,
        period: "night",
      }),
    ).toBe(false);
  });

  it("cannot form a standard truce with fewer than six living tributes", () => {
    const game = createGame();

    const lateGame = {
      ...game,
      tributes: game.tributes.map((tribute, index) => ({
        ...tribute,
        isAlive: index < 5,
      })),
    };

    expect(
      isEligible(lateGame, {
        day: 2,
        period: "night",
      }),
    ).toBe(false);
  });
});
