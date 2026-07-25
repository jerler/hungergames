import { describe, expect, it } from "vitest";

import { ordinaryAttackCheck } from "~/game/events/authoring";

import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import { TACTICAL_EVENTS } from "~/game/events/catalogue/encounters/tactical-events";

import type { EventDefinition } from "~/game/events/event-schema";

import { requireEventDefinition } from "~/game/events/testing/event-test-helpers";

import { getDefenseTargetWeightMultiplier } from "~/game/items/defensive-equipment";

import { createInventoryItemInstance } from "~/game/items/inventory-engine";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import { getItemUsability } from "~/game/items/item-usability";

import { prepareRound } from "~/game/survival/round-preparation";

import { advanceStatusDurations, createStatusEffectInstance } from "~/game/statuses/status-engine";

import type { GameTribute } from "~/game/types/game-state";

/**
 * A stable, evenly distributed sample across the complete
 * random range.
 *
 * Using fixed values rather than a seed makes these balance
 * comparisons deterministic and independent of the random
 * implementation.
 */
const BALANCE_SAMPLE_VALUES = Array.from(
  {
    length: 2_000,
  },

  (_, index) => (index + 0.5) / 2_000,
);

function requireFirstItem(tribute: GameTribute) {
  const item = tribute.inventory[0];

  if (!item) {
    throw new Error(`Tribute "${tribute.id}" has no test item.`);
  }

  return item;
}

function resolveTacticalAttempt(
  definition: EventDefinition,
  attacker: GameTribute,
  victim: GameTribute,
  randomValue: number,
) {
  const item = requireFirstItem(attacker);

  const state = createAuthoringTestGame([attacker, victim]);

  return definition.resolve({
    state,

    round: AUTHORING_TEST_ROUND,

    livingTributes: [attacker, victim],

    eventId: `balance-test:${definition.id}`,

    random: () => randomValue,

    resolutionMode: "standard",

    participantsByRole: {
      killer: [attacker],

      victim: [victim],
    },

    itemsByRole: {
      killer: [
        {
          userTributeId: attacker.id,

          owner: attacker,

          item,
        },
      ],
    },

    unavailableItemInstanceIds: new Set(),
  });
}

function sampleTacticalSuccessRate(brains: 3 | 5): number {
  const definition = requireEventDefinition(TACTICAL_EVENTS, "firebomb-attack");

  const attacker = withAuthoringTestItem(
    createAuthoringTestTribute({
      id: `firebomb-attacker-${brains}`,

      stats: {
        brains,

        brawn: 1,

        luck: 3,
      },
    }),

    "firebomb",
  );

  const victim = createAuthoringTestTribute({
    id: `firebomb-victim-${brains}`,
  });

  const successfulAttempts = BALANCE_SAMPLE_VALUES.filter((randomValue) =>
    resolveTacticalAttempt(definition, attacker, victim, randomValue).changes.some(
      (change) => change.type === "eliminate-tribute",
    ),
  ).length;

  return successfulAttempts / BALANCE_SAMPLE_VALUES.length;
}

function sampleDirectAttackSuccessRate(attacker: GameTribute, victim: GameTribute): number {
  const weapon = requireFirstItem(attacker);

  const state = createAuthoringTestGame([attacker, victim]);

  const check = ordinaryAttackCheck();

  const successfulAttempts = BALANCE_SAMPLE_VALUES.filter(
    (randomValue) =>
      check({
        state,

        round: AUTHORING_TEST_ROUND,

        random: () => randomValue,

        killer: attacker,

        victim,

        weapon: {
          userTributeId: attacker.id,

          owner: attacker,

          item: weapon,
        },
      }) === "success",
  ).length;

  return successfulAttempts / BALANCE_SAMPLE_VALUES.length;
}

function sampleAttackRateAgainstDefense(defenseItemId: ItemDefinitionId | null): number {
  const attacker = withAuthoringTestItem(
    createAuthoringTestTribute({
      id: `defense-attacker-${defenseItemId ?? "none"}`,

      stats: {
        brains: 3,

        brawn: 4,

        luck: 3,
      },
    }),

    "knife",
  );

  const unprotectedVictim = createAuthoringTestTribute({
    id: `defense-victim-${defenseItemId ?? "none"}`,

    stats: {
      brains: 3,

      brawn: 3,

      luck: 3,
    },
  });

  const victim = defenseItemId
    ? withAuthoringTestItem(unprotectedVictim, defenseItemId)
    : unprotectedVictim;

  return sampleDirectAttackSuccessRate(attacker, victim);
}

function survivesPoison(treatmentItemId: "antidote" | "med-kit" | null): boolean {
  const poisonRound = {
    day: 2,

    period: "night",
  } as const;

  const treatmentRound = {
    day: 3,

    period: "day",
  } as const;

  const attacker = createAuthoringTestTribute({
    id: `poison-source-${treatmentItemId ?? "none"}`,
  });

  const originalVictim = createAuthoringTestTribute({
    id: `poison-victim-${treatmentItemId ?? "none"}`,
  });

  const treatmentItem = treatmentItemId
    ? createInventoryItemInstance(
        `balance-test-${treatmentItemId}`,

        originalVictim.id,

        treatmentItemId,

        {
          day: 1,

          period: "day",
        },
      )
    : null;

  const victim: GameTribute = {
    ...originalVictim,

    statuses: [
      createStatusEffectInstance(
        "balance-test-poison-attack",

        originalVictim.id,

        "poisoned",

        3,

        poisonRound,

        1,

        attacker.id,
      ),
    ],

    inventory: treatmentItem ? [treatmentItem] : [],
  };

  const state = {
    ...createAuthoringTestGame([attacker, victim]),

    currentRound: poisonRound,
  };

  const stateBeforeExpiration = treatmentItemId ? prepareRound(state, treatmentRound).state : state;

  const resolvedState = advanceStatusDurations({
    ...stateBeforeExpiration,

    currentRound: treatmentRound,
  });

  return resolvedState.tributes.find((tribute) => tribute.id === victim.id)?.isAlive ?? false;
}

describe("combat strategy balance", () => {
  it("gives low-Brawn tributes a preferred tactical role", () => {
    const definition = requireEventDefinition(TACTICAL_EVENTS, "firebomb-attack");

    const attackerRole = definition.roles.find((role) => role.id === "killer");

    if (!attackerRole?.getWeight) {
      throw new Error("Firebomb attacker role has no strategy weight.");
    }

    const lowBrawnTribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "low-brawn-tactical-user",

        stats: {
          brains: 5,

          brawn: 1,

          luck: 3,
        },
      }),

      "firebomb",
    );

    const highBrawnTribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "high-brawn-tactical-user",

        stats: {
          brains: 5,

          brawn: 5,

          luck: 3,
        },
      }),

      "firebomb",
    );

    const victim = createAuthoringTestTribute({
      id: "tactical-target",
    });

    const state = createAuthoringTestGame([lowBrawnTribute, highBrawnTribute, victim]);

    const context = {
      state,

      round: AUTHORING_TEST_ROUND,

      livingTributes: [lowBrawnTribute, highBrawnTribute, victim],

      participantsByRole: {
        victim: [victim],
      },
    };

    expect(
      getItemUsability(
        lowBrawnTribute,

        requireFirstItem(lowBrawnTribute),
      ).usable,
    ).toBe(true);

    expect(attackerRole.getWeight(lowBrawnTribute, context)).toBeGreaterThan(
      attackerRole.getWeight(highBrawnTribute, context),
    );
  });

  it("makes higher Brains materially improve tactical success", () => {
    const baselineRate = sampleTacticalSuccessRate(3);

    const highBrainsRate = sampleTacticalSuccessRate(5);

    expect(highBrainsRate).toBeGreaterThan(baselineRate + 0.15);
  });

  it("requires sufficient Brawn and rewards qualified heavy-weapon use", () => {
    const victim = createAuthoringTestTribute({
      id: "heavy-weapon-target",
    });

    const underqualifiedWarhammerUser = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "underqualified-warhammer-user",

        stats: {
          brains: 3,

          brawn: 4,

          luck: 3,
        },
      }),

      "warhammer",
    );

    const qualifiedWarhammerUser = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "qualified-warhammer-user",

        stats: {
          brains: 3,

          brawn: 5,

          luck: 3,
        },
      }),

      "warhammer",
    );

    /*
     * Use an equally strong tribute with a lighter blunt
     * weapon as the valid comparison case. This isolates
     * the value of qualifying for the warhammer without
     * attempting to resolve combat with an unusable item.
     */
    const qualifiedClubUser = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "qualified-club-user",

        stats: {
          brains: 3,

          brawn: 5,

          luck: 3,
        },
      }),

      "club",
    );

    expect(
      getItemUsability(
        underqualifiedWarhammerUser,

        requireFirstItem(underqualifiedWarhammerUser),
      ).usable,
    ).toBe(false);

    expect(
      getItemUsability(
        qualifiedWarhammerUser,

        requireFirstItem(qualifiedWarhammerUser),
      ).usable,
    ).toBe(true);

    expect(
      getItemUsability(
        qualifiedClubUser,

        requireFirstItem(qualifiedClubUser),
      ).usable,
    ).toBe(true);

    const clubSuccessRate = sampleDirectAttackSuccessRate(qualifiedClubUser, victim);

    const warhammerSuccessRate = sampleDirectAttackSuccessRate(qualifiedWarhammerUser, victim);

    expect(warhammerSuccessRate).toBeGreaterThan(clubSuccessRate);
  });

  it("makes stronger defensive equipment progressively more effective", () => {
    const attackRates = {
      unprotected: sampleAttackRateAgainstDefense(null),

      helmet: sampleAttackRateAgainstDefense("helmet"),

      paddedArmour: sampleAttackRateAgainstDefense("padded-armour"),

      shield: sampleAttackRateAgainstDefense("shield"),

      reinforcedArmour: sampleAttackRateAgainstDefense("reinforced-armour"),
    };

    expect(attackRates.unprotected).toBeGreaterThan(attackRates.helmet);

    expect(attackRates.helmet).toBeGreaterThan(attackRates.paddedArmour);

    expect(attackRates.paddedArmour).toBeGreaterThan(attackRates.shield);

    expect(attackRates.shield).toBeGreaterThan(attackRates.reinforcedArmour);

    const reinforcedTarget = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "reinforced-target",
      }),

      "reinforced-armour",
    );

    expect(getDefenseTargetWeightMultiplier(reinforcedTarget)).toBeLessThan(1);
  });

  it("makes poison fatal without medicine and survivable with treatment", () => {
    expect(survivesPoison(null)).toBe(false);

    expect(survivesPoison("antidote")).toBe(true);

    expect(survivesPoison("med-kit")).toBe(true);
  });
});
