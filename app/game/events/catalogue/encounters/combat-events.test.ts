import { describe, expect, it } from "vitest";

import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import {
  getEliminations,
  requireEventDefinition,
  selectAndResolveEvent,
} from "~/game/events/testing/event-test-helpers";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import { COMBAT_EVENTS } from "./combat-events";

const COMBAT_CASES = [
  {
    eventId: "knife-ambush",

    weaponId: "knife",

    periods: ["day", "night"],

    weight: 2.5,

    causeLabel: "Knifed",
  },

  {
    eventId: "short-sword-duel",

    weaponId: "short-sword",

    periods: ["day", "night"],

    weight: 1.8,

    causeLabel: "Killed in a short-sword duel",
  },

  {
    eventId: "rapier-lunge",

    weaponId: "rapier",

    periods: ["day", "night"],

    weight: 1.7,

    causeLabel: "Run through with a rapier",
  },

  {
    eventId: "longsword-attack",

    weaponId: "longsword",

    periods: ["day", "night"],

    weight: 1.6,

    causeLabel: "Slain with a longsword",
  },

  {
    eventId: "greatsword-charge",

    weaponId: "greatsword",

    periods: ["day"],

    weight: 1.2,

    causeLabel: "Cut down with a greatsword",
  },

  {
    eventId: "spear-attack",

    weaponId: "spear",

    periods: ["day"],

    weight: 2.25,

    causeLabel: "Speared",
  },

  {
    eventId: "pike-charge",

    weaponId: "pike",

    periods: ["day"],

    weight: 1.5,

    causeLabel: "Impaled with a pike",
  },

  {
    eventId: "trident-attack",

    weaponId: "trident",

    periods: ["day", "night"],

    weight: 1.5,

    causeLabel: "Killed with a trident",
  },

  {
    eventId: "bow-shot",

    weaponId: "bow",

    periods: ["day", "night"],

    weight: 2,

    causeLabel: "Shot with a bow",
  },

  {
    eventId: "longbow-shot",

    weaponId: "longbow",

    periods: ["day"],

    weight: 1.5,

    causeLabel: "Shot with a longbow",
  },

  {
    eventId: "crossbow-attack",

    weaponId: "crossbow",

    periods: ["day", "night"],

    weight: 1.7,

    causeLabel: "Shot with a crossbow",
  },

  {
    eventId: "hand-axe-attack",

    weaponId: "hand-axe",

    periods: ["day", "night"],

    weight: 1.8,

    causeLabel: "Killed with a hand axe",
  },

  {
    eventId: "axe-attack",

    weaponId: "axe",

    periods: ["day"],

    weight: 1.7,

    causeLabel: "Killed with an axe",
  },

  {
    eventId: "club-attack",

    weaponId: "club",

    periods: ["day", "night"],

    weight: 1.6,

    causeLabel: "Bludgeoned",
  },

  {
    eventId: "warhammer-attack",

    weaponId: "warhammer",

    periods: ["day"],

    weight: 1.1,

    causeLabel: "Crushed with a warhammer",
  },
] as const satisfies readonly {
  eventId: string;
  weaponId: ItemDefinitionId;

  periods: readonly ("day" | "night")[];

  weight: number;
  causeLabel: string;
}[];

function createCombatFixture(weaponId: ItemDefinitionId) {
  const victim = createAuthoringTestTribute({
    id: "victim",

    name: "Victim",

    pronouns: "she",

    stats: {
      brains: 3,

      brawn: 3,

      luck: 3,
    },
  });

  const killer = withAuthoringTestItem(
    createAuthoringTestTribute({
      id: "killer",

      name: "Killer",

      stats: {
        /*
         * Meets every Phase 10 direct-weapon
         * minimum for catalogue testing.
         */
        brains: 5,

        brawn: 5,

        luck: 5,
      },
    }),

    weaponId,
  );

  return {
    victim,
    killer,

    state: createAuthoringTestGame([victim, killer]),
  };
}

describe("ordinary combat content", () => {
  it("contains one checked attack for every direct weapon", () => {
    expect(COMBAT_EVENTS).toHaveLength(COMBAT_CASES.length);

    expect(new Set(COMBAT_EVENTS.map((event) => event.id)).size).toBe(COMBAT_CASES.length);
  });

  it.each(COMBAT_CASES)(
    "$eventId preserves its direct-weapon configuration",
    ({ eventId, weaponId, periods, weight }) => {
      const definition = requireEventDefinition(COMBAT_EVENTS, eventId);

      expect(definition).toMatchObject({
        id: eventId,

        category: "hazard",

        periods,

        baseWeight: weight,

        safetyResolution: "force-success",

        roles: [
          {
            id: "victim",

            count: 1,
          },

          {
            id: "killer",

            count: 1,

            requiredItemDefinitionIds: [weaponId],

            requiredItemRequireUsable: true,
          },
        ],
      });

      expect(definition.tags).toEqual(
        expect.arrayContaining(["hazard", "combat", "weapon", "fatal"]),
      );
    },
  );

  it.each(COMBAT_CASES)(
    "$eventId kills on a successful checked attack",
    ({ eventId, weaponId, causeLabel }) => {
      const definition = requireEventDefinition(COMBAT_EVENTS, eventId);

      const { victim, killer, state } = createCombatFixture(weaponId);

      const { resolution } = selectAndResolveEvent({
        definition,
        state,

        livingTributes: [victim, killer],

        /*
         * Zero always succeeds because attack
         * chances are strictly positive.
         */
        randomValues: [0],

        round: AUTHORING_TEST_ROUND,
      });

      expect(getEliminations(resolution)).toEqual([
        expect.objectContaining({
          tributeId: victim.id,

          causeId: eventId,

          causeLabel,

          killerTributeIds: [killer.id],
        }),
      ]);

      expect(resolution.changes).toContainEqual({
        type: "increment-statistic",

        tributeId: killer.id,

        statistic: "attemptedKills",

        amount: 1,
      });

      expect(resolution.changes).toContainEqual({
        type: "increment-statistic",

        tributeId: killer.id,

        statistic: "kills",

        amount: 1,
      });

      expect(resolution.changes).toContainEqual(
        expect.objectContaining({
          type: "use-item",

          tributeId: killer.id,

          itemInstanceId: killer.inventory[0].id,

          reason: eventId,
        }),
      );
    },
  );

  it.each(COMBAT_CASES)(
    "$eventId records an attempted kill without eliminating on failure",
    ({ eventId, weaponId }) => {
      const definition = requireEventDefinition(COMBAT_EVENTS, eventId);

      const { victim, killer, state } = createCombatFixture(weaponId);

      const { resolution } = selectAndResolveEvent({
        definition,
        state,

        livingTributes: [victim, killer],

        /*
         * Checked attack chances remain below one.
         */
        randomValues: [0.999999],

        round: AUTHORING_TEST_ROUND,
      });

      expect(getEliminations(resolution)).toEqual([]);

      expect(resolution.changes).toContainEqual({
        type: "increment-statistic",

        tributeId: killer.id,

        statistic: "attemptedKills",

        amount: 1,
      });

      expect(resolution.changes).not.toContainEqual(
        expect.objectContaining({
          type: "increment-statistic",

          tributeId: killer.id,

          statistic: "kills",
        }),
      );

      expect(resolution.changes).toContainEqual(
        expect.objectContaining({
          type: "use-item",

          tributeId: killer.id,

          itemInstanceId: killer.inventory[0].id,

          reason: eventId,
        }),
      );
    },
  );

  it("forces a checked attack to succeed in safety mode", () => {
    const definition = requireEventDefinition(COMBAT_EVENTS, "knife-ambush");

    const { victim, killer, state } = createCombatFixture("knife");

    const { resolution } = selectAndResolveEvent({
      definition,
      state,

      livingTributes: [victim, killer],

      /*
       * This would fail in standard mode.
       */
      randomValues: [0.999999],

      resolutionMode: "safety",

      round: AUTHORING_TEST_ROUND,
    });

    expect(getEliminations(resolution)).toHaveLength(1);
  });

  it("resolves identically from the same inputs", () => {
    const definition = requireEventDefinition(COMBAT_EVENTS, "knife-ambush");

    const firstFixture = createCombatFixture("knife");

    const secondFixture = createCombatFixture("knife");

    const first = selectAndResolveEvent({
      definition,

      state: firstFixture.state,

      livingTributes: [firstFixture.victim, firstFixture.killer],

      randomValues: [0.42],
    });

    const second = selectAndResolveEvent({
      definition,

      state: secondFixture.state,

      livingTributes: [secondFixture.victim, secondFixture.killer],

      randomValues: [0.42],
    });

    expect(second).toEqual(first);
  });
});
