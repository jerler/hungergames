import { describe, expect, it } from "vitest";

import { applyGameChange } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type {
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
  SatisfySurvivalNeedChange,
  StatusEffect,
} from "~/game/types/game-state";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

const NIGHT_TWO = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

const NIGHT_ONE = {
  day: 1,
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

function createStatus(
  tributeId: string,
  statusId: StatusEffect["definitionId"],
  instanceId: string,
): StatusEffect {
  return createStatusEffectInstance(instanceId, tributeId, statusId, 1, DAY_TWO);
}

function replaceTribute(state: GameState, tribute: GameTribute): GameState {
  return {
    ...state,
    tributes: state.tributes.map((candidate) =>
      candidate.id === tribute.id ? tribute : candidate,
    ),
  };
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

  it("eating clears every hungry instance and preserves unrelated state", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const hungryOne = createStatus(tribute.id, "hungry", "hungry-one");

    const hungryTwo = createStatus(tribute.id, "hungry", "hungry-two");

    const thirsty = createStatus(tribute.id, "thirsty", "existing-thirst");

    const injured = createStatus(tribute.id, "injured", "existing-injury");

    const preparedTribute: GameTribute = {
      ...tribute,
      survival: {
        ...tribute.survival,
        lastNightRest: {
          round: NIGHT_ONE,
          quality: "sheltered",
        },
      },
      statuses: [hungryOne, thirsty, injured, hungryTwo],
    };

    const preparedGame = replaceTribute(game, preparedTribute);

    const nextState = satisfyNeed(preparedGame, {
      type: "satisfy-survival-need",
      tributeId: tribute.id,
      need: "food",
    });

    const updatedTribute = nextState.tributes[0];

    expect(updatedTribute.statuses.map((status) => status.definitionId)).toEqual([
      "thirsty",
      "injured",
    ]);

    expect(updatedTribute.survival).toEqual({
      lastFoundFoodRound: NIGHT_TWO,
      lastFoundWaterRound: null,
      lastNightRest: {
        round: NIGHT_ONE,
        quality: "sheltered",
      },
    });

    expect(updatedTribute.inventory).toEqual(preparedTribute.inventory);

    expect(nextState.itemTransactions).toEqual(preparedGame.itemTransactions);
  });

  it("drinking clears only thirst and preserves hunger and rest", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const hungry = createStatus(tribute.id, "hungry", "existing-hunger");

    const thirsty = createStatus(tribute.id, "thirsty", "existing-thirst");

    const wellRested = createStatus(tribute.id, "well-rested", "existing-rest-benefit");

    const preparedTribute: GameTribute = {
      ...tribute,
      survival: {
        ...tribute.survival,
        lastFoundFoodRound: DAY_TWO,
        lastNightRest: {
          round: NIGHT_ONE,
          quality: "comfortable",
        },
      },
      statuses: [hungry, thirsty, wellRested],
    };

    const nextState = satisfyNeed(replaceTribute(game, preparedTribute), {
      type: "satisfy-survival-need",
      tributeId: tribute.id,
      need: "water",
    });

    const updatedTribute = nextState.tributes[0];

    expect(updatedTribute.statuses.map((status) => status.definitionId)).toEqual([
      "hungry",
      "well-rested",
    ]);

    expect(updatedTribute.survival).toEqual({
      lastFoundFoodRound: DAY_TWO,
      lastFoundWaterRound: NIGHT_TWO,
      lastNightRest: {
        round: NIGHT_ONE,
        quality: "comfortable",
      },
    });
  });

  it("treats repeated need satisfaction as harmless", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const firstState = satisfyNeed(game, {
      type: "satisfy-survival-need",
      tributeId: tribute.id,
      need: "food",
    });

    const secondState = satisfyNeed(firstState, {
      type: "satisfy-survival-need",
      tributeId: tribute.id,
      need: "food",
    });

    expect(secondState).toEqual(firstState);
  });

  it("rejects satisfying a need for a dead tribute", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    const deadTribute: GameTribute = {
      ...tribute,
      isAlive: false,
      death: {
        round: DAY_TWO,
        causeId: "test-death",
        causeLabel: "Test death",
        summary: `${tribute.snapshot.name} dies during test setup.`,
        killerTributeIds: [],
        resolvedEventId: "test-death-event",
      },
    };

    expect(() =>
      satisfyNeed(replaceTribute(game, deadTribute), {
        type: "satisfy-survival-need",
        tributeId: deadTribute.id,
        need: "water",
      }),
    ).toThrow(/dead tribute.*cannot satisfy.*water/i);
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

    expect(() =>
      applyGameChange(
        game,
        {
          type: "record-night-rest",
          tributeId: tribute.id,
          round: DAY_TWO,
          quality: "unsheltered",
        },
        createEvent(tribute.id, DAY_TWO),
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
