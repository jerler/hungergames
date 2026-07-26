import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type {
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";

import {
  DEPRIVATION_THRESHOLD_ROUNDS,
  isEligibleForDeprivationStatusEvent,
} from "./survival-history";
import type { SurvivalNeed } from "./survival-schema";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const satisfies RoundReference;

const NIGHT_ONE = {
  day: 1,
  period: "night",
} as const satisfies RoundReference;

const DAY_TWO = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

const DAY_THREE = {
  day: 3,
  period: "day",
} as const satisfies RoundReference;

const NIGHT_THREE = {
  day: 3,
  period: "night",
} as const satisfies RoundReference;

const DAY_FOUR = {
  day: 4,
  period: "day",
} as const satisfies RoundReference;

const NIGHT_FOUR = {
  day: 4,
  period: "night",
} as const satisfies RoundReference;

function withNeedRound(
  tribute: GameTribute,
  need: SurvivalNeed,
  round: RoundReference,
): GameTribute {
  return {
    ...tribute,
    survival: {
      ...tribute.survival,
      ...(need === "food"
        ? {
            lastFoundFoodRound: round,
          }
        : {
            lastFoundWaterRound: round,
          }),
    },
  };
}

function withStatus(
  tribute: GameTribute,
  statusId: "hungry" | "thirsty" | "exhausted",
  round: RoundReference,
): GameTribute {
  return {
    ...tribute,
    statuses: [
      ...tribute.statuses,
      createStatusEffectInstance(`status-${statusId}`, tribute.id, statusId, 1, round),
    ],
  };
}

function createSatisfactionEvent(
  tribute: GameTribute,
  need: SurvivalNeed,
  round: RoundReference,
): ResolvedEvent {
  return {
    id: `satisfy-${need}`,
    definitionId: `test-satisfy-${need}`,
    kind: "primary",
    resolutionMode: "standard",
    round,
    participantTributeIds: [tribute.id],
    text: need === "food" ? `${tribute.snapshot.name} eats.` : `${tribute.snapshot.name} drinks.`,
    changes: [
      {
        type: "satisfy-survival-need",
        tributeId: tribute.id,
        need,
      },
    ],
  };
}

function applySatisfaction(
  tribute: GameTribute,
  need: SurvivalNeed,
  round: RoundReference,
): GameTribute {
  const state: GameState = {
    ...createAuthoringTestGame([tribute]),
    currentRound: round,
  };

  const nextState = applyResolvedEvent(state, createSatisfactionEvent(tribute, need, round));

  const nextTribute = nextState.tributes[0];

  if (!nextTribute) {
    throw new Error("Missing tribute after satisfaction.");
  }

  return nextTribute;
}

describe("deprivation timeline integration", () => {
  it("uses exactly four fully completed rounds", () => {
    expect(DEPRIVATION_THRESHOLD_ROUNDS).toBe(4);

    const tribute = createAuthoringTestTribute();

    expect(
      isEligibleForDeprivationStatusEvent(
        {
          day: 2,
          period: "night",
        },
        tribute,
        "food",
      ),
    ).toBe(false);

    expect(isEligibleForDeprivationStatusEvent(DAY_THREE, tribute, "food")).toBe(true);

    expect(isEligibleForDeprivationStatusEvent(DAY_THREE, tribute, "water")).toBe(true);
  });

  it("distinguishes a protected Cornucopia survivor, a dead entrant, and a fleeing tribute", () => {
    const base = createAuthoringTestTribute();

    const protectedSurvivor = withAuthoringTestItem(
      withNeedRound(withNeedRound(base, "food", DAY_ONE), "water", DAY_ONE),
      "cornucopia-provisions",
    );

    expect(isEligibleForDeprivationStatusEvent(NIGHT_FOUR, protectedSurvivor, "food")).toBe(false);
    expect(isEligibleForDeprivationStatusEvent(NIGHT_FOUR, protectedSurvivor, "water")).toBe(false);

    const deadEntrant: GameTribute = {
      ...base,
      isAlive: false,
      death: {
        round: DAY_ONE,
        causeId: "bloodbath",
        causeLabel: "Killed in the Bloodbath",
        summary: "Test Tribute dies.",
        killerTributeIds: [],
        resolvedEventId: "bloodbath-death",
      },
    };

    expect(isEligibleForDeprivationStatusEvent(NIGHT_FOUR, deadEntrant, "food")).toBe(false);

    const fleeingTribute = {
      ...base,
      inventory: [],
    };

    expect(isEligibleForDeprivationStatusEvent(DAY_THREE, fleeingTribute, "food")).toBe(true);
  });

  it("counts independently from eating on Night 1 and drinking on Day 2", () => {
    const base = createAuthoringTestTribute();

    const fedOnNightOne = withNeedRound(base, "food", NIGHT_ONE);

    expect(isEligibleForDeprivationStatusEvent(NIGHT_THREE, fedOnNightOne, "food")).toBe(false);
    expect(isEligibleForDeprivationStatusEvent(DAY_FOUR, fedOnNightOne, "food")).toBe(true);

    const hydratedOnDayTwo = withNeedRound(base, "water", DAY_TWO);

    expect(isEligibleForDeprivationStatusEvent(DAY_FOUR, hydratedOnDayTwo, "water")).toBe(false);
    expect(isEligibleForDeprivationStatusEvent(NIGHT_FOUR, hydratedOnDayTwo, "water")).toBe(true);
  });

  it.each([
    ["food", "hungry"],
    ["water", "thirsty"],
  ] as const)(
    "clears %s deprivation on satisfaction and permits later eligibility",
    (need, statusId) => {
      const base = createAuthoringTestTribute();
      const deprived = withStatus(base, statusId, DAY_THREE);
      const satisfied = applySatisfaction(deprived, need, DAY_THREE);

      expect(satisfied.statuses.some((status) => status.definitionId === statusId)).toBe(false);
      expect(isEligibleForDeprivationStatusEvent(NIGHT_FOUR, satisfied, need)).toBe(false);

      expect(
        isEligibleForDeprivationStatusEvent(
          {
            day: 5,
            period: "night",
          },
          satisfied,
          need,
        ),
      ).toBe(true);
    },
  );

  it("keeps an overdue tribute eligible across rounds when no deprivation event is rolled", () => {
    const tribute = createAuthoringTestTribute();

    for (const round of [DAY_THREE, NIGHT_THREE, DAY_FOUR, NIGHT_FOUR]) {
      expect(isEligibleForDeprivationStatusEvent(round, tribute, "food")).toBe(true);
    }
  });
});
