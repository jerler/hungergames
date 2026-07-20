import { describe, expect, it } from "vitest";

import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import { createCombatantRole } from "~/game/events/participant-role-builders";
import { createTruceInstance } from "~/game/truces/truce-engine";

describe("item-based participant selection", () => {
  it("only selects an armed tribute for a weapon role", () => {
    const config = {
      ...createDefaultGameConfig(),
      districtCount: 6 as const,
    };

    let nextId = 0;

    const game = createInitialGameState(
      config,
      createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
      "random",
      {
        createId: () => {
          nextId += 1;
          return `id-${nextId}`;
        },
        seed: "weapon-role",
        now: "2026-07-18T12:00:00.000Z",
      },
    );

    const armedTribute = {
      ...game.tributes[0],

      inventory: [
        createInventoryItemInstance("weapon-event", game.tributes[0].id, "knife", {
          day: 1,
          period: "day",
        }),
      ],
    };

    const context: EventSelectionContext = {
      state: game,
      round: {
        day: 1,
        period: "day",
      },

      livingTributes: [armedTribute, ...game.tributes.slice(1)],
    };

    const definition: EventDefinition = {
      id: "test-weapon-event",
      category: "fatal",
      tags: ["fatal", "weapon"],
      periods: ["day"],
      baseWeight: 1,

      roles: [
        {
          id: "killer",
          count: 1,
          requiredItemTags: ["weapon"],
        },
        {
          id: "victim",
          count: 1,
        },
      ],

      resolve: () => ({
        text: "Test event.",
        changes: [],
      }),
    };

    const selection = selectEventParticipants(definition, context, () => 0, new Set());

    expect(selection?.participantsByRole.killer[0].id).toBe(armedTribute.id);
  });

  it("does not select truce partners as opposing combatants", () => {
    const config = {
      ...createDefaultGameConfig(),
      districtCount: 6 as const,
    };

    let nextId = 0;

    const game = createInitialGameState(
      config,
      createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
      "random",
      {
        createId: () => {
          nextId += 1;

          return `truce-id-${nextId}`;
        },

        seed: "truce-combat",

        now: "2026-07-20T12:00:00.000Z",
      },
    );

    const victim = game.tributes[0];

    const trucePartner = {
      ...game.tributes[1],

      inventory: [
        createInventoryItemInstance("partner-weapon", game.tributes[1].id, "knife", {
          day: 1,
          period: "day",
        }),
      ],
    };

    const outsider = {
      ...game.tributes[2],

      inventory: [
        createInventoryItemInstance("outsider-weapon", game.tributes[2].id, "knife", {
          day: 1,
          period: "day",
        }),
      ],
    };

    const truce = createTruceInstance(
      "truce-event",
      [victim.id, trucePartner.id],
      {
        day: 1,
        period: "day",
      },
      {
        day: 1,
        period: "night",
      },
    );

    const state = {
      ...game,

      tributes: game.tributes.map((tribute) => {
        if (tribute.id === trucePartner.id) {
          return trucePartner;
        }

        if (tribute.id === outsider.id) {
          return outsider;
        }

        return tribute;
      }),

      truces: [truce],
    };

    const definition: EventDefinition = {
      id: "test-truce-combat",

      category: "fatal",
      tags: ["fatal", "combat", "weapon"],
      periods: ["day"],
      baseWeight: 1,

      roles: [
        {
          id: "victim",
          count: 1,

          isEligible: (tribute) => tribute.id === victim.id,
        },

        createCombatantRole({
          requiredItemDefinitionIds: ["knife"],
        }),
      ],

      resolve: () => ({
        text: "Test event.",
        changes: [],
      }),
    };

    const blockedSelection = selectEventParticipants(
      definition,
      {
        state,
        round: {
          day: 1,
          period: "day",
        },

        livingTributes: [victim, trucePartner],
      },
      () => 0,
      new Set(),
    );

    expect(blockedSelection).toBeNull();

    const validSelection = selectEventParticipants(
      definition,
      {
        state,
        round: {
          day: 1,
          period: "day",
        },

        livingTributes: [victim, trucePartner, outsider],
      },
      () => 0,
      new Set(),
    );

    expect(validSelection?.participantsByRole.killer[0].id).toBe(outsider.id);
  });
});
