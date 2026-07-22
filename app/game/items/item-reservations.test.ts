import { describe, expect, it } from "vitest";

import type { GameChange, InventoryItem } from "~/game/types/game-state";

import { getCommittedItemInstanceIds } from "./item-reservations";

const TEST_ITEM: InventoryItem = {
  id: "source-event:tribute-1:knife",
  definitionId: "knife",
  usesRemaining: null,

  sourceEventId: "source-event",

  acquiredRound: {
    day: 1,
    period: "day",
  },
};

describe("getCommittedItemInstanceIds", () => {
  it("returns an acquired item's physical instance ID", () => {
    const changes: readonly GameChange[] = [
      {
        type: "acquire-item",
        tributeId: "tribute-1",
        acquisitionSource: "cornucopia",
        item: TEST_ITEM,
      },
    ];

    expect(getCommittedItemInstanceIds(changes)).toEqual([TEST_ITEM.id]);
  });

  it("returns IDs from use-item changes", () => {
    const changes: readonly GameChange[] = [
      {
        type: "use-item",
        tributeId: "tribute-1",
        itemInstanceId: TEST_ITEM.id,
        reason: "test-use",
      },
    ];

    expect(getCommittedItemInstanceIds(changes)).toEqual([TEST_ITEM.id]);
  });

  it("returns IDs from consume-item changes", () => {
    const changes: readonly GameChange[] = [
      {
        type: "consume-item",
        tributeId: "tribute-1",
        itemInstanceId: TEST_ITEM.id,
        uses: 1,
        reason: "test-consumption",
      },
    ];

    expect(getCommittedItemInstanceIds(changes)).toEqual([TEST_ITEM.id]);
  });

  it("returns IDs from transfer-item changes", () => {
    const changes: readonly GameChange[] = [
      {
        type: "transfer-item",
        itemInstanceId: TEST_ITEM.id,
        fromTributeId: "tribute-1",
        toTributeId: "tribute-2",
        reason: "test-transfer",
      },
    ];

    expect(getCommittedItemInstanceIds(changes)).toEqual([TEST_ITEM.id]);
  });

  it("ignores changes unrelated to inventory commitments", () => {
    const changes: readonly GameChange[] = [
      {
        type: "increment-statistic",
        tributeId: "tribute-1",
        statistic: "eventsSurvived",
        amount: 1,
      },
    ];

    expect(getCommittedItemInstanceIds(changes)).toEqual([]);
  });

  it("produces deterministic output in change order", () => {
    const changes: readonly GameChange[] = [
      {
        type: "use-item",
        tributeId: "tribute-1",
        itemInstanceId: "item-one",
        reason: "test-use",
      },
      {
        type: "transfer-item",
        itemInstanceId: "item-two",
        fromTributeId: "tribute-2",
        toTributeId: "tribute-1",
        reason: "test-transfer",
      },
    ];

    expect(getCommittedItemInstanceIds(changes)).toEqual(getCommittedItemInstanceIds(changes));

    expect(getCommittedItemInstanceIds(changes)).toEqual(["item-one", "item-two"]);
  });

  it("preserves duplicate commitments", () => {
    const changes: readonly GameChange[] = [
      {
        type: "use-item",
        tributeId: "tribute-1",
        itemInstanceId: TEST_ITEM.id,
        reason: "test-use",
      },
      {
        type: "transfer-item",
        itemInstanceId: TEST_ITEM.id,
        fromTributeId: "tribute-1",
        toTributeId: "tribute-2",
        reason: "test-transfer",
      },
    ];

    expect(getCommittedItemInstanceIds(changes)).toEqual([TEST_ITEM.id, TEST_ITEM.id]);
  });
});
