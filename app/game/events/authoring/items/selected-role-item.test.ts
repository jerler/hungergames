import { describe, expect, it } from "vitest";

import { createSelectedRoleItemUseChanges, getSelectedRoleItem } from "~/game/events/authoring";
import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventResolutionContext } from "~/game/events/event-schema";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";

function createContext(itemId?: ItemDefinitionId): EventResolutionContext {
  const user = createAuthoringTestTribute({ id: "user" });
  const owner = createAuthoringTestTribute({ id: "owner" });

  const item = itemId
    ? createInventoryItemInstance("selected-item-test", owner.id, itemId, AUTHORING_TEST_ROUND)
    : null;

  return {
    state: createAuthoringTestGame([user, owner]),
    round: AUTHORING_TEST_ROUND,
    livingTributes: [user, owner],
    eventId: "test:selected-item",
    random: () => 0,
    participantsByRole: { tribute: [user] },
    itemsByRole: {
      tribute: item ? [{ userTributeId: user.id, owner, item }] : [],
    },
  };
}

describe("selected role item helpers", () => {
  it("returns no item and no changes when optional selection is empty", () => {
    const context = createContext();

    expect(getSelectedRoleItem(context, "tribute")).toBeNull();
    expect(createSelectedRoleItemUseChanges(context, "tribute")).toEqual([]);
  });

  it.each([
    { itemId: "food", expectedType: "consume-item" },
    { itemId: "shield", expectedType: "use-item" },
  ] as const)("records $expectedType against the physical owner", ({ itemId, expectedType }) => {
    const context = createContext(itemId);
    const selection = getSelectedRoleItem(context, "tribute");

    expect(createSelectedRoleItemUseChanges(context, "tribute")).toEqual([
      expect.objectContaining({
        type: expectedType,
        tributeId: "owner",
        itemInstanceId: selection?.item.id,
        reason: "test:selected-item",
      }),
    ]);
  });
});
