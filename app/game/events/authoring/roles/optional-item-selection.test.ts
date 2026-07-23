import { describe, expect, it } from "vitest";

import { always, createEvent, hasItem, result } from "~/game/events/authoring";
import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameState, GameTribute } from "~/game/types/game-state";

function withItem(tribute: GameTribute, itemId: ItemDefinitionId): GameTribute {
  return {
    ...tribute,

    inventory: [
      ...tribute.inventory,

      createInventoryItemInstance(
        `optional-item-test:${itemId}`,
        tribute.id,
        itemId,
        AUTHORING_TEST_ROUND,
      ),
    ],
  };
}

function createOptionalItemEvent(access: "accessible" | "owned" = "accessible") {
  return createEvent("optional-item-selection")
    .solo("tribute", {
      optionalItem: {
        definitionIds: ["food"],
        access,
      },
    })
    .category("hazard")
    .tags("hazard", "item")
    .during("day")
    .weight(1)
    .resolve(
      always(
        result({
          text: "Optional item selected.",
        }),
      ),
    );
}

function select(
  definition: ReturnType<typeof createOptionalItemEvent>,
  state: GameState,
  tribute: GameTribute,
  unavailableItemInstanceIds: ReadonlySet<string> = new Set(),
  unavailableTributeIds: ReadonlySet<string> = new Set(),
) {
  return selectEventParticipants(
    definition,
    {
      state,
      round: AUTHORING_TEST_ROUND,
      livingTributes: [tribute],
    },
    () => 0,
    unavailableTributeIds,
    unavailableItemInstanceIds,
  );
}

describe("optional authored role items", () => {
  it("does not require the optional item for eligibility", () => {
    const tribute = createAuthoringTestTribute({
      id: "forager",
    });

    const state = createAuthoringTestGame([tribute]);

    const selection = select(createOptionalItemEvent(), state, tribute);

    expect(selection).not.toBeNull();
    expect(selection?.participantTributeIds).toEqual([tribute.id]);
    expect(selection?.itemsByRole.tribute).toEqual([]);
    expect(selection?.selectedItemInstanceIds).toEqual([]);
  });

  it("selects and reserves an owned optional item", () => {
    const tribute = withItem(
      createAuthoringTestTribute({
        id: "owner",
      }),
      "food",
    );

    const state = createAuthoringTestGame([tribute]);
    const food = tribute.inventory[0];

    const selection = select(createOptionalItemEvent(), state, tribute);

    expect(selection?.itemsByRole.tribute?.[0]).toMatchObject({
      userTributeId: tribute.id,
      owner: {
        id: tribute.id,
      },
      item: {
        id: food.id,
        definitionId: "food",
      },
    });

    expect(selection?.selectedItemInstanceIds).toEqual([food.id]);
  });

  it("selects an optional item from a truce partner", () => {
    const tribute = createAuthoringTestTribute({
      id: "user",
    });

    const owner = withItem(
      createAuthoringTestTribute({
        id: "partner",
      }),
      "food",
    );

    const truce = createTruceInstance(
      "optional-item-truce",
      [tribute.id, owner.id],
      AUTHORING_TEST_ROUND,
      {
        day: 1,
        period: "night",
      },
    );

    const state = {
      ...createAuthoringTestGame([tribute, owner]),
      truces: [truce],
    };

    const food = owner.inventory[0];

    const selection = select(createOptionalItemEvent(), state, tribute);

    expect(selection?.itemsByRole.tribute?.[0]).toMatchObject({
      userTributeId: tribute.id,
      owner: {
        id: owner.id,
      },
      item: {
        id: food.id,
        definitionId: "food",
      },
    });

    expect(selection?.selectedItemInstanceIds).toEqual([food.id]);
  });

  it("ignores a reserved optional item without rejecting the participant", () => {
    const tribute = withItem(
      createAuthoringTestTribute({
        id: "reserved-owner",
      }),
      "food",
    );

    const state = createAuthoringTestGame([tribute]);
    const food = tribute.inventory[0];

    const selection = select(createOptionalItemEvent(), state, tribute, new Set([food.id]));

    expect(selection).not.toBeNull();
    expect(selection?.itemsByRole.tribute).toEqual([]);
    expect(selection?.selectedItemInstanceIds).toEqual([]);
  });

  it("respects owned-only optional access", () => {
    const tribute = createAuthoringTestTribute({
      id: "owned-user",
    });

    const owner = withItem(
      createAuthoringTestTribute({
        id: "owned-partner",
      }),
      "food",
    );

    const truce = createTruceInstance(
      "owned-optional-item-truce",
      [tribute.id, owner.id],
      AUTHORING_TEST_ROUND,
      {
        day: 1,
        period: "night",
      },
    );

    const state = {
      ...createAuthoringTestGame([tribute, owner]),
      truces: [truce],
    };

    const selection = select(createOptionalItemEvent("owned"), state, tribute);

    expect(selection).not.toBeNull();
    expect(selection?.itemsByRole.tribute).toEqual([]);
  });

  it("does not select an item from an unavailable owner", () => {
    const tribute = createAuthoringTestTribute({
      id: "available-user",
    });

    const owner = withItem(
      createAuthoringTestTribute({
        id: "unavailable-owner",
      }),
      "food",
    );

    const truce = createTruceInstance(
      "unavailable-owner-truce",
      [tribute.id, owner.id],
      AUTHORING_TEST_ROUND,
      {
        day: 1,
        period: "night",
      },
    );

    const state = {
      ...createAuthoringTestGame([tribute, owner]),
      truces: [truce],
    };

    const selection = select(
      createOptionalItemEvent(),
      state,
      tribute,
      new Set(),
      new Set([owner.id]),
    );

    expect(selection).not.toBeNull();
    expect(selection?.itemsByRole.tribute).toEqual([]);
  });

  it("rejects empty optional item criteria", () => {
    expect(() =>
      createEvent("empty-optional-item")
        .solo("tribute", {
          optionalItem: {},
        })
        .category("hazard")
        .tags("hazard")
        .during("day")
        .weight(1)
        .resolve(
          always(
            result({
              text: "Invalid.",
            }),
          ),
        ),
    ).toThrow("without item definitions or tags");
  });

  it("rejects required and optional selection on the same role", () => {
    expect(() =>
      createEvent("conflicting-item-selection")
        .solo("tribute", {
          optionalItem: {
            definitionIds: ["food"],
          },
        })
        .when(
          hasItem("tribute", {
            definitionIds: ["map"],
          }),
        )
        .category("hazard")
        .tags("hazard", "item")
        .during("day")
        .weight(1)
        .resolve(
          always(
            result({
              text: "Invalid.",
            }),
          ),
        ),
    ).toThrow("cannot declare both required and optional item selection");
  });

  it("respects optional item definition priority", () => {
    const tribute = withItem(
      withItem(createAuthoringTestTribute({ id: "priority-owner" }), "shield"),
      "water",
    );

    const state = createAuthoringTestGame([tribute]);

    const definition = createEvent("optional-item-priority")
      .solo("tribute", {
        optionalItem: {
          definitionIds: ["water", "blanket", "shield"],
        },
      })
      .category("hazard")
      .tags("hazard", "item")
      .during("day")
      .weight(1)
      .resolve(always(result({ text: "Priority test." })));

    const selection = selectEventParticipants(
      definition,
      {
        state,
        round: AUTHORING_TEST_ROUND,
        livingTributes: [tribute],
      },
      () => 0,
      new Set(),
      new Set(),
    );

    expect(selection?.itemsByRole.tribute?.[0]?.item.definitionId).toBe("water");
  });
});
