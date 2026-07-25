import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { createTruceInstance } from "~/game/truces/truce-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { TributeStats } from "~/game/types/tribute";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import type { RandomSource } from "~/game/engine/random";
import type { EventResolution } from "~/game/events/event-schema";
import type {
  AcquiredInventoryTransaction,
  GameChange,
  GameState,
  GameTribute,
  InventoryItem,
  InventoryTransaction,
  ResolvedEvent,
} from "~/game/types/game-state";
import { isItemUsableBy } from "~/game/items/item-usability";

import { getTheftDifficulty, STEAL_FROM_STRONGER_TRIBUTE_EVENT } from "./theft-events";

const TEST_ROUND = {
  day: 2,
  period: "day",
} as const;

const ITEM_ACQUISITION_ROUND = {
  day: 1,
  period: "day",
} as const;

const TRUCE_EXPIRY_ROUND = {
  day: 3,
  period: "day",
} as const;

function createTestGame(seed = "theft-selection"): GameState {
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

interface TheftFixtureOptions {
  thiefStats?: TributeStats;

  targetStats?: TributeStats;

  thiefItemDefinitionIds?: readonly ItemDefinitionId[];

  targetItemDefinitionIds?: readonly ItemDefinitionId[];

  targetItemUsesRemaining?: readonly (number | null)[];

  /**
   * Places every item listed in
   * thiefItemDefinitionIds in the partner's
   * inventory instead of the thief's.
   *
   * The fixture also creates an active truce
   * between the thief and the partner.
   */
  putThiefItemsOnPartner?: boolean;

  /**
   * Places every item listed in
   * targetItemDefinitionIds in the partner's
   * inventory instead of the target's.
   *
   * The fixture also creates an active truce
   * between the target and the partner.
   */
  putTargetItemsOnPartner?: boolean;

  thiefAndTargetShareTruce?: boolean;
}

interface TheftFixture {
  state: GameState;

  thief: GameTribute;
  target: GameTribute;
  partner: GameTribute;

  targetItems: InventoryItem[];
  thiefItems: InventoryItem[];
}

function createRecordedAcquisition(
  ownerId: string,
  item: InventoryItem,
): AcquiredInventoryTransaction {
  return {
    id: `acquire:${item.sourceEventId}:` + item.id,

    type: "acquired",

    tributeId: ownerId,

    itemInstanceId: item.id,
    definitionId: item.definitionId,

    uses: item.usesRemaining,

    round: {
      ...item.acquiredRound,
    },

    sourceId: item.sourceEventId,

    acquisitionSource: "cornucopia",
  };
}

function createTheftFixture({
  thiefStats = {
    brains: 2,
    brawn: 1,
    luck: 2,
  },

  targetStats = {
    brains: 5,
    brawn: 5,
    luck: 5,
  },

  thiefItemDefinitionIds = [],

  targetItemDefinitionIds = ["blanket"],

  targetItemUsesRemaining = [],

  putThiefItemsOnPartner = false,

  putTargetItemsOnPartner = false,

  thiefAndTargetShareTruce = false,
}: TheftFixtureOptions = {}): TheftFixture {
  const originalState = createTestGame();

  const [originalThief, originalTarget, originalPartner] = originalState.tributes;

  /*
   * The test fixture uses one partner tribute.
   * That partner cannot simultaneously belong
   * to multiple active truces.
   */
  const requestedTruceCount = [
    putThiefItemsOnPartner,
    putTargetItemsOnPartner,
    thiefAndTargetShareTruce,
  ].filter(Boolean).length;

  if (requestedTruceCount > 1) {
    throw new Error("The theft fixture supports only one active truce relationship at a time.");
  }

  /*
   * These variables determine who physically
   * owns each group of test items.
   *
   * The returned thiefItems and targetItems
   * arrays still identify the logical groups,
   * regardless of their physical owner.
   */
  const thiefItemOwner = putThiefItemsOnPartner ? originalPartner : originalThief;

  const targetItemOwner = putTargetItemsOnPartner ? originalPartner : originalTarget;

  const thiefItems = thiefItemDefinitionIds.map((definitionId, index) =>
    createInventoryItemInstance(
      `thief-item-${index}`,

      thiefItemOwner.id,

      definitionId,

      ITEM_ACQUISITION_ROUND,
    ),
  );

  const targetItems = targetItemDefinitionIds.map((definitionId, index) => {
    const createdItem = createInventoryItemInstance(
      `theft-item-${index}`,

      targetItemOwner.id,

      definitionId,

      ITEM_ACQUISITION_ROUND,
    );

    const usesRemaining = targetItemUsesRemaining[index];

    return usesRemaining === undefined
      ? createdItem
      : {
          ...createdItem,

          usesRemaining,
        };
  });

  const thief: GameTribute = {
    ...originalThief,

    snapshot: {
      ...originalThief.snapshot,

      name: "Thief",

      stats: {
        ...thiefStats,
      },
    },

    /*
     * When the partner owns the thief's test
     * items, the thief's personal inventory
     * must remain empty.
     */
    inventory: putThiefItemsOnPartner ? [] : thiefItems,

    statuses: [],
  };

  const target: GameTribute = {
    ...originalTarget,

    snapshot: {
      ...originalTarget.snapshot,

      name: "Target",

      stats: {
        ...targetStats,
      },
    },

    /*
     * Theft may select only target-owned items.
     * Existing tests use this option to prove
     * that a truce partner's inventory does not
     * count as the target's personal inventory.
     */
    inventory: putTargetItemsOnPartner ? [] : targetItems,

    statuses: [],
  };

  const partner: GameTribute = {
    ...originalPartner,

    snapshot: {
      ...originalPartner.snapshot,

      name: "Partner",
    },

    /*
     * The partner can hold either:
     *
     * - the thief's optional slingshot, or
     * - the target's test items.
     *
     * The guard near the top prevents both
     * arrangements from being requested at
     * the same time.
     */
    inventory: [
      ...(putThiefItemsOnPartner ? thiefItems : []),

      ...(putTargetItemsOnPartner ? targetItems : []),
    ],

    statuses: [],
  };

  const truces = [];

  /*
   * This relationship allows the thief to
   * access a partner-owned slingshot through
   * optionalItemAccess: "accessible".
   */
  if (putThiefItemsOnPartner) {
    truces.push(
      createTruceInstance(
        "thief-partner-truce",

        [thief.id, partner.id],

        TEST_ROUND,

        TRUCE_EXPIRY_ROUND,
      ),
    );
  }

  /*
   * This is the older fixture mode used to
   * prove that target-owned theft requirements
   * do not accept a partner-owned item.
   */
  if (putTargetItemsOnPartner) {
    truces.push(
      createTruceInstance(
        "target-partner-truce",

        [target.id, partner.id],

        TEST_ROUND,

        TRUCE_EXPIRY_ROUND,
      ),
    );
  }

  if (thiefAndTargetShareTruce) {
    truces.push(
      createTruceInstance(
        "thief-target-truce",

        [thief.id, target.id],

        TEST_ROUND,

        TRUCE_EXPIRY_ROUND,
      ),
    );
  }

  const replacements = new Map([
    [thief.id, thief],

    [target.id, target],

    [partner.id, partner],
  ]);

  const state: GameState = {
    ...originalState,

    tributes: originalState.tributes.map((tribute) => replacements.get(tribute.id) ?? tribute),

    truces,

    itemTransactions: [
      /*
       * Record the real physical owner rather
       * than assuming that the thief personally
       * owns every thiefItems entry.
       */
      ...thiefItems.map((item) => createRecordedAcquisition(thiefItemOwner.id, item)),

      ...targetItems.map((item) => createRecordedAcquisition(targetItemOwner.id, item)),
    ],
  };

  return {
    state,

    thief,
    target,
    partner,

    targetItems,
    thiefItems,
  };
}

function selectTheftParticipants(
  fixture: TheftFixture,

  unavailableTributeIds: ReadonlySet<string> = new Set<string>(),

  unavailableItemInstanceIds: ReadonlySet<string> = new Set<string>(),

  livingTributes: readonly GameTribute[] = [fixture.thief, fixture.target],
) {
  return selectEventParticipants(
    STEAL_FROM_STRONGER_TRIBUTE_EVENT,

    {
      state: fixture.state,
      round: TEST_ROUND,
      livingTributes,
    },

    /*
     * The intended thief appears first in livingTributes.
     * Zero deterministically selects the first positively
     * weighted candidate.
     */
    () => 0,

    unavailableTributeIds,
    unavailableItemInstanceIds,
  );
}

const THEFT_RESOLUTION_EVENT_ID = "theft-resolution-event";

type TransferItemChange = Extract<
  GameChange,
  {
    type: "transfer-item";
  }
>;

function createSequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;

  const fallback = values.length > 0 ? values[values.length - 1] : 0;

  return () => {
    const value = values[index] ?? fallback;

    index += 1;

    return value;
  };
}

function createResolutionFixture(options: TheftFixtureOptions = {}): TheftFixture {
  return createTheftFixture({
    /*
     * These values produce a theft difficulty of 3:
     *
     * target awareness = 2
     * target combat = 3.1
     *
     * 1 + (2 × 0.5) + (3.1 × 0.25)
     * rounds to 3.
     */
    thiefStats: {
      brains: 3,
      brawn: 2,
      luck: 3,
    },

    targetStats: {
      brains: 2,
      brawn: 4,
      luck: 2,
    },

    targetItemDefinitionIds: ["blanket"],

    ...options,
  });
}

function resolveTheft(
  fixture: TheftFixture,
  randomValues: readonly number[],
  unavailableItemInstanceIds: ReadonlySet<string> = new Set<string>(),
): EventResolution {
  const selection = selectTheftParticipants(fixture, new Set<string>(), unavailableItemInstanceIds);

  if (!selection) {
    throw new Error("Expected theft participants to be selected.");
  }

  return STEAL_FROM_STRONGER_TRIBUTE_EVENT.resolve({
    state: fixture.state,
    round: TEST_ROUND,

    livingTributes: [fixture.thief, fixture.target],

    eventId: THEFT_RESOLUTION_EVENT_ID,

    random: createSequenceRandom(randomValues),

    participantsByRole: selection.participantsByRole,

    itemsByRole: selection.itemsByRole,

    unavailableItemInstanceIds,
  });
}

function getTransferChanges(changes: readonly GameChange[]): TransferItemChange[] {
  return changes.filter((change): change is TransferItemChange => change.type === "transfer-item");
}

type TransferredInventoryTransaction = Extract<
  InventoryTransaction,
  {
    type: "transferred";
  }
>;

function getTransferTransactions(
  state: GameState,
  reason?: string,
): TransferredInventoryTransaction[] {
  return state.itemTransactions.filter(
    (transaction): transaction is TransferredInventoryTransaction =>
      transaction.type === "transferred" &&
      (reason === undefined || transaction.sourceId === reason),
  );
}

function getItemTransferTransactions(
  state: GameState,
  itemInstanceId: string,
): TransferredInventoryTransaction[] {
  return getTransferTransactions(state).filter(
    (transaction) => transaction.itemInstanceId === itemInstanceId,
  );
}

function applyTheftResolution(fixture: TheftFixture, resolution: EventResolution): GameState {
  const event: ResolvedEvent = {
    id: THEFT_RESOLUTION_EVENT_ID,

    definitionId: STEAL_FROM_STRONGER_TRIBUTE_EVENT.id,
    kind: "primary",
    resolutionMode: "standard",

    round: TEST_ROUND,

    participantTributeIds: [fixture.thief.id, fixture.target.id],

    text: resolution.text,
    changes: resolution.changes,
  };

  return applyResolvedEvent(fixture.state, event);
}

function requireTribute(state: GameState, tributeId: string): GameTribute {
  const tribute = state.tributes.find((candidate) => candidate.id === tributeId);

  if (!tribute) {
    throw new Error(`Missing tribute "${tributeId}".`);
  }

  return tribute;
}

describe("theft participant selection", () => {
  it("requires at least two available living tributes", () => {
    const fixture = createTheftFixture();

    const selection = selectTheftParticipants(
      fixture,
      new Set<string>(),
      new Set<string>(),

      [fixture.thief],
    );

    expect(selection).toBeNull();
  });

  it("does not select a target without personally owned inventory", () => {
    const fixture = createTheftFixture({
      targetItemDefinitionIds: [],
    });

    expect(selectTheftParticipants(fixture)).toBeNull();
  });

  it("does not select a target whose only item belongs to a truce partner", () => {
    const fixture = createTheftFixture({
      targetItemDefinitionIds: ["blanket"],

      putTargetItemsOnPartner: true,
    });

    expect(selectTheftParticipants(fixture)).toBeNull();
  });

  it("does not select a target whose owned item has no remaining uses", () => {
    const fixture = createTheftFixture({
      targetItemDefinitionIds: ["med-kit"],

      targetItemUsesRemaining: [0],
    });

    expect(selectTheftParticipants(fixture)).toBeNull();
  });

  it("rejects a target with less than a 0.5 combat-score advantage", () => {
    const fixture = createTheftFixture({
      thiefStats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },

      /*
       * This produces a 0.45 combat-score advantage.
       * blanket does not add a combat bonus.
       */
      targetStats: {
        brains: 4,
        brawn: 3,
        luck: 4,
      },

      targetItemDefinitionIds: ["blanket"],
    });

    expect(selectTheftParticipants(fixture)).toBeNull();
  });

  it("selects a target with at least a 0.5 combat-score advantage", () => {
    const fixture = createTheftFixture({
      thiefStats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },

      /*
       * One additional Brawn point creates a
       * 0.55 combat-score advantage.
       */
      targetStats: {
        brains: 3,
        brawn: 4,
        luck: 3,
      },

      targetItemDefinitionIds: ["blanket"],
    });

    const selection = selectTheftParticipants(fixture);

    expect(selection).not.toBeNull();

    expect(selection?.participantsByRole.target[0].id).toBe(fixture.target.id);
  });

  it("does not select truce partners against one another", () => {
    const fixture = createTheftFixture({
      thiefAndTargetShareTruce: true,
    });

    expect(selectTheftParticipants(fixture)).toBeNull();
  });

  it("does not select a target item already reserved for the round", () => {
    const fixture = createTheftFixture({
      targetItemDefinitionIds: ["blanket"],
    });

    expect(
      selectTheftParticipants(
        fixture,

        new Set<string>(),

        new Set([fixture.targetItems[0].id]),
      ),
    ).toBeNull();
  });

  it("selects another owned item when the target's first item is reserved", () => {
    const fixture = createTheftFixture({
      targetItemDefinitionIds: ["blanket", "map"],
    });

    const [reservedItem, availableItem] = fixture.targetItems;

    const selection = selectTheftParticipants(
      fixture,

      new Set<string>(),

      new Set([reservedItem.id]),
    );

    expect(selection).not.toBeNull();

    expect(selection?.itemsByRole.target[0].item.id).toBe(availableItem.id);

    expect(selection?.selectedItemInstanceIds).toEqual([availableItem.id]);
  });

  it("does not select a tribute already unavailable for the round", () => {
    const fixture = createTheftFixture();

    const selection = selectTheftParticipants(
      fixture,

      new Set([fixture.target.id]),
    );

    expect(selection).toBeNull();
  });

  it("returns one thief, one target, and a target-owned item", () => {
    const fixture = createTheftFixture({
      targetItemDefinitionIds: ["blanket"],
    });

    const selection = selectTheftParticipants(fixture);

    expect(selection).not.toBeNull();

    expect(selection?.participantsByRole.thief).toEqual([fixture.thief]);

    expect(selection?.participantsByRole.target).toEqual([fixture.target]);

    expect(selection?.participantTributeIds).toEqual([fixture.thief.id, fixture.target.id]);

    expect(new Set(selection?.participantTributeIds).size).toBe(2);

    const itemSelection = selection?.itemsByRole.target[0];

    expect(itemSelection?.userTributeId).toBe(fixture.target.id);

    expect(itemSelection?.owner.id).toBe(fixture.target.id);

    expect(itemSelection?.item.id).toBe(fixture.targetItems[0].id);
  });

  it("retries another thief when the first candidate has no valid target", () => {
    /*
     * The intended first thief and target share a truce.
     * The partner is not part of that truce and can form a
     * valid theft pairing with the same target.
     */
    const fixture = createTheftFixture({
      thiefAndTargetShareTruce: true,
    });

    const alternativeThief: GameTribute = {
      ...fixture.partner,

      snapshot: {
        ...fixture.partner.snapshot,

        name: "Alternative Thief",

        stats: {
          brains: 2,
          brawn: 1,
          luck: 2,
        },
      },

      inventory: [],
      statuses: [],
    };

    const state: GameState = {
      ...fixture.state,

      tributes: fixture.state.tributes.map((tribute) =>
        tribute.id === alternativeThief.id ? alternativeThief : tribute,
      ),
    };

    const selection = selectEventParticipants(
      STEAL_FROM_STRONGER_TRIBUTE_EVENT,

      {
        state,
        round: TEST_ROUND,

        /*
         * Zero initially selects fixture.thief.
         * Their only worthwhile target is protected by
         * their truce, forcing a retry.
         */
        livingTributes: [fixture.thief, alternativeThief, fixture.target],
      },

      () => 0,

      new Set(),
      new Set(),
    );

    expect(selection).not.toBeNull();

    expect(selection?.participantsByRole.thief).toEqual([alternativeThief]);

    expect(selection?.participantsByRole.target).toEqual([fixture.target]);

    expect(selection?.itemsByRole.target[0]?.owner.id).toBe(fixture.target.id);

    expect(selection?.itemsByRole.target[0]?.item.id).toBe(fixture.targetItems[0].id);
  });
  it("selects and reserves a thief-owned slingshot", () => {
    const fixture = createTheftFixture({
      thiefItemDefinitionIds: ["slingshot"],

      targetItemDefinitionIds: ["blanket"],
    });

    const slingshot = fixture.thiefItems[0];

    const selection = selectTheftParticipants(fixture);

    expect(selection).not.toBeNull();

    expect(selection?.itemsByRole.thief).toHaveLength(1);

    expect(selection?.itemsByRole.thief[0]).toMatchObject({
      userTributeId: fixture.thief.id,

      owner: {
        id: fixture.thief.id,
      },

      item: {
        id: slingshot.id,

        definitionId: "slingshot",
      },
    });

    expect(selection?.selectedItemInstanceIds).toContain(slingshot.id);
  });

  it("builds a partner-owned slingshot fixture", () => {
    const fixture = createTheftFixture({
      thiefItemDefinitionIds: ["slingshot"],

      putThiefItemsOnPartner: true,

      targetItemDefinitionIds: ["blanket"],
    });

    const slingshot = fixture.thiefItems[0];

    expect(fixture.thief.inventory).toEqual([]);

    expect(fixture.partner.inventory).toEqual([slingshot]);

    expect(fixture.target.inventory).toEqual(fixture.targetItems);

    expect(fixture.state.truces).toHaveLength(1);

    expect(fixture.state.truces[0].tributeIds).toEqual([fixture.thief.id, fixture.partner.id]);
  });

  it("allows the thief to borrow a slingshot from an active truce partner", () => {
    const fixture = createTheftFixture({
      thiefItemDefinitionIds: ["slingshot"],

      putThiefItemsOnPartner: true,

      targetItemDefinitionIds: ["blanket"],
    });

    const slingshot = fixture.thiefItems[0];

    expect(fixture.thief.inventory).toEqual([]);

    expect(fixture.partner.inventory).toContainEqual(slingshot);

    const selection = selectTheftParticipants(fixture);

    expect(selection).not.toBeNull();

    expect(selection?.itemsByRole.thief[0]).toMatchObject({
      /*
       * The thief is using the item...
       */
      userTributeId: fixture.thief.id,

      /*
       * ...but the partner physically owns it.
       */
      owner: {
        id: fixture.partner.id,
      },

      item: {
        id: slingshot.id,

        definitionId: "slingshot",
      },
    });

    expect(selection?.selectedItemInstanceIds).toContain(slingshot.id);
  });

  it("does not select a slingshot already reserved by another event", () => {
    const fixture = createTheftFixture({
      thiefItemDefinitionIds: ["slingshot"],

      targetItemDefinitionIds: ["blanket"],
    });

    const slingshot = fixture.thiefItems[0];

    const firstSelection = selectTheftParticipants(fixture);

    expect(firstSelection?.selectedItemInstanceIds).toContain(slingshot.id);

    const secondSelection = selectTheftParticipants(
      fixture,

      new Set<string>(),

      new Set<string>([slingshot.id]),
    );

    /*
     * The event remains valid because the
     * slingshot is optional.
     */
    expect(secondSelection).not.toBeNull();

    expect(secondSelection?.itemsByRole.thief).toEqual([]);

    expect(secondSelection?.selectedItemInstanceIds).not.toContain(slingshot.id);

    /*
     * The target's required stolen item should
     * still be selected and reserved.
     */
    expect(secondSelection?.itemsByRole.target).toHaveLength(1);
  });

  it("does not select a target whose only item is unusable by the thief", () => {
    const fixture = createTheftFixture({
      thiefStats: {
        brains: 3,
        brawn: 4,
        luck: 3,
      },

      targetStats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },

      targetItemDefinitionIds: ["warhammer"],
    });

    expect(selectTheftParticipants(fixture)).toBeNull();
  });

  it("selects only items usable by the thief from mixed target inventory", () => {
    const fixture = createTheftFixture({
      thiefStats: {
        brains: 3,
        brawn: 4,
        luck: 3,
      },

      targetStats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },

      targetItemDefinitionIds: ["warhammer", "blanket"],
    });

    const selection = selectTheftParticipants(fixture);

    expect(selection?.itemsByRole.target[0].item.definitionId).toBe("blanket");
  });

  it("does not transfer a thief-unusable exceptional item", () => {
    const fixture = createResolutionFixture({
      /*
       * Brawn 4 allows the thief to use the
       * blanket and map but not the Brawn-5
       * warhammer.
       */
      thiefStats: {
        brains: 3,
        brawn: 4,
        luck: 3,
      },

      /*
       * The target must remain meaningfully
       * stronger or the theft event is not
       * eligible.
       */
      targetStats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },

      /*
       * The first item becomes the primary
       * selected item.
       *
       * On exceptional success, the resolver
       * must skip the unusable warhammer and
       * choose the usable map.
       */
      targetItemDefinitionIds: ["blanket", "warhammer", "map"],
    });

    const [primaryItem, unusableAdditionalItem, usableAdditionalItem] = fixture.targetItems;

    const resolution = resolveTheft(
      fixture,

      /*
       * 0.99 selects exceptional success.
       * The second value selects from the
       * remaining usable candidates.
       */
      [0.99, 0],
    );

    const transfers = getTransferChanges(resolution.changes);

    expect(transfers).toHaveLength(2);

    expect(transfers.map((change) => change.itemInstanceId)).toEqual([
      primaryItem.id,
      usableAdditionalItem.id,
    ]);

    expect(transfers.some((change) => change.itemInstanceId === unusableAdditionalItem.id)).toBe(
      false,
    );

    const nextState = applyTheftResolution(fixture, resolution);

    const nextThief = requireTribute(nextState, fixture.thief.id);

    const nextTarget = requireTribute(nextState, fixture.target.id);

    expect(nextThief.inventory.find((item) => item.id === primaryItem.id)).toEqual(primaryItem);

    expect(nextThief.inventory.find((item) => item.id === usableAdditionalItem.id)).toEqual(
      usableAdditionalItem,
    );

    /*
     * The warhammer remains with the target
     * because the thief cannot use it.
     */
    expect(nextTarget.inventory.find((item) => item.id === unusableAdditionalItem.id)).toEqual(
      unusableAdditionalItem,
    );

    expect(nextThief.inventory.some((item) => item.id === unusableAdditionalItem.id)).toBe(false);

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });
});

describe("theft resolution", () => {
  it("increases and clamps difficulty based on target awareness and combat", () => {
    const weakTarget = createTheftFixture({
      targetStats: {
        brains: 1,
        brawn: 1,
        luck: 1,
      },

      targetItemDefinitionIds: ["blanket"],
    }).target;

    const strongTarget = createTheftFixture({
      targetStats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },

      targetItemDefinitionIds: ["bow"],
    }).target;

    const weakDifficulty = getTheftDifficulty(weakTarget);

    const strongDifficulty = getTheftDifficulty(strongTarget);

    expect(strongDifficulty).toBeGreaterThan(weakDifficulty);

    expect(weakDifficulty).toBeGreaterThanOrEqual(1);

    expect(strongDifficulty).toBeLessThanOrEqual(5);

    expect(strongDifficulty).toBe(5);
  });

  it("kills the thief and transfers their complete inventory as identity-preserving death loot", () => {
    const fixture = createResolutionFixture({
      thiefItemDefinitionIds: ["map", "med-kit"],

      targetItemDefinitionIds: ["matches"],
    });

    const attemptedItem = fixture.targetItems[0];

    /*
     * At equal Brains and difficulty,
     * zero selects critical failure.
     */
    const resolution = resolveTheft(fixture, [0]);

    const transfers = getTransferChanges(resolution.changes);

    const theftTransfers = transfers.filter((change) => change.reason === "theft");

    const deathLootTransfers = transfers.filter((change) => change.reason === "death-loot");

    expect(theftTransfers).toEqual([]);

    expect(deathLootTransfers).toHaveLength(fixture.thiefItems.length);

    expect(deathLootTransfers.map((change) => change.itemInstanceId)).toEqual(
      fixture.thiefItems.map((item) => item.id),
    );

    expect(deathLootTransfers.some((change) => change.itemInstanceId === attemptedItem.id)).toBe(
      false,
    );

    expect(new Set(deathLootTransfers.map((change) => change.itemInstanceId)).size).toBe(
      deathLootTransfers.length,
    );

    const nextState = applyTheftResolution(fixture, resolution);

    const nextThief = requireTribute(nextState, fixture.thief.id);

    const nextTarget = requireTribute(nextState, fixture.target.id);

    expect(nextThief.isAlive).toBe(false);

    expect(nextThief.inventory).toEqual([]);

    expect(nextThief.death?.killerTributeIds).toEqual([fixture.target.id]);

    expect(nextTarget.statistics.attemptedKills).toBe(fixture.target.statistics.attemptedKills + 1);

    expect(nextTarget.statistics.kills).toBe(fixture.target.statistics.kills + 1);

    /*
     * The attempted item was never transferred and remains
     * the exact same physical instance on the target.
     */
    const retainedAttemptedItem = nextTarget.inventory.find((item) => item.id === attemptedItem.id);

    expect(retainedAttemptedItem).toEqual(attemptedItem);

    expect(nextTarget.inventory.filter((item) => item.id === attemptedItem.id)).toHaveLength(1);

    for (const originalItem of fixture.thiefItems) {
      const lootedItem = nextTarget.inventory.find((item) => item.id === originalItem.id);

      expect(lootedItem).toEqual(originalItem);

      expect(lootedItem?.id).toBe(originalItem.id);

      expect(lootedItem?.usesRemaining).toBe(originalItem.usesRemaining);

      expect(lootedItem?.sourceEventId).toBe(originalItem.sourceEventId);

      expect(lootedItem?.acquiredRound).toEqual(originalItem.acquiredRound);

      const itemTransactions = getItemTransferTransactions(nextState, originalItem.id);

      expect(itemTransactions).toHaveLength(1);

      expect(itemTransactions[0]).toEqual(
        expect.objectContaining({
          type: "transferred",

          fromTributeId: fixture.thief.id,

          toTributeId: fixture.target.id,

          itemInstanceId: originalItem.id,

          definitionId: originalItem.definitionId,

          uses: originalItem.usesRemaining,

          sourceId: "death-loot",
        }),
      );
    }

    expect(getTransferTransactions(nextState, "theft")).toEqual([]);

    expect(getTransferTransactions(nextState, "death-loot")).toHaveLength(
      fixture.thiefItems.length,
    );

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("allows death loot to give the killer an unusable item", () => {
    const fixture = createResolutionFixture({
      /*
       * The thief may own an unusable item.
       * Ownership does not imply usability.
       */
      thiefStats: {
        brains: 1,
        brawn: 1,
        luck: 1,
      },

      /*
       * The target remains much stronger than
       * the thief but is still one Brawn point
       * short of using the warhammer.
       */
      targetStats: {
        brains: 5,
        brawn: 4,
        luck: 5,
      },

      thiefItemDefinitionIds: ["warhammer"],

      /*
       * The attempted theft item must remain
       * usable by the thief so participant
       * selection can succeed.
       */
      targetItemDefinitionIds: ["blanket"],
    });

    const warhammer = fixture.thiefItems[0];

    expect(warhammer).toBeDefined();

    /*
     * The future recipient cannot use the item
     * even before the transfer occurs.
     */
    expect(isItemUsableBy(fixture.target, warhammer)).toBe(false);

    /*
     * Zero deterministically selects critical
     * failure, causing the target to kill the
     * thief and receive the thief's inventory.
     */
    const resolution = resolveTheft(fixture, [0]);

    const deathLootTransfer = getTransferChanges(resolution.changes).find(
      (change) => change.reason === "death-loot" && change.itemInstanceId === warhammer.id,
    );

    expect(deathLootTransfer).toEqual({
      type: "transfer-item",

      itemInstanceId: warhammer.id,

      fromTributeId: fixture.thief.id,

      toTributeId: fixture.target.id,

      reason: "death-loot",
    });

    const nextState = applyTheftResolution(fixture, resolution);

    const nextThief = requireTribute(nextState, fixture.thief.id);

    const nextTarget = requireTribute(nextState, fixture.target.id);

    expect(nextThief.isAlive).toBe(false);

    const inheritedWarhammer = nextTarget.inventory.find((item) => item.id === warhammer.id);

    expect(inheritedWarhammer).toEqual(warhammer);

    if (!inheritedWarhammer) {
      throw new Error("Expected the target to inherit the warhammer.");
    }

    /*
     * The exact physical item was transferred,
     * but the new owner still cannot use it.
     */
    expect(isItemUsableBy(nextTarget, inheritedWarhammer)).toBe(false);

    expect(getItemTransferTransactions(nextState, warhammer.id)).toEqual([
      expect.objectContaining({
        type: "transferred",

        fromTributeId: fixture.thief.id,

        toTributeId: fixture.target.id,

        itemInstanceId: warhammer.id,

        definitionId: "warhammer",

        sourceId: "death-loot",
      }),
    ]);

    /*
     * This is the central regression check:
     * unusable ownership remains valid state.
     */
    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("reduces theft difficulty by one when a slingshot is selected", () => {
    const fixtureWithoutSlingshot = createResolutionFixture({
      thiefItemDefinitionIds: [],

      targetItemDefinitionIds: ["blanket"],
    });

    const fixtureWithSlingshot = createResolutionFixture({
      thiefItemDefinitionIds: ["slingshot"],

      targetItemDefinitionIds: ["blanket"],
    });

    const resolutionWithoutSlingshot = resolveTheft(fixtureWithoutSlingshot, [0.4]);

    const resolutionWithSlingshot = resolveTheft(fixtureWithSlingshot, [0.4]);

    /*
     * The ordinary attempt fails.
     */
    expect(getTransferChanges(resolutionWithoutSlingshot.changes)).toEqual([]);

    expect(
      resolutionWithoutSlingshot.changes.some(
        (change) => change.type === "apply-status" && change.status.definitionId === "hunted",
      ),
    ).toBe(true);

    /*
     * The exact same roll succeeds after the
     * slingshot reduces difficulty by one.
     */
    expect(getTransferChanges(resolutionWithSlingshot.changes)).toHaveLength(1);

    expect(resolutionWithSlingshot.changes.some((change) => change.type === "apply-status")).toBe(
      false,
    );
  });

  it("does not consume or transfer the slingshot during theft", () => {
    const fixture = createResolutionFixture({
      thiefItemDefinitionIds: ["slingshot"],

      targetItemDefinitionIds: ["blanket"],
    });

    const originalSlingshot = fixture.thiefItems[0];

    const resolution = resolveTheft(fixture, [0.4]);

    const nextState = applyTheftResolution(fixture, resolution);

    const nextThief = requireTribute(nextState, fixture.thief.id);

    const retainedSlingshot = nextThief.inventory.find((item) => item.id === originalSlingshot.id);

    /*
     * The same physical item remains in the
     * thief's inventory.
     */
    expect(retainedSlingshot).toEqual(originalSlingshot);

    expect(retainedSlingshot?.usesRemaining).toBe(originalSlingshot.usesRemaining);

    /*
     * Only the target's stolen item should have
     * produced a transfer transaction.
     */
    expect(getItemTransferTransactions(nextState, originalSlingshot.id)).toEqual([]);

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("uses ordinary theft text when no slingshot is selected", () => {
    const fixture = createResolutionFixture({
      thiefItemDefinitionIds: [],

      targetItemDefinitionIds: ["blanket"],
    });

    /*
     * This remains a failure both with and
     * without the one-point reduction, making
     * it suitable for comparing text branches.
     */
    const resolution = resolveTheft(fixture, [0.2]);

    expect(getTransferChanges(resolution.changes)).toEqual([]);

    expect(resolution.text).toContain("catches Thief trying to steal");

    expect(resolution.text).not.toMatch(/fires a stone|slingshot/i);
  });

  it("uses slingshot-specific text when the selected slingshot assists a failed theft", () => {
    const fixture = createResolutionFixture({
      thiefItemDefinitionIds: ["slingshot"],

      targetItemDefinitionIds: ["blanket"],
    });

    /*
     * At 0.2 the reduced-difficulty attempt
     * still lands in failure, allowing us to
     * test the slingshot failure wording.
     */
    const resolution = resolveTheft(fixture, [0.2]);

    expect(getTransferChanges(resolution.changes)).toEqual([]);

    expect(resolution.text).toMatch(/fires a stone into the trees/i);

    expect(resolution.text).toContain("but the distraction ends before");
  });

  it("preserves both inventories and applies hunted on failure", () => {
    const fixture = createResolutionFixture({
      thiefItemDefinitionIds: ["map"],

      targetItemDefinitionIds: ["matches"],
    });

    const originalThiefInventory = fixture.thief.inventory.map((item) => ({
      ...item,

      acquiredRound: {
        ...item.acquiredRound,
      },
    }));

    const originalTargetInventory = fixture.target.inventory.map((item) => ({
      ...item,

      acquiredRound: {
        ...item.acquiredRound,
      },
    }));

    /*
     * At equal stat and difficulty,
     * 0.2 selects failure.
     */
    const resolution = resolveTheft(fixture, [0.2]);

    expect(getTransferChanges(resolution.changes)).toEqual([]);

    expect(resolution.changes.some((change) => change.type === "eliminate-tribute")).toBe(false);

    const nextState = applyTheftResolution(fixture, resolution);

    const nextThief = requireTribute(nextState, fixture.thief.id);

    const nextTarget = requireTribute(nextState, fixture.target.id);

    expect(nextThief.isAlive).toBe(true);

    expect(nextTarget.isAlive).toBe(true);

    expect(nextThief.inventory).toEqual(originalThiefInventory);

    expect(nextTarget.inventory).toEqual(originalTargetInventory);

    expect(nextThief.statuses.some((status) => status.definitionId === "hunted")).toBe(true);

    expect(getTransferTransactions(nextState)).toEqual([]);

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("transfers exactly one original item instance on success", () => {
    const fixture = createResolutionFixture({
      /*
       * Matches have a numeric remaining-use count,
       * making preservation more explicit than a
       * reusable null-use item.
       */
      targetItemDefinitionIds: ["matches"],
    });

    const originalItem = fixture.targetItems[0];

    /*
     * At equal stat and difficulty,
     * 0.6 selects success.
     */
    const resolution = resolveTheft(fixture, [0.6]);

    const transfers = getTransferChanges(resolution.changes);

    expect(transfers).toEqual([
      {
        type: "transfer-item",

        itemInstanceId: originalItem.id,

        fromTributeId: fixture.target.id,

        toTributeId: fixture.thief.id,

        reason: "theft",
      },
    ]);

    const nextState = applyTheftResolution(fixture, resolution);

    const nextThief = requireTribute(nextState, fixture.thief.id);

    const nextTarget = requireTribute(nextState, fixture.target.id);

    const stolenItem = nextThief.inventory.find((item) => item.id === originalItem.id);

    expect(stolenItem).toEqual(originalItem);

    expect(stolenItem?.id).toBe(originalItem.id);

    expect(stolenItem?.usesRemaining).toBe(originalItem.usesRemaining);

    expect(stolenItem?.sourceEventId).toBe(originalItem.sourceEventId);

    expect(stolenItem?.acquiredRound).toEqual(originalItem.acquiredRound);

    expect(nextTarget.inventory.some((item) => item.id === originalItem.id)).toBe(false);

    const theftTransactions = getTransferTransactions(nextState, "theft");

    expect(theftTransactions).toHaveLength(1);

    expect(theftTransactions[0]).toEqual(
      expect.objectContaining({
        type: "transferred",

        tributeId: fixture.thief.id,

        fromTributeId: fixture.target.id,

        toTributeId: fixture.thief.id,

        itemInstanceId: originalItem.id,

        definitionId: originalItem.definitionId,

        uses: originalItem.usesRemaining,

        sourceId: "theft",
      }),
    );

    expect(getItemTransferTransactions(nextState, originalItem.id)).toHaveLength(1);

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("transfers only one item on exceptional success when no second item exists", () => {
    const fixture = createResolutionFixture();

    /*
     * At equal stat and difficulty, 0.99 selects
     * exceptional success.
     */
    const resolution = resolveTheft(fixture, [0.99]);

    expect(getTransferChanges(resolution.changes)).toHaveLength(1);
  });

  it("transfers at most two distinct items on exceptional success", () => {
    const fixture = createResolutionFixture({
      targetItemDefinitionIds: ["blanket", "map", "med-kit"],
    });

    const [primaryItem, reservedItem, availableItem] = fixture.targetItems;

    const resolution = resolveTheft(
      fixture,

      /*
       * First value selects exceptional success.
       * Second selects the available additional item.
       */
      [0.99, 0],

      new Set([reservedItem.id]),
    );

    const transfers = getTransferChanges(resolution.changes);

    expect(transfers).toHaveLength(2);

    expect(transfers.map((change) => change.itemInstanceId)).toEqual([
      primaryItem.id,
      availableItem.id,
    ]);

    expect(transfers.some((change) => change.itemInstanceId === reservedItem.id)).toBe(false);

    expect(new Set(transfers.map((change) => change.itemInstanceId)).size).toBe(2);

    const nextState = applyTheftResolution(fixture, resolution);

    const nextThief = requireTribute(nextState, fixture.thief.id);

    const nextTarget = requireTribute(nextState, fixture.target.id);

    for (const transferredItem of [primaryItem, availableItem]) {
      expect(nextThief.inventory.find((item) => item.id === transferredItem.id)).toEqual(
        transferredItem,
      );

      expect(nextTarget.inventory.some((item) => item.id === transferredItem.id)).toBe(false);

      expect(getItemTransferTransactions(nextState, transferredItem.id)).toHaveLength(1);
    }

    expect(nextTarget.inventory.find((item) => item.id === reservedItem.id)).toEqual(reservedItem);

    expect(getTransferTransactions(nextState, "theft")).toHaveLength(2);

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("applies the existing Luck adjustment to the Brains check", () => {
    const lowLuckFixture = createTheftFixture({
      thiefStats: {
        brains: 3,
        brawn: 1,
        luck: 1,
      },

      targetStats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },

      targetItemDefinitionIds: ["blanket"],
    });

    const highLuckFixture = createTheftFixture({
      thiefStats: {
        brains: 3,
        brawn: 1,
        luck: 5,
      },

      targetStats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },

      targetItemDefinitionIds: ["blanket"],
    });

    const lowLuckResolution = resolveTheft(lowLuckFixture, [0.7]);

    const highLuckResolution = resolveTheft(highLuckFixture, [0.7]);

    expect(getTransferChanges(lowLuckResolution.changes)).toHaveLength(0);

    expect(getTransferChanges(highLuckResolution.changes)).toHaveLength(1);
  });

  it("marks the theft target as hostile", () => {
    const targetRole = STEAL_FROM_STRONGER_TRIBUTE_EVENT.roles.find((role) => role.id === "target");

    expect(targetRole?.targeting).toBe("hostile");
  });
});
