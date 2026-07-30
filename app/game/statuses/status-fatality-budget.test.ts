import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  advanceStatusDurations,
  countPendingFatalStatusResolutions,
  createStatusEffectInstance,
} from "~/game/statuses/status-engine";
import type { GameTribute, RoundReference } from "~/game/types/game-state";

const APPLIED_ROUND = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

const EXPIRING_ROUND = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

const FOLLOWING_ROUND = {
  day: 3,
  period: "day",
} as const satisfies RoundReference;

function createBleedingTribute(id: string): GameTribute {
  const tribute = createAuthoringTestTribute({
    id,
    name: id,
  });

  return {
    ...tribute,
    statuses: [
      createStatusEffectInstance(
        `status-source-${id}`,
        tribute.id,
        "bleeding",
        1,
        APPLIED_ROUND,
        1,
      ),
    ],
  };
}

function expectValidStatusDurations(tributes: readonly GameTribute[]): void {
  const invalidStatuses = tributes.flatMap((tribute) =>
    tribute.statuses.filter(
      (status) =>
        status.remainingRounds !== null &&
        (!Number.isInteger(status.remainingRounds) || status.remainingRounds <= 0),
    ),
  );

  expect(invalidStatuses).toEqual([]);
}

describe("fatal status lethality-budget deferral", () => {
  it("keeps blocked fatal statuses imminent instead of leaving zero durations", () => {
    const first = createBleedingTribute("first");
    const second = createBleedingTribute("second");
    const safe = createAuthoringTestTribute({
      id: "safe",
      name: "safe",
    });
    const state = {
      ...createAuthoringTestGame([first, second, safe]),
      currentRound: EXPIRING_ROUND,
    };

    const advanced = advanceStatusDurations(state, 0);

    expect(advanced.tributes.filter((tribute) => !tribute.isAlive)).toHaveLength(0);

    for (const tributeId of [first.id, second.id]) {
      expect(
        advanced.tributes
          .find((tribute) => tribute.id === tributeId)
          ?.statuses.find((status) => status.definitionId === "bleeding")?.remainingRounds,
      ).toBe(1);
    }

    expect(countPendingFatalStatusResolutions(advanced, FOLLOWING_ROUND)).toBe(2);
    expectValidStatusDurations(advanced.tributes);
  });

  it("resolves only the available fatalities and defers the rest", () => {
    const candidates = ["first", "second", "third"].map(createBleedingTribute);
    const safe = createAuthoringTestTribute({
      id: "safe",
      name: "safe",
    });
    const state = {
      ...createAuthoringTestGame([...candidates, safe]),
      currentRound: EXPIRING_ROUND,
    };

    const advanced = advanceStatusDurations(state, 1);
    const deadCandidates = advanced.tributes.filter(
      (tribute) => candidates.some((candidate) => candidate.id === tribute.id) && !tribute.isAlive,
    );
    const deferredCandidates = advanced.tributes.filter(
      (tribute) => candidates.some((candidate) => candidate.id === tribute.id) && tribute.isAlive,
    );

    expect(deadCandidates).toHaveLength(1);
    expect(deferredCandidates).toHaveLength(2);

    for (const tribute of deferredCandidates) {
      expect(
        tribute.statuses.find((status) => status.definitionId === "bleeding")?.remainingRounds,
      ).toBe(1);
    }

    expect(countPendingFatalStatusResolutions(advanced, FOLLOWING_ROUND)).toBe(2);
    expectValidStatusDurations(advanced.tributes);
  });
});
