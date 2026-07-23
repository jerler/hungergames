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

import { COMBAT_EVENTS } from "./combat-events";

const COMBAT_CASES = [
  {
    eventId: "spear-attack",
    weaponId: "spear",
    periods: ["day"],
    weight: 2.25,
    causeLabel: "Speared",

    expectedText: "Killer strikes Victim down with a spear.",
  },
  {
    eventId: "knife-ambush",
    weaponId: "knife",
    periods: ["day", "night"],
    weight: 2.5,
    causeLabel: "Knifed",

    expectedText: "Killer catches Victim by surprise and kills her with a knife.",
  },
] as const;

describe("ordinary combat content", () => {
  it.each(COMBAT_CASES)(
    "$eventId preserves its authored content",
    ({ eventId, weaponId, periods, weight, causeLabel, expectedText }) => {
      const definition = requireEventDefinition(COMBAT_EVENTS, eventId);

      expect(definition).toMatchObject({
        id: eventId,
        category: "fatal",
        periods,
        baseWeight: weight,

        roles: [
          {
            id: "victim",
            count: 1,
          },
          {
            id: "killer",
            count: 1,

            requiredItemDefinitionIds: [weaponId],
          },
        ],
      });

      const victim = createAuthoringTestTribute({
        id: "victim",
        name: "Victim",
        pronouns: "she",
      });

      const killer = withAuthoringTestItem(
        createAuthoringTestTribute({
          id: "killer",
          name: "Killer",
        }),
        weaponId,
      );

      const state = createAuthoringTestGame([victim, killer]);

      const { resolution } = selectAndResolveEvent({
        definition,
        state,

        livingTributes: [victim, killer],

        randomValues: [0],
        round: AUTHORING_TEST_ROUND,
      });

      expect(resolution.text).toBe(expectedText);

      expect(getEliminations(resolution)).toEqual([
        expect.objectContaining({
          tributeId: victim.id,
          causeId: eventId,
          causeLabel,

          killerTributeIds: [killer.id],
        }),
      ]);
    },
  );
});
