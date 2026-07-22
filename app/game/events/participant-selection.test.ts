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
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { GameState, GameTribute, InventoryItem } from "~/game/types/game-state";

function createTestGame(seed = "participant-selection"): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,

    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),

    "random",

    {
      createId: () => {
        nextId += 1;

        return `${seed}-id-${nextId}`;
      },

      seed,

      now: "2026-07-22T12:00:00.000Z",
    },
  );
}

interface ItemAccessFixture {
  state: GameState;
  user: GameTribute;
  partner: GameTribute;
  item: InventoryItem;
}

function createItemAccessDefinition(
  definitionId: ItemDefinitionId,
  itemAccess?: "accessible" | "owned",
): EventDefinition {
  return {
    id: `test-${itemAccess ?? "default"}-` + `${definitionId}`,

    category: "survival",

    tags: ["survival", "item"],

    periods: ["day", "night"],

    baseWeight: 1,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: [definitionId],

        ...(itemAccess
          ? {
              itemAccess,
            }
          : {}),
      },
    ],

    resolve: () => ({
      text: "Test item-access event.",
      changes: [],
    }),
  };
}

function createItemAccessFixture({
  definitionId = "knife",
  owner = "partner",
  usesRemaining,
}: {
  definitionId?: ItemDefinitionId;
  owner?: "user" | "partner";
  usesRemaining?: number | null;
} = {}): ItemAccessFixture {
  const originalState = createTestGame(`item-access-${definitionId}-${owner}`);

  const [originalUser, originalPartner] = originalState.tributes;

  const originalOwner = owner === "user" ? originalUser : originalPartner;

  const createdItem = createInventoryItemInstance(
    "item-access-source",
    originalOwner.id,
    definitionId,

    {
      day: 1,
      period: "night",
    },
  );

  const item: InventoryItem =
    usesRemaining === undefined
      ? createdItem
      : {
          ...createdItem,
          usesRemaining,
        };

  const truce = createTruceInstance(
    "item-access-truce",
    [originalUser.id, originalPartner.id],
    {
      day: 1,
      period: "night",
    },
    {
      day: 2,
      period: "day",
    },
  );

  const state: GameState = {
    ...originalState,

    tributes: originalState.tributes.map((tribute) =>
      tribute.id === originalOwner.id
        ? {
            ...tribute,
            inventory: [item],
          }
        : tribute,
    ),

    truces: [truce],
  };

  const user = state.tributes.find((tribute) => tribute.id === originalUser.id);

  const partner = state.tributes.find((tribute) => tribute.id === originalPartner.id);

  if (!user || !partner) {
    throw new Error("Missing item-access test participants.");
  }

  return {
    state,
    user,
    partner,
    item,
  };
}

function selectItemAccessParticipant(
  fixture: ItemAccessFixture,
  definition: EventDefinition,
  unavailableItemInstanceIds: ReadonlySet<string> = new Set<string>(),
) {
  return selectEventParticipants(
    definition,

    {
      state: fixture.state,

      round: {
        day: 1,
        period: "night",
      },

      /*
       * Restrict the candidate list to the intended user.
       * Their truce partner remains in state so shared item
       * access can still be tested.
       */
      livingTributes: [fixture.user],
    },

    () => 0,

    new Set<string>(),

    unavailableItemInstanceIds,
  );
}

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

  it("does not let two selections reserve the same shared item", () => {
    const config = {
      ...createDefaultGameConfig(),
      districtCount: 6 as const,
    };

    let nextId = 0;

    const originalGame = createInitialGameState(
      config,
      createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
      "random",
      {
        createId: () => {
          nextId += 1;

          return `shared-id-${nextId}`;
        },

        seed: "shared-item-reservation",

        now: "2026-07-21T12:00:00.000Z",
      },
    );

    const firstUser = originalGame.tributes[0];

    const secondUser = originalGame.tributes[1];

    const itemOwner = {
      ...originalGame.tributes[2],

      inventory: [
        createInventoryItemInstance("shared-knife", originalGame.tributes[2].id, "knife", {
          day: 1,
          period: "day",
        }),
      ],
    };

    const knife = itemOwner.inventory[0];

    const truce = createTruceInstance(
      "shared-item-truce",
      [firstUser.id, secondUser.id, itemOwner.id],
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
      ...originalGame,

      tributes: originalGame.tributes.map((tribute) =>
        tribute.id === itemOwner.id ? itemOwner : tribute,
      ),

      truces: [truce],
    };

    const definition: EventDefinition = {
      id: "shared-knife-test",
      category: "hazard",
      tags: ["hazard", "weapon"],
      periods: ["day"],
      baseWeight: 1,

      roles: [
        {
          id: "tribute",
          count: 1,

          requiredItemDefinitionIds: ["knife"],
        },
      ],

      resolve: () => ({
        text: "Test event.",
        changes: [],
      }),
    };

    const firstSelection = selectEventParticipants(
      definition,
      {
        state,

        round: {
          day: 1,
          period: "day",
        },

        livingTributes: [firstUser],
      },
      () => 0,
      new Set(),
      new Set(),
    );

    expect(firstSelection?.selectedItemInstanceIds).toEqual([knife.id]);
    expect(firstSelection?.itemsByRole.tribute[0].owner.id).toBe(itemOwner.id);

    const ownerBlockedSelection = selectEventParticipants(
      definition,

      {
        state,

        round: {
          day: 1,
          period: "day",
        },

        livingTributes: [secondUser],
      },

      () => 0,

      /*
       * Simulate the item owner already being committed
       * to another event. Their item must no longer be
       * available for borrowing.
       */
      new Set([itemOwner.id]),

      /*
       * The item itself is not otherwise reserved. This
       * proves that owner reservation alone prevents the
       * unsafe selection.
       */
      new Set(),
    );

    expect(ownerBlockedSelection).toBeNull();

    const secondSelection = selectEventParticipants(
      definition,
      {
        state,

        round: {
          day: 1,
          period: "day",
        },

        livingTributes: [secondUser],
      },
      () => 0,
      new Set(),

      new Set(firstSelection?.selectedItemInstanceIds ?? []),
    );

    expect(secondSelection).toBeNull();
  });
});

describe("participant item-access modes", () => {
  it("defaults to accessible shared-item selection", () => {
    const fixture = createItemAccessFixture({
      owner: "partner",
    });

    const selection = selectItemAccessParticipant(
      fixture,

      createItemAccessDefinition("knife"),
    );

    expect(selection).not.toBeNull();

    expect(selection?.itemsByRole.tribute[0].owner.id).toBe(fixture.partner.id);

    expect(selection?.itemsByRole.tribute[0].item.id).toBe(fixture.item.id);
  });

  it("allows accessible mode to select the tribute's own item", () => {
    const fixture = createItemAccessFixture({
      owner: "user",
    });

    const selection = selectItemAccessParticipant(
      fixture,

      createItemAccessDefinition("knife", "accessible"),
    );

    expect(selection).not.toBeNull();

    expect(selection?.itemsByRole.tribute[0].owner.id).toBe(fixture.user.id);
  });

  it("allows accessible mode to select a truce partner's item", () => {
    const fixture = createItemAccessFixture({
      owner: "partner",
    });

    const selection = selectItemAccessParticipant(
      fixture,

      createItemAccessDefinition("knife", "accessible"),
    );

    expect(selection).not.toBeNull();

    expect(selection?.itemsByRole.tribute[0].owner.id).toBe(fixture.partner.id);
  });

  it("allows owned mode to select the tribute's own item", () => {
    const fixture = createItemAccessFixture({
      owner: "user",
    });

    const selection = selectItemAccessParticipant(
      fixture,

      createItemAccessDefinition("knife", "owned"),
    );

    expect(selection).not.toBeNull();

    expect(selection?.itemsByRole.tribute[0].owner.id).toBe(fixture.user.id);

    expect(selection?.itemsByRole.tribute[0].item.id).toBe(fixture.item.id);
  });

  it("does not allow owned mode to select a truce partner's item", () => {
    const fixture = createItemAccessFixture({
      owner: "partner",
    });

    const selection = selectItemAccessParticipant(
      fixture,

      createItemAccessDefinition("knife", "owned"),
    );

    expect(selection).toBeNull();
  });

  it.each(["accessible", "owned"] as const)(
    "does not select reserved items in %s mode",
    (itemAccess) => {
      const fixture = createItemAccessFixture({
        owner: itemAccess === "owned" ? "user" : "partner",
      });

      const selection = selectItemAccessParticipant(
        fixture,

        createItemAccessDefinition("knife", itemAccess),

        new Set([fixture.item.id]),
      );

      expect(selection).toBeNull();
    },
  );

  it.each(["accessible", "owned"] as const)(
    "does not select depleted items in %s mode",
    (itemAccess) => {
      const fixture = createItemAccessFixture({
        definitionId: "medicine",

        owner: itemAccess === "owned" ? "user" : "partner",

        usesRemaining: 0,
      });

      const selection = selectItemAccessParticipant(
        fixture,

        createItemAccessDefinition("medicine", itemAccess),
      );

      expect(selection).toBeNull();
    },
  );
});
