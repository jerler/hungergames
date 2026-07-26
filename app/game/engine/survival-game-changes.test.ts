import { describe, expect, it } from "vitest";

import { applyGameChange } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type {
  GameState,
  ResolvedEvent,
  RoundReference,
  SatisfySurvivalNeedChange,
} from "~/game/types/game-state";

const NIGHT_TWO = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

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
    kind: "primary",
    resolutionMode: "standard",
    round,
    participantTributeIds: [tributeId],
    text: "A survival need is resolved.",
    changes: [],
  };
}

function satisfyNeed(
  state: GameState,
  change: SatisfySurvivalNeedChange,
  eventRound: RoundReference = NIGHT_TWO,
): GameState {
  return applyGameChange(state, change, createEvent(change.tributeId, eventRound));
}

describe("survival game changes", () => {
  it("records the round in which food is satisfied", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const nextState = satisfyNeed(game, {
      type: "satisfy-survival-need",
      tributeId: tribute.id,
      need: "food",
    });

    expect(nextState.tributes[0].survival.lastFoundFoodRound).toEqual(NIGHT_TWO);
    expect(nextState.tributes[0].survival.lastFoundWaterRound).toBeNull();
    expect(game.tributes[0].survival.lastFoundFoodRound).toBeNull();
  });

  it("records food and water independently", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const afterFood = satisfyNeed(
      game,
      {
        type: "satisfy-survival-need",
        tributeId: tribute.id,
        need: "food",
      },
      {
        day: 2,
        period: "day",
      },
    );

    const afterWater = satisfyNeed(afterFood, {
      type: "satisfy-survival-need",
      tributeId: tribute.id,
      need: "water",
    });

    expect(afterWater.tributes[0].survival).toMatchObject({
      lastFoundFoodRound: {
        day: 2,
        period: "day",
      },
      lastFoundWaterRound: NIGHT_TWO,
      lastNightRest: null,
    });
  });

  it("records the result of a night rest without changing need history", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const nextState = applyGameChange(
      game,
      {
        type: "record-night-rest",
        tributeId: tribute.id,
        round: NIGHT_TWO,
        quality: "sheltered",
      },
      createEvent(tribute.id),
    );

    expect(nextState.tributes[0].survival).toEqual({
      lastFoundFoodRound: null,
      lastFoundWaterRound: null,
      lastNightRest: {
        round: NIGHT_TWO,
        quality: "sheltered",
      },
    });
  });

  it("rejects rest recorded during a day round", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const dayRound = {
      day: 2,
      period: "day",
    } as const satisfies RoundReference;

    expect(() =>
      applyGameChange(
        game,
        {
          type: "record-night-rest",
          tributeId: tribute.id,
          round: dayRound,
          quality: "unsheltered",
        },
        createEvent(tribute.id, dayRound),
      ),
    ).toThrow(/valid night round/i);
  });

  it("rejects rest recorded for a different round", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    expect(() =>
      applyGameChange(
        game,
        {
          type: "record-night-rest",
          tributeId: tribute.id,
          round: NIGHT_TWO,
          quality: "comfortable",
        },
        createEvent(tribute.id, {
          day: 3,
          period: "night",
        }),
      ),
    ).toThrow(/does not match event/i);
  });
});
