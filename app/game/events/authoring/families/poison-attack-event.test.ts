import { describe, expect, it } from "vitest";

import { createPoisonAttackEvent } from "~/game/events/authoring";

import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import {
  getAppliedStatuses,
  getEliminations,
  selectAndResolveEvent,
} from "~/game/events/testing/event-test-helpers";

function createFixture(itemId: "blowgun" | "poison-vial") {
  const victim = createAuthoringTestTribute({
    id: "victim",

    name: "Victim",
  });

  const attacker = withAuthoringTestItem(
    createAuthoringTestTribute({
      id: "attacker",

      name: "Attacker",

      stats: {
        brains: 5,

        brawn: 1,

        luck: 5,
      },
    }),

    itemId,
  );

  return {
    victim,
    attacker,

    state: createAuthoringTestGame([victim, attacker]),
  };
}

function createDefinition(itemId: "blowgun" | "poison-vial") {
  return createPoisonAttackEvent(`test-${itemId}-attack`, {
    poisonItemId: itemId,

    successText: "The target is poisoned and urgently needs treatment.",

    failureText: "The poison attack fails.",
  });
}

describe("createPoisonAttackEvent", () => {
  it("applies severe attributed one-round poison without killing immediately", () => {
    const { victim, attacker, state } = createFixture("blowgun");

    const { resolution } = selectAndResolveEvent({
      definition: createDefinition("blowgun"),

      state,

      livingTributes: [victim, attacker],

      randomValues: [0.5],

      round: AUTHORING_TEST_ROUND,
    });

    expect(getEliminations(resolution)).toEqual([]);

    expect(getAppliedStatuses(resolution)).toEqual([
      expect.objectContaining({
        definitionId: "poisoned",

        severity: 3,

        remainingRounds: 1,

        sourceTributeId: attacker.id,
      }),
    ]);

    expect(resolution.changes).toContainEqual({
      type: "increment-statistic",

      tributeId: attacker.id,

      statistic: "attemptedKills",

      amount: 1,
    });

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "use-item",

        tributeId: attacker.id,

        itemInstanceId: attacker.inventory[0].id,
      }),
    );
  });

  it("consumes a poison vial on success", () => {
    const { victim, attacker, state } = createFixture("poison-vial");

    const { resolution } = selectAndResolveEvent({
      definition: createDefinition("poison-vial"),

      state,

      livingTributes: [victim, attacker],

      randomValues: [0.5],
    });

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",

        tributeId: attacker.id,

        itemInstanceId: attacker.inventory[0].id,

        uses: 1,
      }),
    );
  });

  it("records the attempt and item use when the poison attack fails", () => {
    const { victim, attacker, state } = createFixture("blowgun");

    const { resolution } = selectAndResolveEvent({
      definition: createDefinition("blowgun"),

      state,

      livingTributes: [victim, attacker],

      /*
       * The first weighted outcome is a failure.
       */
      randomValues: [0],
    });

    expect(getAppliedStatuses(resolution)).toEqual([]);

    expect(getEliminations(resolution)).toEqual([]);

    expect(resolution.changes).toContainEqual({
      type: "increment-statistic",

      tributeId: attacker.id,

      statistic: "attemptedKills",

      amount: 1,
    });

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "use-item",

        itemInstanceId: attacker.inventory[0].id,
      }),
    );
  });

  it("rejects items that do not use poison offense", () => {
    expect(() =>
      createPoisonAttackEvent("invalid-poison-attack", {
        poisonItemId: "knife",

        successText: "Invalid.",

        failureText: "Invalid.",
      }),
    ).toThrow(/poison-offense item/i);
  });
});
