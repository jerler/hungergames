import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { GameTribute } from "~/game/types/game-state";

import {
  DEPRIVATION_THRESHOLD_ROUNDS,
  getCompletedRoundSequenceBefore,
  getRoundsSinceNeedSatisfied,
  qualifiesForHungerEvent,
  qualifiesForThirstEvent,
} from "./survival-history";

describe("survival history", () => {
  it("uses four completed rounds as the deprivation threshold", () => {
    expect(DEPRIVATION_THRESHOLD_ROUNDS).toBe(4);

    expect(
      getCompletedRoundSequenceBefore({
        day: 1,
        period: "day",
      }),
    ).toBe(0);

    expect(
      getCompletedRoundSequenceBefore({
        day: 3,
        period: "day",
      }),
    ).toBe(4);
  });

  it("makes a tribute with no food eligible on Day 3", () => {
    const tribute = createAuthoringTestTribute();

    const rounds = [
      {
        round: {
          day: 1,
          period: "day",
        } as const,
        eligible: false,
      },
      {
        round: {
          day: 1,
          period: "night",
        } as const,
        eligible: false,
      },
      {
        round: {
          day: 2,
          period: "day",
        } as const,
        eligible: false,
      },
      {
        round: {
          day: 2,
          period: "night",
        } as const,
        eligible: false,
      },
      {
        round: {
          day: 3,
          period: "day",
        } as const,
        eligible: true,
      },
    ];

    for (const { round, eligible } of rounds) {
      expect(qualifiesForHungerEvent(round, tribute)).toBe(eligible);
    }
  });

  it("delays a Day 1 Cornucopia survivor until Night 3", () => {
    const tribute = createAuthoringTestTribute();
    const suppliedTribute: GameTribute = {
      ...tribute,
      survival: {
        ...tribute.survival,
        lastFoundFoodRound: {
          day: 1,
          period: "day",
        },
        lastFoundWaterRound: {
          day: 1,
          period: "day",
        },
      },
    };

    expect(
      qualifiesForHungerEvent(
        {
          day: 3,
          period: "day",
        },
        suppliedTribute,
      ),
    ).toBe(false);

    expect(
      qualifiesForThirstEvent(
        {
          day: 3,
          period: "night",
        },
        suppliedTribute,
      ),
    ).toBe(true);
  });

  it("counts from the matching resource independently", () => {
    const tribute = createAuthoringTestTribute();
    const currentRound = {
      day: 4,
      period: "day",
    } as const;

    expect(
      getRoundsSinceNeedSatisfied(currentRound, {
        day: 2,
        period: "night",
      }),
    ).toBe(2);

    const fedTribute: GameTribute = {
      ...tribute,
      survival: {
        ...tribute.survival,
        lastFoundFoodRound: {
          day: 2,
          period: "night",
        },
      },
    };

    expect(qualifiesForHungerEvent(currentRound, fedTribute)).toBe(false);

    expect(qualifiesForThirstEvent(currentRound, fedTribute)).toBe(true);
  });

  it("rejects dead tributes and tributes with the matching status", () => {
    const round = {
      day: 3,
      period: "day",
    } as const;

    const baseTribute = createAuthoringTestTribute();

    const deadTribute: GameTribute = {
      ...baseTribute,
      isAlive: false,
      death: {
        round: {
          day: 2,
          period: "night",
        },
        causeId: "test",
        causeLabel: "Test",
        summary: "Test Tribute dies.",
        killerTributeIds: [],
        resolvedEventId: "test-death",
      },
    };

    expect(qualifiesForHungerEvent(round, deadTribute)).toBe(false);

    const hungryTribute: GameTribute = {
      ...baseTribute,
      statuses: [createStatusEffectInstance("existing-hunger", baseTribute.id, "hungry", 1, round)],
    };

    expect(qualifiesForHungerEvent(round, hungryTribute)).toBe(false);

    expect(qualifiesForThirstEvent(round, hungryTribute)).toBe(true);
  });
});
