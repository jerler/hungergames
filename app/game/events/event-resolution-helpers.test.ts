import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";

import {
  resolveLuckAdjustedBestStatCheck,
  resolveLuckAdjustedStatCheck,
} from "./event-resolution-helpers";

describe("resolveLuckAdjustedBestStatCheck", () => {
  it("uses Brains when it is higher", () => {
    const tribute = createAuthoringTestTribute({
      stats: {
        brains: 5,
        brawn: 1,
        luck: 3,
      },
    });

    expect(resolveLuckAdjustedBestStatCheck(tribute, ["brains", "brawn"], 3, () => 0.6)).toBe(
      resolveLuckAdjustedStatCheck(tribute, "brains", 3, () => 0.6),
    );
  });

  it("uses Brawn when it is higher", () => {
    const tribute = createAuthoringTestTribute({
      stats: {
        brains: 1,
        brawn: 5,
        luck: 3,
      },
    });

    expect(resolveLuckAdjustedBestStatCheck(tribute, ["brains", "brawn"], 3, () => 0.6)).toBe(
      resolveLuckAdjustedStatCheck(tribute, "brawn", 3, () => 0.6),
    );
  });

  it("rejects an empty stat list", () => {
    const tribute = createAuthoringTestTribute();

    expect(() => resolveLuckAdjustedBestStatCheck(tribute, [], 3, () => 0.5)).toThrow(
      /at least one candidate stat/i,
    );
  });
});
