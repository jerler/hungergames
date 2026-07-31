import { describe, expect, it } from "vitest";

import {
  determineBloodbathFatalityTarget,
  getRemainingBloodbathFatalityTarget,
} from "./bloodbath-balance";
import { createSeededRandom } from "~/game/engine/random";
import type { GameChange } from "~/game/types/game-state";

describe("Bloodbath fatality planning", () => {
  it("creates deterministic soft targets", () => {
    const first = determineBloodbathFatalityTarget(24, createSeededRandom("fatality-target"));

    const second = determineBloodbathFatalityTarget(24, createSeededRandom("fatality-target"));

    expect(first).toBe(second);
  });

  it("plans approximately half the starting roster", () => {
    const observedHalfGameTargets = new Set<number>();

    for (let index = 0; index < 1_000; index += 1) {
      const halfGameTarget = determineBloodbathFatalityTarget(
        12,
        createSeededRandom(`half-${index}`),
      );

      observedHalfGameTargets.add(halfGameTarget);
      expect(halfGameTarget).toBeGreaterThanOrEqual(5);
      expect(halfGameTarget).toBeLessThanOrEqual(6);

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

    expect(observedHalfGameTargets).toEqual(new Set([5, 6]));
  });

  it("counts immediate flee eliminations toward the shared target", () => {
    const fleeChanges = [
      {
        type: "eliminate-tribute",
        tributeId: "fleeing-tribute",
        causeId: "fleeing-hazard",
        causeLabel: "Fleeing hazard",
        summary: "is eliminated while fleeing the Bloodbath.",
        killerTributeIds: [],
      },
      {
        type: "apply-status",
        tributeId: "other-fleeing-tribute",
        status: {
          id: "fleeing-poison-status",
          definitionId: "poisoned",
          severity: 2,
          remainingRounds: 2,
          sourceEventId: "fleeing-poison-event",
          sourceTributeId: null,
          appliedRound: {
            day: 1,
            period: "day",
          },
        },
      },
    ] satisfies GameChange[];

    expect(getRemainingBloodbathFatalityTarget(6, fleeChanges)).toBe(5);
  });

  it("clamps the remaining Bloodbath target at zero", () => {
    const fleeEliminations = ["first", "second"].map((tributeId): GameChange => ({
      type: "eliminate-tribute",
      tributeId,
      causeId: "fleeing-hazard",
      causeLabel: "Fleeing hazard",
      summary: "is eliminated while fleeing the Bloodbath.",
      killerTributeIds: [],
    }));

    expect(getRemainingBloodbathFatalityTarget(1, fleeEliminations)).toBe(0);
  });
});
