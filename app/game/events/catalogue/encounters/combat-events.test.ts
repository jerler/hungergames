import { describe, expect, it } from "vitest";

import { getCombatSelectionWeight, getVulnerabilityWeight } from "~/game/engine/stat-formulas";
import { EVENT_CATALOGUE } from "~/game/events/catalogue";
import { COMBAT_EVENTS } from "~/game/events/catalogue/encounters/combat-events";
import type { EventDefinition, EventResolution } from "~/game/events/event-schema";
import { selectEventParticipants } from "~/game/events/participant-selection";
import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { GameState, GameTribute } from "~/game/types/game-state";

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

function withItem(tribute: GameTribute, itemId: ItemDefinitionId): GameTribute {
  return {
    ...tribute,

    inventory: [
      ...tribute.inventory,

      createInventoryItemInstance(
        `combat-test:${tribute.id}:${itemId}`,
        tribute.id,
        itemId,
        AUTHORING_TEST_ROUND,
      ),
    ],
  };
}

function requireEvent(eventId: string): EventDefinition {
  const definition = COMBAT_EVENTS.find((candidate) => candidate.id === eventId);

  if (!definition) {
    throw new Error(`Missing combat event "${eventId}".`);
  }

  return definition;
}

function selectAndResolve(
  definition: EventDefinition,
  state: GameState,
  victim: GameTribute,
  killer: GameTribute,
): {
  resolution: EventResolution;
  selectedItemInstanceIds: string[];
} {
  const selection = selectEventParticipants(
    definition,
    {
      state,
      round: AUTHORING_TEST_ROUND,
      livingTributes: [victim, killer],
    },
    () => 0,
    new Set(),
    new Set(),
  );

  if (!selection) {
    throw new Error(`Could not select participants for "${definition.id}".`);
  }

  return {
    selectedItemInstanceIds: selection.selectedItemInstanceIds,

    resolution: definition.resolve({
      state,
      round: AUTHORING_TEST_ROUND,

      livingTributes: [victim, killer],

      eventId: `test:${definition.id}`,
      random: () => 0,

      participantsByRole: selection.participantsByRole,

      itemsByRole: selection.itemsByRole,

      unavailableItemInstanceIds: new Set(),
    }),
  };
}

describe("ordinary combat events", () => {
  it("includes every combat event in the main catalogue", () => {
    expect(
      COMBAT_EVENTS.every((event) =>
        EVENT_CATALOGUE.some((candidate) => candidate.id === event.id),
      ),
    ).toBe(true);
  });

  it.each(COMBAT_CASES)(
    "$eventId preserves its catalogue metadata",
    ({ eventId, weaponId, periods, weight }) => {
      const definition = requireEvent(eventId);

      expect(definition).toMatchObject({
        id: eventId,
        category: "fatal",

        tags: ["fatal", "combat", "weapon"],

        periods,
        baseWeight: weight,

        roles: [
          {
            id: "victim",
            count: 1,
            opposesRoleIds: ["killer"],
          },
          {
            id: "killer",
            count: 1,
            opposesRoleIds: ["victim"],

            requiredItemDefinitionIds: [weaponId],

            itemAccess: "accessible",
          },
        ],
      });

      expect(definition.roles[0]?.getWeight).toBe(getVulnerabilityWeight);

      expect(definition.roles[1]?.getWeight).toBe(getCombatSelectionWeight);
    },
  );

  it.each(COMBAT_CASES)(
    "$eventId preserves fatality, credit, loot, text, and weapon use",
    ({ eventId, weaponId, causeLabel, expectedText }) => {
      const victim = withItem(
        createAuthoringTestTribute({
          id: "victim",
          name: "Victim",
          pronouns: "she",
        }),
        "food",
      );

      const killer = withItem(
        createAuthoringTestTribute({
          id: "killer",
          name: "Killer",
        }),
        weaponId,
      );

      const state = createAuthoringTestGame([victim, killer]);

      const { resolution, selectedItemInstanceIds } = selectAndResolve(
        requireEvent(eventId),
        state,
        victim,
        killer,
      );

      expect(selectedItemInstanceIds).toEqual([killer.inventory[0].id]);

      expect(resolution.text).toBe(expectedText);

      expect(resolution.changes.filter((change) => change.type === "eliminate-tribute")).toEqual([
        {
          type: "eliminate-tribute",
          tributeId: victim.id,

          causeId: eventId,
          causeLabel,
          summary: expectedText,

          killerTributeIds: [killer.id],
        },
      ]);

      expect(
        resolution.changes.filter(
          (change) =>
            change.type === "increment-statistic" && change.statistic === "attemptedKills",
        ),
      ).toEqual([
        {
          type: "increment-statistic",
          tributeId: killer.id,
          statistic: "attemptedKills",
          amount: 1,
        },
      ]);

      expect(
        resolution.changes.filter(
          (change) => change.type === "increment-statistic" && change.statistic === "kills",
        ),
      ).toEqual([
        {
          type: "increment-statistic",
          tributeId: killer.id,
          statistic: "kills",
          amount: 1,
        },
      ]);

      expect(resolution.changes.filter((change) => change.type === "transfer-item")).toEqual([
        {
          type: "transfer-item",

          itemInstanceId: victim.inventory[0].id,

          fromTributeId: victim.id,
          toTributeId: killer.id,
          reason: "death-loot",
        },
      ]);

      expect(resolution.changes).toContainEqual({
        type: "use-item",
        tributeId: killer.id,

        itemInstanceId: killer.inventory[0].id,

        reason: eventId,
      });
    },
  );
});
