import { describe, expect, it } from "vitest";

import {
  always,
  consumeRequiredItem,
  createEvent,
  hasItem,
  hasItemTag,
  result,
  soloRole,
  recordRequiredItemUse,
} from "~/game/events/authoring";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { reserveEventCommitments } from "~/game/engine/event-sequencer";
import type {
  EventDefinition,
  EventResolution,
  EventSelectionContext,
} from "~/game/events/event-schema";
import {
  selectEventParticipants,
  type ParticipantSelection,
} from "~/game/events/participant-selection";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameState, GameTribute, InventoryItem } from "~/game/types/game-state";

import type { EventEffect } from "./effect-schema";

const ROUND = {
  day: 2,
  period: "day",
} as const;

function createItem(
  owner: GameTribute,
  definitionId: ItemDefinitionId,
  sourceEventId: string,
): InventoryItem {
  return createInventoryItemInstance(sourceEventId, owner.id, definitionId, ROUND);
}

function withItems(tribute: GameTribute, items: readonly InventoryItem[]): GameTribute {
  return {
    ...tribute,

    inventory: [...tribute.inventory, ...items],
  };
}

function createState(tributes: readonly GameTribute[]): GameState {
  return createAuthoringTestGame(tributes);
}

function createTruceState(tributes: readonly GameTribute[]): GameState {
  const baseState = createState(tributes);

  return {
    ...baseState,

    truces: [
      createTruceInstance(
        "required-item-test-truce",

        tributes.map((tribute) => tribute.id),

        ROUND,

        {
          day: 3,
          period: "day",
        },
      ),
    ],
  };
}

interface RequiredItemEventOptions {
  id: string;
  definitionId: ItemDefinitionId;
  access?: "accessible" | "owned";
  effects?: readonly EventEffect[];
}

function createRequiredItemEvent({
  id,
  definitionId,
  access = "accessible",
  effects = [],
}: RequiredItemEventOptions): EventDefinition {
  return createEvent(id)
    .roles(soloRole("tribute"))
    .when(
      hasItem("tribute", {
        definitionIds: [definitionId],

        access,
      }),
    )
    .during("day")
    .resolve(
      always(
        result({
          text: "The item is used.",

          effects,
        }),
      ),
    );
}

function createSelectionContext(
  state: GameState,
  livingTributes: readonly GameTribute[] = state.tributes,
): EventSelectionContext {
  return {
    state,
    round: ROUND,
    livingTributes,
  };
}

function selectParticipants(
  definition: EventDefinition,
  state: GameState,
  {
    livingTributes = state.tributes,

    unavailableTributeIds = new Set<string>(),

    unavailableItemInstanceIds = new Set<string>(),

    random = () => 0,
  }: {
    livingTributes?: readonly GameTribute[];

    unavailableTributeIds?: ReadonlySet<string>;

    unavailableItemInstanceIds?: ReadonlySet<string>;

    random?: () => number;
  } = {},
): ParticipantSelection | null {
  return selectEventParticipants(
    definition,

    createSelectionContext(state, livingTributes),

    random,

    unavailableTributeIds,
    unavailableItemInstanceIds,
  );
}

function resolveSelection(
  definition: EventDefinition,
  state: GameState,
  selection: ParticipantSelection,
  eventId = "resolved-required-item-event",
): EventResolution {
  return definition.resolve({
    state,
    round: ROUND,

    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),

    eventId,
    random: () => 0,

    participantsByRole: selection.participantsByRole,

    itemsByRole: selection.itemsByRole,

    unavailableItemInstanceIds: new Set(),
  });
}

describe("required-item selection", () => {
  it("requires an owned item when access is owned", () => {
    const user = createAuthoringTestTribute({
      id: "user",
    });

    const partner = createAuthoringTestTribute({
      id: "partner",
    });

    const partnerMap = createItem(partner, "map", "partner-map");

    const equippedPartner = withItems(partner, [partnerMap]);

    const state = createTruceState([user, equippedPartner]);

    const definition = createRequiredItemEvent({
      id: "owned-map-requirement",

      definitionId: "map",

      access: "owned",
    });

    const selection = selectParticipants(definition, state, {
      livingTributes: [user],
    });

    expect(selection).toBeNull();
  });

  it("selects a tribute's personally owned item", () => {
    const tribute = createAuthoringTestTribute({
      id: "owner",
    });

    const map = createItem(tribute, "map", "owned-map");

    const equippedTribute = withItems(tribute, [map]);

    const state = createState([equippedTribute]);

    const definition = createRequiredItemEvent({
      id: "owned-item-selection",

      definitionId: "map",

      access: "owned",
    });

    const selection = selectParticipants(definition, state);

    expect(selection?.itemsByRole.tribute[0]).toMatchObject({
      userTributeId: equippedTribute.id,

      owner: {
        id: equippedTribute.id,
      },

      item: {
        id: map.id,
        definitionId: "map",
      },
    });

    expect(selection?.selectedItemInstanceIds).toEqual([map.id]);
  });

  it("selects an accessible item owned by a truce partner", () => {
    const user = createAuthoringTestTribute({
      id: "user",
    });

    const partner = createAuthoringTestTribute({
      id: "partner",
    });

    const map = createItem(partner, "map", "shared-map");

    const equippedPartner = withItems(partner, [map]);

    const state = createTruceState([user, equippedPartner]);

    const definition = createRequiredItemEvent({
      id: "accessible-map-selection",

      definitionId: "map",
    });

    const selection = selectParticipants(definition, state, {
      livingTributes: [user],
    });

    expect(selection?.participantsByRole.tribute).toEqual([user]);

    expect(selection?.itemsByRole.tribute[0]).toMatchObject({
      userTributeId: user.id,

      owner: {
        id: equippedPartner.id,
      },

      item: {
        id: map.id,
        definitionId: "map",
      },
    });
  });

  it("selects an item matching a required tag", () => {
    const tribute = createAuthoringTestTribute({
      id: "fisher",
    });

    const fishingGear = createItem(tribute, "fishing-gear", "tagged-fishing-gear");

    const equippedTribute = withItems(tribute, [fishingGear]);

    const state = createState([equippedTribute]);

    const definition = createEvent("fishing-tag-requirement")
      .roles(soloRole("tribute"))
      .when(
        hasItemTag("tribute", {
          tags: ["fishing"],

          access: "owned",
        }),
      )
      .during("day")
      .resolve(
        always(
          result({
            text: "The item is selected.",
          }),
        ),
      );

    const selection = selectParticipants(definition, state);

    expect(selection?.itemsByRole.tribute[0].item.definitionId).toBe("fishing-gear");
  });

  it("rejects a depleted limited-use item", () => {
    const tribute = createAuthoringTestTribute({
      id: "depleted-owner",
    });

    const fishingGear = {
      ...createItem(tribute, "fishing-gear", "depleted-gear"),

      usesRemaining: 0,
    };

    const equippedTribute = withItems(tribute, [fishingGear]);

    const state = createState([equippedTribute]);

    const definition = createRequiredItemEvent({
      id: "depleted-item-rejection",

      definitionId: "fishing-gear",
    });

    expect(selectParticipants(definition, state)).toBeNull();
  });

  it("rejects an already-reserved physical item", () => {
    const tribute = createAuthoringTestTribute({
      id: "reserved-owner",
    });

    const map = createItem(tribute, "map", "reserved-map");

    const equippedTribute = withItems(tribute, [map]);

    const state = createState([equippedTribute]);

    const definition = createRequiredItemEvent({
      id: "reserved-item-rejection",

      definitionId: "map",
    });

    expect(
      selectParticipants(definition, state, {
        unavailableItemInstanceIds: new Set([map.id]),
      }),
    ).toBeNull();
  });

  it("selects the same physical item deterministically", () => {
    const tribute = createAuthoringTestTribute({
      id: "deterministic-owner",
    });

    const firstMap = createItem(tribute, "map", "first-map");

    const secondMap = createItem(tribute, "map", "second-map");

    const equippedTribute = withItems(tribute, [firstMap, secondMap]);

    const state = createState([equippedTribute]);

    const definition = createRequiredItemEvent({
      id: "deterministic-item-selection",

      definitionId: "map",
    });

    const firstSelection = selectParticipants(definition, state, {
      random: () => 0.75,
    });

    const secondSelection = selectParticipants(definition, state, {
      random: () => 0.75,
    });

    expect(firstSelection?.selectedItemInstanceIds).toEqual([firstMap.id]);

    expect(secondSelection?.selectedItemInstanceIds).toEqual(
      firstSelection?.selectedItemInstanceIds,
    );
  });
});

describe("required-item effects", () => {
  it("emits use-item for reusable equipment", () => {
    const tribute = createAuthoringTestTribute({
      id: "map-user",
    });

    const map = createItem(tribute, "map", "reusable-map");

    const equippedTribute = withItems(tribute, [map]);

    const state = createState([equippedTribute]);

    const definition = createRequiredItemEvent({
      id: "reusable-item-use",

      definitionId: "map",

      effects: [recordRequiredItemUse("tribute")],
    });

    const selection = selectParticipants(definition, state);

    if (!selection) {
      throw new Error("Expected a required-item selection.");
    }

    const resolution = resolveSelection(definition, state, selection, "resolved-map-use");

    expect(resolution.changes).toEqual([
      {
        type: "use-item",

        tributeId: equippedTribute.id,

        itemInstanceId: map.id,

        reason: "resolved-map-use",
      },
    ]);
  });

  it("emits consume-item for limited-use equipment", () => {
    const tribute = createAuthoringTestTribute({
      id: "fishing-user",
    });

    const fishingGear = createItem(tribute, "fishing-gear", "limited-fishing-gear");

    const equippedTribute = withItems(tribute, [fishingGear]);

    const state = createState([equippedTribute]);

    const definition = createRequiredItemEvent({
      id: "limited-item-consumption",

      definitionId: "fishing-gear",

      effects: [consumeRequiredItem("tribute")],
    });

    const selection = selectParticipants(definition, state);

    if (!selection) {
      throw new Error("Expected a required-item selection.");
    }

    const resolution = resolveSelection(definition, state, selection, "resolved-fishing-use");

    expect(resolution.changes).toEqual([
      {
        type: "consume-item",

        tributeId: equippedTribute.id,

        itemInstanceId: fishingGear.id,

        uses: 1,

        reason: "resolved-fishing-use",
      },
    ]);
  });

  it("records the physical truce-partner owner", () => {
    const user = createAuthoringTestTribute({
      id: "borrower",
    });

    const owner = createAuthoringTestTribute({
      id: "physical-owner",
    });

    const map = createItem(owner, "map", "borrowed-map");

    const equippedOwner = withItems(owner, [map]);

    const state = createTruceState([user, equippedOwner]);

    const definition = createRequiredItemEvent({
      id: "shared-owner-use",

      definitionId: "map",

      effects: [recordRequiredItemUse("tribute")],
    });

    const selection = selectParticipants(definition, state, {
      livingTributes: [user],
    });

    if (!selection) {
      throw new Error("Expected shared item selection.");
    }

    const resolution = resolveSelection(definition, state, selection);

    expect(resolution.changes[0]).toMatchObject({
      type: "use-item",

      tributeId: equippedOwner.id,

      itemInstanceId: map.id,
    });
  });

  it("supports an explicit reason override", () => {
    const tribute = createAuthoringTestTribute({
      id: "reason-user",
    });

    const map = createItem(tribute, "map", "reason-map");

    const equippedTribute = withItems(tribute, [map]);

    const state = createState([equippedTribute]);

    const definition = createRequiredItemEvent({
      id: "item-reason-override",

      definitionId: "map",

      effects: [
        recordRequiredItemUse("tribute", {
          reason: "navigation-check",
        }),
      ],
    });

    const selection = selectParticipants(definition, state);

    if (!selection) {
      throw new Error("Expected required item selection.");
    }

    const resolution = resolveSelection(definition, state, selection);

    expect(resolution.changes[0]).toMatchObject({
      reason: "navigation-check",
    });
  });

  it("rejects an item effect when the role has no required item", () => {
    expect(() =>
      createEvent("invalid-required-item-effect")
        .solo()
        .during("day")
        .resolve(
          always(
            result({
              text: "The event resolves.",

              effects: [recordRequiredItemUse("tribute")],
            }),
          ),
        ),
    ).toThrow(
      'Event "invalid-required-item-effect": effect "use-required-item" requires role "tribute" to declare a required-item requirement.',
    );
  });

  it("rejects recordRequiredItemUse for limited-use equipment", () => {
    const tribute = createAuthoringTestTribute({
      id: "wrong-use-user",
    });

    const fishingGear = createItem(tribute, "fishing-gear", "wrong-use-gear");

    const equippedTribute = withItems(tribute, [fishingGear]);

    const state = createState([equippedTribute]);

    const definition = createRequiredItemEvent({
      id: "wrong-limited-use-effect",

      definitionId: "fishing-gear",

      effects: [recordRequiredItemUse("tribute")],
    });

    const selection = selectParticipants(definition, state);

    if (!selection) {
      throw new Error("Expected required item selection.");
    }

    expect(() => resolveSelection(definition, state, selection)).toThrow(
      'effect "use-required-item" expected a reusable item for role "tribute", but selected "fishing-gear" has limited uses.',
    );
  });

  it("rejects consumeRequiredItem for reusable equipment", () => {
    const tribute = createAuthoringTestTribute({
      id: "wrong-consume-user",
    });

    const map = createItem(tribute, "map", "wrong-consume-map");

    const equippedTribute = withItems(tribute, [map]);

    const state = createState([equippedTribute]);

    const definition = createRequiredItemEvent({
      id: "wrong-reusable-consume-effect",

      definitionId: "map",

      effects: [consumeRequiredItem("tribute")],
    });

    const selection = selectParticipants(definition, state);

    if (!selection) {
      throw new Error("Expected required item selection.");
    }

    expect(() => resolveSelection(definition, state, selection)).toThrow(
      'effect "consume-required-item" expected a limited-use item for role "tribute", but selected "map" is reusable.',
    );
  });
});

describe("required-item round reservations", () => {
  it("reserves the physical owner and selected item instance", () => {
    const firstUser = createAuthoringTestTribute({
      id: "first-user",
    });

    const secondUser = createAuthoringTestTribute({
      id: "second-user",
    });

    const owner = createAuthoringTestTribute({
      id: "item-owner",
    });

    const map = createItem(owner, "map", "reservation-map");

    const equippedOwner = withItems(owner, [map]);

    const state = createTruceState([firstUser, secondUser, equippedOwner]);

    const definition = createRequiredItemEvent({
      id: "required-item-reservations",

      definitionId: "map",

      effects: [recordRequiredItemUse("tribute")],
    });

    const firstSelection = selectParticipants(definition, state, {
      livingTributes: [firstUser],
    });

    if (!firstSelection) {
      throw new Error("Expected first required-item selection.");
    }

    const firstResolution = resolveSelection(definition, state, firstSelection);

    const unavailableTributeIds = new Set<string>();

    const unavailableItemInstanceIds = new Set<string>();

    reserveEventCommitments(
      firstSelection,
      firstResolution.changes,
      unavailableTributeIds,
      unavailableItemInstanceIds,
    );

    expect(unavailableTributeIds).toContain(firstUser.id);

    expect(unavailableTributeIds).toContain(equippedOwner.id);

    expect(unavailableItemInstanceIds).toContain(map.id);

    const secondSelection = selectParticipants(definition, state, {
      livingTributes: [secondUser],

      unavailableTributeIds,

      unavailableItemInstanceIds,
    });

    expect(secondSelection).toBeNull();
  });
});
