import { describe, expect, it } from "vitest";

import { createSeededRandom } from "./random";

function createSequence(seed: string): number[] {
  const random = createSeededRandom(seed);

  return Array.from({ length: 5 }, () => random());
}

describe("createSeededRandom", () => {
  it("produces the same sequence for the same seed", () => {
    expect(createSequence("same-seed")).toEqual(createSequence("same-seed"));
  });

  it("produces different sequences for different seeds", () => {
    expect(createSequence("first-seed")).not.toEqual(createSequence("second-seed"));
  });

  it("returns values from zero up to but not including one", () => {
    const sequence = createSequence("range-test");

    expect(sequence.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});
