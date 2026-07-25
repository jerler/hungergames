import { describe, expect, it } from "vitest";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { GameState, GameTribute } from "~/game/types/game-state";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { prepareRound } from "~/game/survival/round-preparation";
import { advanceStatusDurations, createStatusEffectInstance } from "~/game/statuses/status-engine";

const APPLIED_ROUND = {
  day: 2,
  period: "day",
} as const;

const ACTIVE_ROUND = {
  day: 2,
  period: "night",
} as const;

function createPoisonedGame(treatmentItemId?: ItemDefinitionId): {
  state: GameState;
  attacker: GameTribute;
  victim: GameTribute;
} {
  const attacker = createAuthoringTestTribute({
    id: "attacker",

    name: "Attacker",
  });

  const originalVictim = createAuthoringTestTribute({
    id: "victim",

    name: "Victim",
  });

  const loot = createInventoryItemInstance("poison-loot-source", originalVictim.id, "knife", {
    day: 1,
    period: "day",
  });

  const treatmentItem = treatmentItemId
    ? createInventoryItemInstance("poison-treatment-source", originalVictim.id, treatmentItemId, {
        day: 1,
        period: "day",
      })
    : null;

  const victim: GameTribute = {
    ...originalVictim,

    statuses: [
      createStatusEffectInstance(
        "poison-attack-event",
        originalVictim.id,
        "poisoned",
        3,
        APPLIED_ROUND,
        1,
        attacker.id,
      ),
    ],

    inventory: [loot, ...(treatmentItem ? [treatmentItem] : [])],
  };

  const creditedAttacker: GameTribute = {
    ...attacker,

    statistics: {
      ...attacker.statistics,

      /*
       * The originating poison attack already
       * recorded the attempt.
       */
      attemptedKills: 1,
    },
  };

  return {
    attacker: creditedAttacker,

    victim,

    state: {
      ...createAuthoringTestGame([creditedAttacker, victim]),

      currentRound: APPLIED_ROUND,
    },
  };
}

describe("poison counterplay and delayed attribution", () => {
  it("awards delayed kill credit and death loot without duplicating the attempt", () => {
    const { state, attacker, victim } = createPoisonedGame();

    /*
     * Application round does not consume the
     * poison's active duration.
     */
    const afterApplicationRound = advanceStatusDurations(state);

    expect(
      afterApplicationRound.tributes.find((tribute) => tribute.id === victim.id)?.statuses[0]
        ?.remainingRounds,
    ).toBe(1);

    const afterActiveRound = advanceStatusDurations({
      ...afterApplicationRound,

      currentRound: ACTIVE_ROUND,
    });

    const deadVictim = afterActiveRound.tributes.find((tribute) => tribute.id === victim.id);

    const creditedAttacker = afterActiveRound.tributes.find(
      (tribute) => tribute.id === attacker.id,
    );

    expect(deadVictim).toMatchObject({
      isAlive: false,

      death: {
        causeId: "status:poisoned",

        killerTributeIds: [attacker.id],
      },
    });

    expect(creditedAttacker?.statistics).toMatchObject({
      attemptedKills: 1,

      kills: 1,
    });

    expect(creditedAttacker?.inventory).toEqual(expect.arrayContaining(victim.inventory));

    expect(afterActiveRound.eventHistory.at(-1)?.text).toContain(attacker.snapshot.name);
  });

  it.each(["antidote", "med-kit"] as const)(
    "%s removes imminent poison and prevents death",
    (treatmentItemId) => {
      const { state, victim } = createPoisonedGame(treatmentItemId);

      const prepared = prepareRound(state, ACTIVE_ROUND);

      const treatedVictim = prepared.state.tributes.find((tribute) => tribute.id === victim.id);

      expect(treatedVictim?.statuses.some((status) => status.definitionId === "poisoned")).toBe(
        false,
      );

      expect(
        prepared.automaticEvents.some(
          (event) => event.preparation?.mechanic === "medical-treatment",
        ),
      ).toBe(true);

      const afterRound = advanceStatusDurations({
        ...prepared.state,

        currentRound: ACTIVE_ROUND,
      });

      expect(afterRound.tributes.find((tribute) => tribute.id === victim.id)?.isAlive).toBe(true);
    },
  );
});
