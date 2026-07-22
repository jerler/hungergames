import { describe, expect, it } from "vitest";

import { determineBloodbathFatalityTarget } from "./bloodbath-balance";
import { createSeededRandom } from "~/game/engine/random";

describe("Bloodbath fatality planning", () => {
  it("creates deterministic soft targets", () => {
    const first = determineBloodbathFatalityTarget(24, createSeededRandom("fatality-target"));

    const second = determineBloodbathFatalityTarget(24, createSeededRandom("fatality-target"));

    expect(first).toBe(second);
  });

  it("plans approximately half the starting roster", () => {
    for (let index = 0; index < 1_000; index += 1) {
      const halfGameTarget = determineBloodbathFatalityTarget(
        12,
        createSeededRandom(`half-${index}`),
      );

      expect(halfGameTarget).toBe(6);

      const fullGameTarget = determineBloodbathFatalityTarget(
        24,
        createSeededRandom(`full-${index}`),
      );

      /*
       * This is a planning target. Actual deaths should
       * settle lower because outcomes may be nonfatal and
       * the Cornucopia quota can limit available conflicts.
       */
      expect(fullGameTarget).toBeGreaterThanOrEqual(12);

      expect(fullGameTarget).toBeLessThanOrEqual(13);
    }
  });
});
