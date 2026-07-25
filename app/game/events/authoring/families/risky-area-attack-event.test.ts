import { describe, expect, it } from "vitest";

import { createRiskyAreaAttackEvent } from "~/game/events/authoring";

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

    "firebomb",
  );

  return {
    victim,
    attacker,

    state: createAuthoringTestGame([victim, attacker]),
  };
}

function createDefinition() {
  return createRiskyAreaAttackEvent("test-firebomb-attack", {
    itemId: "firebomb",

    causeLabel: "Killed by a firebomb",

    criticalFailureText: "The firebomb burns the user.",

    failureText: "The firebomb misses.",

    successText: "The firebomb kills the target.",
  });
}

describe("createRiskyAreaAttackEvent", () => {
  it("kills exactly one target and consumes the item on success", () => {
    const { victim, attacker, state } = createFixture();

    const definition = createDefinition();

    expect(definition.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "killer",

          count: 1,
        }),

        expect.objectContaining({
          id: "victim",

          count: 1,
        }),
      ]),
    );

    const { resolution } = selectAndResolveEvent({
      definition,
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

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",

        tributeId: attacker.id,

        itemInstanceId: attacker.inventory[0].id,

        uses: 1,
      }),
    );
  });

  it("burns the attacker without killing the victim on critical failure", () => {
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
        definitionId: "burned",

        severity: 2,

        sourceTributeId: null,
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
        type: "consume-item",

        itemInstanceId: attacker.inventory[0].id,
      }),
    );
  });

  it("records a failed attempt without burning the attacker", () => {
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
  });

  it("does not opt into safety resolution", () => {
    expect(createDefinition().safetyResolution).toBeUndefined();
  });

  it("rejects items that do not use risky-area offense", () => {
    expect(() =>
      createRiskyAreaAttackEvent("invalid-area-attack", {
        itemId: "knife",

        causeLabel: "Invalid",

        criticalFailureText: "Invalid.",

        failureText: "Invalid.",

        successText: "Invalid.",
      }),
    ).toThrow(/risky-area item/i);
  });
});
