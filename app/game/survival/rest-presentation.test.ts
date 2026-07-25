import { describe, expect, it } from "vitest";

import { createRestPresentation } from "./rest-presentation";

describe("rest presentation", () => {
  it.each([
    ["comfortable", "Comfortable rest", "Rested comfortably during Night 2."],

    ["sheltered", "Sheltered rest", "Rested under shelter during Night 2."],

    ["unsheltered", "Unsheltered night", "Spent Night 2 without adequate shelter."],
  ] as const)("presents %s rest", (quality, label, summary) => {
    expect(
      createRestPresentation({
        quality,

        round: {
          day: 2,

          period: "night",
        },
      }),
    ).toMatchObject({
      label,
      summary,
      tone: quality,
    });
  });
});
