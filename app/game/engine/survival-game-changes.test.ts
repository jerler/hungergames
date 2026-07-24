import { describe, expect, it } from "vitest";

import { applyGameChange } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameChange, GameState, ResolvedEvent, RoundReference } from "~/game/types/game-state";

const NIGHT_TWO = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

type SurvivalGameChange = Extract<
  GameChange,
  {
    type:
      | "set-survival-need-counter"
      | "increment-survival-need-counter"
      | "satisfy-survival-need"
      | "record-night-rest";
  }
>;

function createGame(): GameState {
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
        return `survival-change-id-${nextId}`;
      },
      seed: "survival-change-tests",
      now: "2026-07-23T12:00:00.000Z",
    },
  );
}

function createEvent(tributeId: string, round: RoundReference = NIGHT_TWO): ResolvedEvent {
  return {
    id: `survival-change:${round.period}:${round.day}:${tributeId}`,
    definitionId: "test-survival-change",
    kind: "need-resolution",
    resolutionMode: "standard",
    round,
    participantTributeIds: [tributeId],
    text: "A survival need is resolved.",
    changes: [],
  };
}

function applySurvivalChange(
  state: GameState,
  change: SurvivalGameChange,
  eventRound: RoundReference = NIGHT_TWO,
): GameState {
  return applyGameChange(state, change, createEvent(change.tributeId, eventRound));
}

describe("survival game changes", () => {
  it("sets a survival need counter", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const nextState = applySurvivalChange(game, {
      type: "set-survival-need-counter",
      tributeId: tribute.id,
      need: "food",
      value: 3,
    });

    expect(nextState.tributes[0].survival).toEqual({
      roundsWithoutFood: 3,
      roundsWithoutWater: 0,
      lastNightRest: null,
    });

    expect(game.tributes[0].survival.roundsWithoutFood).toBe(0);
  });

  it("increments a survival need counter", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const nextState = applySurvivalChange(game, {
      type: "increment-survival-need-counter",
      tributeId: tribute.id,
      need: "water",
      amount: 2,
    });

    expect(nextState.tributes[0].survival.roundsWithoutWater).toBe(2);
    expect(nextState.tributes[0].survival.roundsWithoutFood).toBe(0);
  });

  it("satisfies a survival need by resetting its counter", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const hungryState = applySurvivalChange(game, {
      type: "set-survival-need-counter",
      tributeId: tribute.id,
      need: "food",
      value: 4,
    });

    const satisfiedState = applySurvivalChange(hungryState, {
      type: "satisfy-survival-need",
      tributeId: tribute.id,
      need: "food",
    });

    expect(satisfiedState.tributes[0].survival.roundsWithoutFood).toBe(0);
  });

  it("records the result of a night rest", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const nextState = applySurvivalChange(game, {
      type: "record-night-rest",
      tributeId: tribute.id,
      round: NIGHT_TWO,
      quality: "sheltered",
    });

    expect(nextState.tributes[0].survival.lastNightRest).toEqual({
      round: NIGHT_TWO,
      quality: "sheltered",
    });
  });

  it("rejects a negative survival counter", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    expect(() =>
      applySurvivalChange(game, {
        type: "set-survival-need-counter",
        tributeId: tribute.id,
        need: "food",
        value: -1,
      }),
    ).toThrow(/non-negative integer/i);
  });

  it("rejects a non-positive counter increment", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    expect(() =>
      applySurvivalChange(game, {
        type: "increment-survival-need-counter",
        tributeId: tribute.id,
        need: "water",
        amount: 0,
      }),
    ).toThrow(/positive integer/i);
  });

  it("rejects rest recorded during a day round", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const dayRound = {
      day: 2,
      period: "day",
    } as const satisfies RoundReference;

    expect(() =>
      applySurvivalChange(
        game,
        {
          type: "record-night-rest",
          tributeId: tribute.id,
          round: dayRound,
          quality: "unsheltered",
        },
        dayRound,
      ),
    ).toThrow(/valid night round/i);
  });

  it("rejects rest recorded for a different round", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    expect(() =>
      applySurvivalChange(
        game,
        {
          type: "record-night-rest",
          tributeId: tribute.id,
          round: NIGHT_TWO,
          quality: "comfortable",
        },
        {
          day: 3,
          period: "night",
        },
      ),
    ).toThrow(/does not match event/i);
  });
});
