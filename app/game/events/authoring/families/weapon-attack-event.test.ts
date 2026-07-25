import { describe, expect, it } from "vitest";

import { applyStatus, createWeaponAttackEvent, result } from "~/game/events/authoring";
import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createSequenceRandom } from "~/game/events/authoring/testing/resolve-authored-event";
import type { EventDefinition, EventResolution } from "~/game/events/event-schema";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameState, GameTribute, EventResolutionMode } from "~/game/types/game-state";

function withItem(tribute: GameTribute, itemId: ItemDefinitionId): GameTribute {
  return {
    ...tribute,

    inventory: [
      ...tribute.inventory,

      createInventoryItemInstance(
        `weapon-family:${tribute.id}:${itemId}`,
        tribute.id,
        itemId,
        AUTHORING_TEST_ROUND,
      ),
    ],
  };
}

function selectAndResolve(
  definition: EventDefinition,
  state: GameState,
  livingTributes: readonly GameTribute[],
  randomValues: readonly number[] = [0],
  resolutionMode: EventResolutionMode = "standard",
): {
  resolution: EventResolution;
  selectedItemInstanceIds: string[];
} {
  const selection = selectEventParticipants(
    definition,
    {
      state,
      round: AUTHORING_TEST_ROUND,
      livingTributes,
    },
    () => 0,
    new Set(),
    new Set(),
  );

  if (!selection) {
    throw new Error(`Expected weapon event "${definition.id}" to select participants.`);
  }

  return {
    selectedItemInstanceIds: selection.selectedItemInstanceIds,

    resolution: definition.resolve({
      state,

      round: AUTHORING_TEST_ROUND,

      livingTributes,

      eventId: `test:${definition.id}`,

      random: createSequenceRandom(randomValues),

      resolutionMode,

      participantsByRole: selection.participantsByRole,

      itemsByRole: selection.itemsByRole,

      unavailableItemInstanceIds: new Set(),
    }),
  };
}

describe("createWeaponAttackEvent", () => {
  it("creates a guaranteed fatal weapon event", () => {
    const definition = createWeaponAttackEvent("weapon-defaults", {
      weaponId: "knife",
      causeLabel: "Knifed",
      text: "Fatal attack.",
    });

    expect(definition).toMatchObject({
      id: "weapon-defaults",
      category: "fatal",

      tags: ["fatal", "combat", "weapon"],

      periods: ["day", "night"],
      baseWeight: 1,

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

          requiredItemDefinitionIds: ["knife"],

          itemAccess: "accessible",
        },
      ],
    });
  });

  it("supports a weapon tag and owned access", () => {
    const definition = createWeaponAttackEvent("owned-weapon-tag", {
      weaponTag: "direct-weapon",
      access: "owned",
      causeLabel: "Killed",
      text: "Fatal attack.",
    });

    expect(definition.roles[1]).toMatchObject({
      id: "killer",
      requiredItemTags: ["direct-weapon"],
      itemAccess: "owned",
    });
  });

  it("reserves the selected weapon", () => {
    const victim = createAuthoringTestTribute({
      id: "victim",
    });

    const killer = withItem(
      createAuthoringTestTribute({
        id: "killer",
      }),
      "knife",
    );

    const state = createAuthoringTestGame([victim, killer]);

    const { selectedItemInstanceIds } = selectAndResolve(
      createWeaponAttackEvent("weapon-reservation", {
        weaponId: "knife",
        causeLabel: "Knifed",
        text: "Fatal attack.",
      }),
      state,
      [victim, killer],
    );

    expect(selectedItemInstanceIds).toEqual([killer.inventory[0].id]);
  });

  it("preserves kill credit, death loot, and weapon use", () => {
    const victim = withItem(
      createAuthoringTestTribute({
        id: "victim",
        name: "Victim",
      }),
      "wild-fruit-and-berries",
    );

    const killer = withItem(
      createAuthoringTestTribute({
        id: "killer",
        name: "Killer",
      }),
      "knife",
    );

    const state = createAuthoringTestGame([victim, killer]);

    const { resolution } = selectAndResolve(
      createWeaponAttackEvent("weapon-kill", {
        weaponId: "knife",
        causeLabel: "Knifed",

        text: ({ killer, victim }) => `${killer.name} kills ${victim.name}.`,
      }),
      state,
      [victim, killer],
    );

    expect(resolution).toEqual({
      text: "Killer kills Victim.",

      changes: [
        {
          type: "eliminate-tribute",
          tributeId: victim.id,

          causeId: "weapon-kill",
          causeLabel: "Knifed",
          summary: "Killer kills Victim.",

          killerTributeIds: [killer.id],
        },
        {
          type: "increment-statistic",
          tributeId: killer.id,
          statistic: "attemptedKills",
          amount: 1,
        },
        {
          type: "increment-statistic",
          tributeId: killer.id,
          statistic: "kills",
          amount: 1,
        },
        {
          type: "transfer-item",
          itemInstanceId: victim.inventory[0].id,

          fromTributeId: victim.id,
          toTributeId: killer.id,
          reason: "death-loot",
        },
        {
          type: "use-item",
          tributeId: killer.id,

          itemInstanceId: killer.inventory[0].id,

          reason: "weapon-kill",
        },
      ],
    });
  });

  it("records shared weapon use against its physical owner", () => {
    const victim = createAuthoringTestTribute({
      id: "victim",
    });

    const killer = createAuthoringTestTribute({
      id: "killer",
    });

    const owner = withItem(
      createAuthoringTestTribute({
        id: "owner",
      }),
      "knife",
    );

    const truce = createTruceInstance(
      "shared-weapon-truce",
      [killer.id, owner.id],
      AUTHORING_TEST_ROUND,
      {
        day: 2,
        period: "night",
      },
    );

    const state = {
      ...createAuthoringTestGame([victim, killer, owner]),

      truces: [truce],
    };

    const { resolution } = selectAndResolve(
      createWeaponAttackEvent("shared-weapon-kill", {
        weaponId: "knife",
        causeLabel: "Knifed",
        text: "Fatal attack.",
      }),
      state,
      [victim, killer],
    );

    expect(resolution.changes).toContainEqual({
      type: "use-item",
      tributeId: owner.id,
      itemInstanceId: owner.inventory[0].id,
      reason: "shared-weapon-kill",
    });
  });

  it("supports a nonfatal checked failure", () => {
    const victim = createAuthoringTestTribute({
      id: "victim",
    });

    const killer = withItem(
      createAuthoringTestTribute({
        id: "killer",
      }),
      "knife",
    );

    const state = createAuthoringTestGame([victim, killer]);

    const definition = createWeaponAttackEvent("failed-weapon-attack", {
      weaponId: "knife",
      causeLabel: "Knifed",
      text: "Fatal success.",

      check: () => "failure",

      failure: result({
        text: "The victim escapes.",

        effects: [applyStatus("victim", "injured", 1)],
      }),
    });

    expect(definition.category).toBe("hazard");
    expect(definition.tags).toEqual(["hazard", "combat", "weapon", "fatal"]);

    const { resolution } = selectAndResolve(definition, state, [victim, killer]);

    expect(resolution.text).toBe("The victim escapes.");

    expect(resolution.changes.some((change) => change.type === "eliminate-tribute")).toBe(false);

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: victim.id,
      }),
    );

    expect(resolution.changes).toContainEqual({
      type: "use-item",
      tributeId: killer.id,
      itemInstanceId: killer.inventory[0].id,
      reason: "failed-weapon-attack",
    });

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
  });

  it("forces a checked direct attack to succeed during safety resolution", () => {
    const victim = createAuthoringTestTribute({
      id: "safety-victim",
    });

    const killer = withItem(
      createAuthoringTestTribute({
        id: "safety-killer",
      }),

      "knife",
    );

    const state = createAuthoringTestGame([victim, killer]);

    const definition = createWeaponAttackEvent("safety-weapon-attack", {
      weaponId: "knife",

      causeLabel: "Knifed",

      text: "Forced fatal success.",

      /*
       * This check always fails in ordinary mode.
       */
      check: () => "failure",

      failure: result({
        text: "Ordinary failure.",
      }),

      safetyResolution: "force-success",
    });

    expect(definition.safetyResolution).toBe("force-success");

    const { resolution } = selectAndResolve(definition, state, [victim, killer], [0.999], "safety");

    expect(resolution.text).toBe("Forced fatal success.");

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",

        tributeId: victim.id,

        killerTributeIds: [killer.id],
      }),
    );

    expect(
      resolution.changes.filter(
        (change) =>
          change.type === "increment-statistic" &&
          change.tributeId === killer.id &&
          change.statistic === "attemptedKills",
      ),
    ).toHaveLength(1);
  });

  it("rejects invalid weapon declarations", () => {
    expect(() =>
      createWeaponAttackEvent("missing-weapon", {
        causeLabel: "Killed",
        text: "Fatal attack.",
      }),
    ).toThrow("must declare exactly one weapon ID or weapon tag");

    expect(() =>
      createWeaponAttackEvent("duplicate-weapon", {
        weaponId: "knife",
        weaponTag: "direct-weapon",
        causeLabel: "Killed",
        text: "Fatal attack.",
      }),
    ).toThrow("must declare exactly one weapon ID or weapon tag");

    expect(() =>
      createWeaponAttackEvent("slingshot-lethal-attack", {
        weaponId: "slingshot",

        causeLabel: "Killed",

        text: "Invalid attack.",
      }),
    ).toThrow("is not a direct-combat weapon");

    expect(() =>
      createWeaponAttackEvent("generic-weapon-attack", {
        weaponTag: "weapon",

        causeLabel: "Killed",

        text: "Invalid attack.",
      }),
    ).toThrow('must use the "direct-weapon" tag');
  });

  it("rejects incomplete checked attacks", () => {
    expect(() =>
      createWeaponAttackEvent("missing-failure", {
        weaponId: "knife",
        causeLabel: "Knifed",
        text: "Fatal success.",
        check: () => "failure",
      }),
    ).toThrow("requires a failure result");

    expect(() =>
      createWeaponAttackEvent("unreachable-failure", {
        weaponId: "knife",
        causeLabel: "Knifed",
        text: "Fatal success.",

        failure: result({
          text: "Failure.",
        }),
      }),
    ).toThrow("unreachable failure result");
  });

  it("marks weapon victims as hostile targets", () => {
    const definition = createWeaponAttackEvent("hostile-target-test", {
      weaponId: "knife",
      causeLabel: "Knifed",
      text: "Test attack.",
    });

    const victimRole = definition.roles.find((role) => role.id === "victim");

    expect(victimRole?.targeting).toBe("hostile");
  });
});
