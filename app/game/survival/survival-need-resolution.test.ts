import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { GameState, GameTribute } from "~/game/types/game-state";

import { advanceSurvivalNeedsAfterRound } from "./survival-needs-engine";

function withNeeds(
  tribute: GameTribute,
  {
    food = 0,
    water = 0,
  }: {
    food?: number;
    water?: number;
  },
): GameTribute {
  return {
    ...tribute,

    survival: {
      ...tribute.survival,

      roundsWithoutFood: food,
      roundsWithoutWater: water,
    },
  };
}

function requireTribute(state: GameState, tributeId: string): GameTribute {
  const tribute = state.tributes.find((candidate) => candidate.id === tributeId);

  if (!tribute) {
    throw new Error(`Expected tribute "${tributeId}".`);
  }

  return tribute;
}

describe("fatal survival need resolution", () => {
  it("kills a tribute after six rounds without water", () => {
    const victim = withNeeds(
      createAuthoringTestTribute({
        id: "victim",
        name: "Victim",
      }),
      {
        water: 5,
      },
    );

    const survivor = createAuthoringTestTribute({
      id: "survivor",
      name: "Survivor",
    });

    const resolved = advanceSurvivalNeedsAfterRound(createAuthoringTestGame([victim, survivor]));

    const resolvedVictim = requireTribute(resolved, victim.id);

    expect(resolvedVictim.isAlive).toBe(false);

    expect(resolvedVictim.death).toMatchObject({
      causeId: "survival-need:water",

      causeLabel: "Dehydration",

      killerTributeIds: [],
    });

    const needEvent = resolved.roundEvents.find((event) => event.kind === "need-resolution");

    expect(needEvent).toMatchObject({
      definitionId: "need-fatality:dehydration",

      participantTributeIds: [victim.id],
    });

    expect(resolved.eventHistory.some((event) => event.id === needEvent?.id)).toBe(true);

    expect(resolved.revealedEventCount).toBe(resolved.roundEvents.length);
  });

  it("kills a tribute after eight rounds without food", () => {
    const victim = withNeeds(
      createAuthoringTestTribute({
        id: "victim",
      }),
      {
        food: 7,
      },
    );

    const survivor = createAuthoringTestTribute({
      id: "survivor",
    });

    const resolved = advanceSurvivalNeedsAfterRound(createAuthoringTestGame([victim, survivor]));

    expect(requireTribute(resolved, victim.id).death).toMatchObject({
      causeId: "survival-need:food",

      causeLabel: "Starvation",

      killerTributeIds: [],
    });
  });

  it("creates no kill statistic or death loot", () => {
    const victimWithItem = withAuthoringTestItem(
      withNeeds(
        createAuthoringTestTribute({
          id: "victim",
        }),
        {
          water: 5,
        },
      ),
      "blanket",
    );

    const survivor = createAuthoringTestTribute({
      id: "survivor",
    });

    const victimItem = victimWithItem.inventory[0];

    if (!victimItem) {
      throw new Error("Expected a victim item.");
    }

    const resolved = advanceSurvivalNeedsAfterRound(
      createAuthoringTestGame([victimWithItem, survivor]),
    );

    const resolvedVictim = requireTribute(resolved, victimWithItem.id);

    const resolvedSurvivor = requireTribute(resolved, survivor.id);

    expect(resolvedVictim.inventory.map((item) => item.id)).toContain(victimItem.id);

    expect(resolvedSurvivor.inventory).toHaveLength(0);

    expect(resolvedSurvivor.statistics).toMatchObject({
      kills: 0,
      attemptedKills: 0,
    });

    const needEvent = resolved.roundEvents.find((event) => event.kind === "need-resolution");

    expect(needEvent?.changes.some((change) => change.type === "transfer-item")).toBe(false);

    expect(
      needEvent?.changes.some(
        (change) => change.type === "increment-statistic" && change.statistic === "kills",
      ),
    ).toBe(false);
  });

  it("creates one death when both needs become fatal together", () => {
    const victim = withNeeds(
      createAuthoringTestTribute({
        id: "victim",
      }),
      {
        water: 5,
        food: 7,
      },
    );

    const survivor = createAuthoringTestTribute({
      id: "survivor",
    });

    const resolved = advanceSurvivalNeedsAfterRound(createAuthoringTestGame([victim, survivor]));

    const needEvents = resolved.roundEvents.filter((event) => event.kind === "need-resolution");

    expect(needEvents).toHaveLength(1);

    /*
     * Water has deterministic priority
     * when both thresholds are crossed.
     */
    expect(needEvents[0]?.definitionId).toBe("need-fatality:dehydration");
  });

  it("preserves one survivor when every living tribute reaches a fatal threshold", () => {
    const lowLuck = withNeeds(
      createAuthoringTestTribute({
        id: "low-luck",

        stats: {
          brains: 3,
          brawn: 3,
          luck: 1,
        },
      }),
      {
        water: 5,
      },
    );

    const highLuck = withNeeds(
      createAuthoringTestTribute({
        id: "high-luck",

        stats: {
          brains: 3,
          brawn: 3,
          luck: 5,
        },
      }),
      {
        water: 5,
      },
    );

    const resolved = advanceSurvivalNeedsAfterRound(createAuthoringTestGame([lowLuck, highLuck]));

    expect(requireTribute(resolved, lowLuck.id).isAlive).toBe(false);

    const spared = requireTribute(resolved, highLuck.id);

    expect(spared.isAlive).toBe(true);

    expect(spared.survival.roundsWithoutWater).toBe(5);

    expect(spared.statuses.map((status) => status.definitionId)).toContain("dehydrated");

    expect(resolved.roundEvents.filter((event) => event.kind === "need-resolution")).toHaveLength(
      1,
    );
  });

  it("creates and reveals truce aftermath after a need death", () => {
    const victim = withNeeds(
      createAuthoringTestTribute({
        id: "victim",
      }),
      {
        water: 5,
      },
    );

    const survivor = createAuthoringTestTribute({
      id: "survivor",
    });

    const game = createAuthoringTestGame([victim, survivor]);

    const gameWithTruce: GameState = {
      ...game,

      truces: [
        {
          id: "need-death-truce",
          kind: "standard",

          tributeIds: [victim.id, survivor.id],

          createdRound: {
            day: 1,
            period: "night",
          },

          expiresAfterRound: {
            day: 3,
            period: "day",
          },
        },
      ],
    };

    const resolved = advanceSurvivalNeedsAfterRound(gameWithTruce);

    expect(resolved.truces).toHaveLength(0);

    expect(resolved.roundEvents.map((event) => event.kind)).toEqual([
      "need-resolution",
      "aftermath",
    ]);

    expect(resolved.revealedEventCount).toBe(2);

    expect(resolved.eventHistory.map((event) => event.kind)).toEqual([
      "need-resolution",
      "aftermath",
    ]);
  });
});
