import { describe, expect, it } from "vitest";

import {
  getSurvivalNeedStage,
  isSurvivalNeedFatal,
  SURVIVAL_NEED_PROGRESSIONS,
} from "./survival-thresholds";

describe("water survival thresholds", () => {
  it.each([
    {
      rounds: 0,
      expectedStatusId: null,
    },
    {
      rounds: 1,
      expectedStatusId: null,
    },
    {
      rounds: 2,
      expectedStatusId: "thirsty",
    },
    {
      rounds: 3,
      expectedStatusId: "thirsty",
    },
    {
      rounds: 4,
      expectedStatusId: "dehydrated",
    },
    {
      rounds: 5,
      expectedStatusId: "dehydrated",
    },
  ] as const)(
    "uses the correct water stage after $rounds deprived rounds",
    ({ rounds, expectedStatusId }) => {
      expect(getSurvivalNeedStage("water", rounds)?.statusId ?? null).toBe(expectedStatusId);
    },
  );

  it("becomes fatal at six rounds", () => {
    expect(isSurvivalNeedFatal("water", 5)).toBe(false);
    expect(isSurvivalNeedFatal("water", 6)).toBe(true);
  });

  it("declares the 2/4/6 progression", () => {
    expect(SURVIVAL_NEED_PROGRESSIONS.water).toMatchObject({
      stages: [
        {
          minimumRounds: 2,
          statusId: "thirsty",
        },
        {
          minimumRounds: 4,
          statusId: "dehydrated",
        },
      ],

      fatalAtRounds: 6,
    });
  });
});

describe("food survival thresholds", () => {
  it.each([
    {
      rounds: 0,
      expectedStatusId: null,
    },
    {
      rounds: 3,
      expectedStatusId: null,
    },
    {
      rounds: 4,
      expectedStatusId: "hungry",
    },
    {
      rounds: 5,
      expectedStatusId: "hungry",
    },
    {
      rounds: 6,
      expectedStatusId: "starving",
    },
    {
      rounds: 7,
      expectedStatusId: "starving",
    },
  ] as const)(
    "uses the correct food stage after $rounds deprived rounds",
    ({ rounds, expectedStatusId }) => {
      expect(getSurvivalNeedStage("food", rounds)?.statusId ?? null).toBe(expectedStatusId);
    },
  );

  it("remains fatal at eight rounds", () => {
    expect(isSurvivalNeedFatal("food", 7)).toBe(false);
    expect(isSurvivalNeedFatal("food", 8)).toBe(true);
  });
});
