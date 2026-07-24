import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";

import { getNaturalShelterScore, resolveNaturalShelterCheck } from "./natural-shelter";

describe("natural shelter", () => {
  it("weights Brains and Luck more heavily than Brawn", () => {
    const thoughtfulTribute = createAuthoringTestTribute({
      stats: {
        brains: 5,
        brawn: 1,
        luck: 5,
      },
    });

    const strongTribute = createAuthoringTestTribute({
      stats: {
        brains: 1,
        brawn: 5,
        luck: 1,
      },
    });

    expect(getNaturalShelterScore(thoughtfulTribute)).toBeGreaterThan(
      getNaturalShelterScore(strongTribute),
    );
  });

  it("can produce sheltered rest", () => {
    const tribute = createAuthoringTestTribute({
      stats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },
    });

    expect(resolveNaturalShelterCheck(tribute, () => 0.99)).toBe("exceptional-success");
  });

  it("can fail and leave the tribute unsheltered", () => {
    const tribute = createAuthoringTestTribute({
      stats: {
        brains: 1,
        brawn: 1,
        luck: 1,
      },
    });

    expect(resolveNaturalShelterCheck(tribute, () => 0)).toBe("critical-failure");
  });

  it("is deterministic for the same random source", () => {
    const tribute = createAuthoringTestTribute();

    expect(resolveNaturalShelterCheck(tribute, () => 0.42)).toBe(
      resolveNaturalShelterCheck(tribute, () => 0.42),
    );
  });
});
