import { describe, expect, it } from "vitest";

import { formatRoundLabel, getNextRound } from "./rounds";

describe("round progression", () => {
  it("starts with Day 1", () => {
    expect(getNextRound(null)).toEqual({
      day: 1,
      period: "day",
    });
  });

  it("moves from Day to Night", () => {
    expect(
      getNextRound({
        day: 2,
        period: "day",
      }),
    ).toEqual({
      day: 2,
      period: "night",
    });
  });

  it("moves from Night to the following Day", () => {
    expect(
      getNextRound({
        day: 2,
        period: "night",
      }),
    ).toEqual({
      day: 3,
      period: "day",
    });
  });

  it("formats round labels", () => {
    expect(
      formatRoundLabel({
        day: 4,
        period: "night",
      }),
    ).toBe("Night 4");
  });
});
