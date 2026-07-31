import { describe, expect, it } from "vitest";

import { createTruceInstance, STANDARD_TRUCE_EXPIRY_ROUND } from "~/game/truces/truce-engine";

describe("standard truce expiry compatibility metadata", () => {
  it("normalizes the historical Day 4 marker for a late Day formation", () => {
    const truce = createTruceInstance(
      "late-day-truce",
      ["tribute-1", "tribute-2"],
      {
        day: 5,
        period: "day",
      },
      STANDARD_TRUCE_EXPIRY_ROUND,
    );

    expect(truce.expiresAfterRound).toEqual({
      day: 8,
      period: "day",
    });
  });

  it("normalizes the historical Day 4 marker for a late Night formation", () => {
    const truce = createTruceInstance(
      "late-night-truce",
      ["tribute-1", "tribute-2"],
      {
        day: 4,
        period: "night",
      },
      STANDARD_TRUCE_EXPIRY_ROUND,
    );

    expect(truce.expiresAfterRound).toEqual({
      day: 7,
      period: "night",
    });
  });

  it("preserves an already-valid future metadata round", () => {
    const truce = createTruceInstance(
      "future-expiry-truce",
      ["tribute-1", "tribute-2"],
      {
        day: 5,
        period: "day",
      },
      {
        day: 9,
        period: "night",
      },
    );

    expect(truce.expiresAfterRound).toEqual({
      day: 9,
      period: "night",
    });
  });

  it("continues rejecting a standard truce with no compatibility metadata", () => {
    expect(() =>
      createTruceInstance(
        "missing-expiry-truce",
        ["tribute-1", "tribute-2"],
        {
          day: 5,
          period: "day",
        },
        null,
      ),
    ).toThrow(/standard truce requires an expiry round/i);
  });
});
