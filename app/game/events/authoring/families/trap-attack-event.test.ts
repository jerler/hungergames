import { describe, expect, it } from "vitest";

import { createTrapAttackEvent } from "~/game/events/authoring";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import {
  getAppliedStatuses,
  getEliminations,
  selectAndResolveEvent,
} from "~/game/events/testing/event-test-helpers";

function createFixture() {
  const victim = withAuthoringTestItem(
    createAuthoringTestTribute({
      id: "victim",

      name: "Victim",
    }),

    "knife",
  );

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

    "bear-trap",
  );

  return {
    victim,
    attacker,

    state: createAuthoringTestGame([victim, attacker]),
  };
}

function createDefinition() {
  return createTrapAttackEvent("test-bear-trap-attack", {
    trapItemId: "bear-trap",

    causeLabel: "Killed in a bear trap",

    criticalFailureStatus: {
      statusId: "injured",

      severity: 2,
    },

    criticalFailureText: "The setter is injured.",

    failureText: "The target avoids the trap.",

    successText: "The trap kills the target.",
  });
}

describe("createTrapAttackEvent", () => {
  it("kills, credits the attacker, transfers loot, and consumes the trap on success", () => {
    const { victim, attacker, state } = createFixture();

    const { resolution } = selectAndResolveEvent({
      definition: createDefinition(),

      state,

      livingTributes: [victim, attacker],

      randomValues: [0.5],
    });

    expect(getEliminations(resolution)).toEqual([
      expect.objectContaining({
        tributeId: victim.id,

        killerTributeIds: [attacker.id],
      }),
    ]);

    expect(resolution.changes).toContainEqual({
      type: "increment-statistic",

      tributeId: attacker.id,

      statistic: "attemptedKills",

      amount: 1,
    });

    expect(resolution.changes).toContainEqual({
      type: "increment-statistic",

      tributeId: attacker.id,

      statistic: "kills",

      amount: 1,
    });

    expect(resolution.changes).toContainEqual({
      type: "transfer-item",

      itemInstanceId: victim.inventory[0].id,

      fromTributeId: victim.id,

      toTributeId: attacker.id,

      reason: "death-loot",
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

  it("records an attempted kill and consumes the trap on ordinary failure", () => {
    const { victim, attacker, state } = createFixture();

    const { resolution } = selectAndResolveEvent({
      definition: createDefinition(),

      state,

      livingTributes: [victim, attacker],

      randomValues: [0.1],
    });

    expect(getEliminations(resolution)).toEqual([]);

    expect(getAppliedStatuses(resolution)).toEqual([]);

    expect(resolution.changes).toContainEqual({
      type: "increment-statistic",

      tributeId: attacker.id,

      statistic: "attemptedKills",

      amount: 1,
    });

    expect(resolution.changes).not.toContainEqual(
      expect.objectContaining({
        type: "increment-statistic",

        statistic: "kills",
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",

        itemInstanceId: attacker.inventory[0].id,
      }),
    );
  });

  it("injures the setter and consumes the trap on critical failure", () => {
    const { victim, attacker, state } = createFixture();

    const { resolution } = selectAndResolveEvent({
      definition: createDefinition(),

      state,

      livingTributes: [victim, attacker],

      randomValues: [0],
    });

    expect(getEliminations(resolution)).toEqual([]);

    expect(getAppliedStatuses(resolution)).toEqual([
      expect.objectContaining({
        definitionId: "injured",

        severity: 2,

        sourceTributeId: null,
      }),
    ]);

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",

        itemInstanceId: attacker.inventory[0].id,
      }),
    );
  });

  it("does not opt into safety resolution", () => {
    expect(createDefinition().safetyResolution).toBeUndefined();
  });

  it("rejects items that do not use trap offense", () => {
    expect(() =>
      createTrapAttackEvent("invalid-trap-attack", {
        trapItemId: "knife",

        causeLabel: "Invalid",

        criticalFailureStatus: {
          statusId: "injured",

          severity: 1,
        },

        criticalFailureText: "Invalid.",

        failureText: "Invalid.",

        successText: "Invalid.",
      }),
    ).toThrow(/trap-offense item/i);
  });
});
