import { describe, expect, it } from "vitest";

import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { GameState, GameTribute } from "~/game/types/game-state";

import {
  advanceSurvivalNeedsAfterRound,
  synchronizeSurvivalNeedStatuses,
} from "./survival-needs-engine";

const PREVIOUS_ROUND = {
  day: 1,
  period: "night",
} as const;

function getStatusIds(tribute: GameTribute): string[] {
  return tribute.statuses.map((status) => status.definitionId);
}

function createCompletedNightGame(
  tributes: Parameters<typeof createAuthoringTestGame>[0],
): GameState {
  return {
    ...createAuthoringTestGame(tributes),

    currentRound: PREVIOUS_ROUND,
  };
}

function createGameWithCounters({
  roundsWithoutFood = 0,
  roundsWithoutWater = 0,
}: {
  roundsWithoutFood?: number;
  roundsWithoutWater?: number;
} = {}): GameState {
  const tribute = createAuthoringTestTribute();

  const game = createAuthoringTestGame([
    {
      ...tribute,

      survival: {
        ...tribute.survival,
        roundsWithoutFood,
        roundsWithoutWater,
      },
    },
  ]);

  return {
    ...game,
    currentRound: PREVIOUS_ROUND,
  };
}

function requireFirstTribute(state: GameState): GameTribute {
  const tribute = state.tributes[0];

  if (!tribute) {
    throw new Error("Expected a tribute fixture.");
  }

  return tribute;
}

describe("advanceSurvivalNeedsAfterRound", () => {
  it("applies no water status after one day without water", () => {
    const advanced = advanceSurvivalNeedsAfterRound(createGameWithCounters());

    const tribute = requireFirstTribute(advanced);

    expect(tribute.survival.roundsWithoutWater).toBe(1);

    expect(getStatusIds(tribute)).not.toContain("thirsty");
    expect(getStatusIds(tribute)).not.toContain("dehydrated");
  });

  it("applies thirsty after two days without water", () => {
    const advanced = advanceSurvivalNeedsAfterRound(
      createGameWithCounters({
        roundsWithoutWater: 1,
      }),
    );

    const tribute = requireFirstTribute(advanced);

    expect(tribute.survival.roundsWithoutWater).toBe(2);

    expect(getStatusIds(tribute)).toContain("thirsty");
    expect(getStatusIds(tribute)).not.toContain("dehydrated");
  });

  it("replaces thirsty with dehydrated after four days without water", () => {
    const baseTribute = createAuthoringTestTribute();

    const thirsty = createStatusEffectInstance(
      "existing-thirst",
      baseTribute.id,
      "thirsty",
      1,
      PREVIOUS_ROUND,
    );

    const game = createCompletedNightGame([
      {
        ...baseTribute,

        survival: {
          ...baseTribute.survival,
          roundsWithoutWater: 3,
        },

        statuses: [thirsty],
      },
    ]);

    const advanced = advanceSurvivalNeedsAfterRound(game);
    const tribute = requireFirstTribute(advanced);

    expect(tribute.survival.roundsWithoutWater).toBe(4);

    expect(getStatusIds(tribute)).toContain("dehydrated");
    expect(getStatusIds(tribute)).not.toContain("thirsty");
  });

  it.each([0, 1, 2])(
    "applies no food status after advancing from %s deprived days",
    (startingRounds) => {
      const advanced = advanceSurvivalNeedsAfterRound(
        createGameWithCounters({
          roundsWithoutFood: startingRounds,
        }),
      );

      const tribute = requireFirstTribute(advanced);

      expect(tribute.survival.roundsWithoutFood).toBe(startingRounds + 1);

      expect(getStatusIds(tribute)).not.toContain("hungry");

      expect(getStatusIds(tribute)).not.toContain("starving");
    },
  );

  it("applies hungry after four days without food", () => {
    const advanced = advanceSurvivalNeedsAfterRound(
      createGameWithCounters({
        roundsWithoutFood: 3,
      }),
    );

    const tribute = requireFirstTribute(advanced);

    expect(tribute.survival.roundsWithoutFood).toBe(4);

    expect(getStatusIds(tribute)).toContain("hungry");

    expect(getStatusIds(tribute)).not.toContain("starving");
  });

  it("replaces hungry with starving after six days without food", () => {
    const baseTribute = createAuthoringTestTribute();

    const hungry = createStatusEffectInstance(
      "existing-hunger",
      baseTribute.id,
      "hungry",
      1,
      PREVIOUS_ROUND,
    );

    const game = createCompletedNightGame([
      {
        ...baseTribute,

        survival: {
          ...baseTribute.survival,
          roundsWithoutFood: 5,
        },

        statuses: [hungry],
      },
    ]);

    const advanced = advanceSurvivalNeedsAfterRound(game);

    const tribute = requireFirstTribute(advanced);

    expect(tribute.survival.roundsWithoutFood).toBe(6);

    expect(getStatusIds(tribute)).toContain("starving");

    expect(getStatusIds(tribute)).not.toContain("hungry");
  });

  it("advances both needs during the same completed round", () => {
    const advanced = advanceSurvivalNeedsAfterRound(
      createGameWithCounters({
        roundsWithoutFood: 3,
        roundsWithoutWater: 1,
      }),
    );

    const tribute = requireFirstTribute(advanced);

    expect(tribute.survival).toMatchObject({
      roundsWithoutFood: 4,
      roundsWithoutWater: 2,
    });

    expect(getStatusIds(tribute)).toEqual(expect.arrayContaining(["hungry", "thirsty"]));
  });

  it("does not advance needs when a daytime round completes", () => {
    const nightReadyState = createGameWithCounters({
      roundsWithoutFood: 3,
      roundsWithoutWater: 1,
    });

    const daytimeState: GameState = {
      ...nightReadyState,
      currentRound: AUTHORING_TEST_ROUND,
    };

    expect(advanceSurvivalNeedsAfterRound(daytimeState)).toBe(daytimeState);
  });

  it("does not advance dead tributes", () => {
    const baseTribute = createAuthoringTestTribute();

    const deadTribute: GameTribute = {
      ...baseTribute,

      isAlive: false,

      death: {
        round: PREVIOUS_ROUND,

        causeId: "test-death",
        causeLabel: "Test death",
        summary: "Test Tribute died.",

        killerTributeIds: [],

        resolvedEventId: "test-death-event",
      },

      survival: {
        ...baseTribute.survival,

        roundsWithoutFood: 3,
        roundsWithoutWater: 1,
      },
    };

    const game = createCompletedNightGame([deadTribute]);

    const advanced = advanceSurvivalNeedsAfterRound(game);

    expect(advanced.tributes[0]).toEqual(deadTribute);
  });

  it("returns unchanged state when no current round exists", () => {
    const game = createGameWithCounters();

    const openingState: GameState = {
      ...game,
      phase: "opening",
      currentRound: null,
    };

    expect(advanceSurvivalNeedsAfterRound(openingState)).toBe(openingState);
  });
});

describe("synchronizeSurvivalNeedStatuses", () => {
  it("removes hydration statuses when the water counter is zero", () => {
    const baseTribute = createAuthoringTestTribute();

    const tribute: GameTribute = {
      ...baseTribute,

      statuses: [
        createStatusEffectInstance("stale-thirst", baseTribute.id, "thirsty", 1, PREVIOUS_ROUND),

        createStatusEffectInstance(
          "stale-dehydration",
          baseTribute.id,
          "dehydrated",
          1,
          PREVIOUS_ROUND,
        ),
      ],
    };

    const synchronized = synchronizeSurvivalNeedStatuses(tribute, AUTHORING_TEST_ROUND);

    expect(getStatusIds(synchronized)).not.toContain("thirsty");

    expect(getStatusIds(synchronized)).not.toContain("dehydrated");
  });

  it("removes food statuses when the food counter is below its first threshold", () => {
    const baseTribute = createAuthoringTestTribute();

    const tribute: GameTribute = {
      ...baseTribute,

      survival: {
        ...baseTribute.survival,
        roundsWithoutFood: 3,
      },

      statuses: [
        createStatusEffectInstance("stale-hunger", baseTribute.id, "hungry", 1, PREVIOUS_ROUND),

        createStatusEffectInstance(
          "stale-starvation",
          baseTribute.id,
          "starving",
          1,
          PREVIOUS_ROUND,
        ),
      ],
    };

    const synchronized = synchronizeSurvivalNeedStatuses(tribute, AUTHORING_TEST_ROUND);

    expect(getStatusIds(synchronized)).not.toContain("hungry");

    expect(getStatusIds(synchronized)).not.toContain("starving");
  });

  it.each([
    {
      roundsWithoutFood: 4,

      expectedStatusId: "hungry",
    },

    {
      roundsWithoutFood: 6,

      expectedStatusId: "starving",
    },
  ] as const)(
    "replaces well-fed with $expectedStatusId when food deprivation reaches $roundsWithoutFood rounds",
    ({ roundsWithoutFood, expectedStatusId }) => {
      const baseTribute = createAuthoringTestTribute();

      const wellFed = createStatusEffectInstance(
        "existing-well-fed",
        baseTribute.id,
        "well-fed",
        1,
        PREVIOUS_ROUND,
      );

      const tribute: GameTribute = {
        ...baseTribute,

        survival: {
          ...baseTribute.survival,
          roundsWithoutFood,
        },

        statuses: [wellFed],
      };

      const synchronized = synchronizeSurvivalNeedStatuses(tribute, AUTHORING_TEST_ROUND);

      expect(getStatusIds(synchronized)).toContain(expectedStatusId);

      expect(getStatusIds(synchronized)).not.toContain("well-fed");
    },
  );

  it("keeps only the counter-appropriate stage when need stages coexist", () => {
    const baseTribute = createAuthoringTestTribute();

    const tribute: GameTribute = {
      ...baseTribute,

      survival: {
        ...baseTribute.survival,

        roundsWithoutFood: 6,
        roundsWithoutWater: 4,
      },

      statuses: [
        createStatusEffectInstance(
          "coexisting-thirst",
          baseTribute.id,
          "thirsty",
          1,
          PREVIOUS_ROUND,
        ),

        createStatusEffectInstance(
          "coexisting-dehydration",
          baseTribute.id,
          "dehydrated",
          1,
          PREVIOUS_ROUND,
        ),

        createStatusEffectInstance(
          "coexisting-hunger",
          baseTribute.id,
          "hungry",
          1,
          PREVIOUS_ROUND,
        ),

        createStatusEffectInstance(
          "coexisting-starvation",
          baseTribute.id,
          "starving",
          1,
          PREVIOUS_ROUND,
        ),
      ],
    };

    const synchronized = synchronizeSurvivalNeedStatuses(tribute, AUTHORING_TEST_ROUND);

    expect(getStatusIds(synchronized)).toEqual(["dehydrated", "starving"]);
  });

  it("preserves an already-correct status instance", () => {
    const baseTribute = createAuthoringTestTribute();

    const thirsty = createStatusEffectInstance(
      "original-thirst",
      baseTribute.id,
      "thirsty",
      1,
      PREVIOUS_ROUND,
    );

    const tribute: GameTribute = {
      ...baseTribute,

      survival: {
        ...baseTribute.survival,
        roundsWithoutWater: 2,
      },

      statuses: [thirsty],
    };

    const synchronized = synchronizeSurvivalNeedStatuses(tribute, AUTHORING_TEST_ROUND);

    expect(synchronized).toBe(tribute);

    expect(synchronized.statuses[0]).toBe(thirsty);
  });

  it("is deterministic for equivalent tribute state", () => {
    const tribute = createAuthoringTestTribute({
      id: "deterministic-needs",
    });

    const withCounters: GameTribute = {
      ...tribute,

      survival: {
        ...tribute.survival,

        roundsWithoutFood: 6,
        roundsWithoutWater: 2,
      },
    };

    expect(synchronizeSurvivalNeedStatuses(withCounters, AUTHORING_TEST_ROUND)).toEqual(
      synchronizeSurvivalNeedStatuses(withCounters, AUTHORING_TEST_ROUND),
    );
  });
});
