import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { getCommittedItemInstanceIds } from "~/game/items/item-reservations";
import { createFatalChanges, createItemUseChange } from "~/game/events/event-change-builders";
import type { EventDefinition, EventResolution } from "~/game/events/event-schema";
import {
  selectEventParticipants,
  type ParticipantSelection,
} from "~/game/events/participant-selection";
import { STEAL_FROM_STRONGER_TRIBUTE_EVENT } from "~/game/events/catalogue/encounters/theft-events";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { createTruceInstance } from "~/game/truces/truce-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type {
  GameChange,
  GameState,
  GameTribute,
  InventoryItem,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";

import { reserveEventCommitments, sequenceRoundEvents } from "./event-sequencer";

const FIRST_ROUND = {
  day: 2,
  period: "day",
} as const;

const NEXT_ROUND = {
  day: 2,
  period: "night",
} as const;

const ACQUISITION_ROUND = {
  day: 1,
  period: "day",
} as const;

interface RoundReservations {
  tributeIds: Set<string>;
  itemInstanceIds: Set<string>;
}

interface ReservationFixture {
  state: GameState;

  thief: GameTribute;
  target: GameTribute;
  borrower: GameTribute;
  killer: GameTribute;

  targetItems: InventoryItem[];
}

type TransferItemChange = Extract<
  GameChange,
  {
    type: "transfer-item";
  }
>;

function createTestGame(seed: string): GameState {
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

function createReservationFixture(
  targetItemDefinitionIds: readonly ItemDefinitionId[] = ["rope"],

  seed = "item-reservation-integration",
): ReservationFixture {
  const originalState = createTestGame(seed);

  const [originalThief, originalTarget, originalBorrower, originalKiller] = originalState.tributes;

  if (!originalThief || !originalTarget || !originalBorrower || !originalKiller) {
    throw new Error("Expected at least four test tributes.");
  }

  const targetItems = targetItemDefinitionIds.map((definitionId, index) =>
    createInventoryItemInstance(
      `reservation-target-item-${index}`,
      originalTarget.id,
      definitionId,
      ACQUISITION_ROUND,
    ),
  );

  /*
   * These stats make the target meaningfully stronger than
   * the thief while giving the theft resolution an evenly
   * matched Brains-versus-difficulty check.
   */
  const thief: GameTribute = {
    ...originalThief,

    snapshot: {
      ...originalThief.snapshot,

      name: "Thief",

      stats: {
        brains: 3,
        brawn: 2,
        luck: 3,
      },
    },

    inventory: [],
    statuses: [],
  };

  const target: GameTribute = {
    ...originalTarget,

    snapshot: {
      ...originalTarget.snapshot,

      name: "Target",

      stats: {
        brains: 2,
        brawn: 4,
        luck: 2,
      },
    },

    inventory: targetItems,
    statuses: [],
  };

  const borrower: GameTribute = {
    ...originalBorrower,

    snapshot: {
      ...originalBorrower.snapshot,
      name: "Borrower",
    },

    inventory: [],
    statuses: [],
  };

  const killer: GameTribute = {
    ...originalKiller,

    snapshot: {
      ...originalKiller.snapshot,
      name: "Killer",
    },

    inventory: [],
    statuses: [],
  };

  const replacements = new Map<string, GameTribute>([
    [thief.id, thief],
    [target.id, target],
    [borrower.id, borrower],
    [killer.id, killer],
  ]);

  const targetBorrowerTruce = createTruceInstance(
    "target-borrower-truce",

    [target.id, borrower.id],

    FIRST_ROUND,

    {
      day: 3,
      period: "day",
    },
  );

  const state: GameState = {
    ...originalState,

    seed,

    tributes: originalState.tributes.map((tribute) => replacements.get(tribute.id) ?? tribute),

    truces: [targetBorrowerTruce],
  };

  return {
    state,
    thief,
    target,
    borrower,
    killer,
    targetItems,
  };
}

function createRoundReservations(): RoundReservations {
  return {
    tributeIds: new Set<string>(),

    itemInstanceIds: new Set<string>(),
  };
}

function requireSelection(selection: ParticipantSelection | null): ParticipantSelection {
  if (!selection) {
    throw new Error("Expected participant selection to succeed.");
  }

  return selection;
}

function requireItem(items: readonly InventoryItem[], index = 0): InventoryItem {
  const item = items[index];

  if (!item) {
    throw new Error(`Expected item at index ${index}.`);
  }

  return item;
}

function createItemEvent({
  id,
  userTributeId,
  itemDefinitionIds,
  itemAccess,
}: {
  id: string;
  userTributeId: string;

  itemDefinitionIds: readonly ItemDefinitionId[];

  itemAccess: "accessible" | "owned";
}): EventDefinition {
  return {
    id,

    category: "survival",

    tags: ["survival", "item"],

    periods: ["day", "night"],

    baseWeight: 1,

    roles: [
      {
        id: "user",
        count: 1,

        itemAccess,

        requiredItemDefinitionIds: itemDefinitionIds,

        isEligible: (tribute) => tribute.id === userTributeId,
      },
    ],

    resolve({ itemsByRole }): EventResolution {
      const selectedItem = itemsByRole?.user?.[0];

      if (!selectedItem) {
        throw new Error(`Event "${id}" requires a selected item.`);
      }

      return {
        text: "A tribute uses an item.",

        changes: [createItemUseChange(selectedItem.owner, selectedItem.item, id)],
      };
    },
  };
}

function createFatalLootEvent(victimTributeId: string, killerTributeId: string): EventDefinition {
  return {
    id: "reservation-fatal-loot",

    category: "fatal",

    tags: ["fatal", "combat"],

    periods: ["day", "night"],

    baseWeight: 1,

    roles: [
      {
        id: "victim",
        count: 1,

        isEligible: (tribute) => tribute.id === victimTributeId,
      },

      {
        id: "killer",
        count: 1,

        isEligible: (tribute) => tribute.id === killerTributeId,
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const victim = participantsByRole.victim?.[0];

      const killer = participantsByRole.killer?.[0];

      if (!victim || !killer) {
        throw new Error("Fatal-loot test event requires a victim and killer.");
      }

      const text = `${killer.snapshot.name} kills ` + `${victim.snapshot.name}.`;

      return {
        text,

        changes: createFatalChanges(
          victim,
          "reservation-fatal-loot",
          "Killed during reservation test",
          text,
          killer,
        ),
      };
    },
  };
}

function selectDefinition(
  definition: EventDefinition,
  state: GameState,
  livingTributes: readonly GameTribute[],
  round: RoundReference,
  reservations: RoundReservations,
): ParticipantSelection | null {
  return selectEventParticipants(
    definition,

    {
      state,
      round,
      livingTributes,
    },

    () => 0,

    reservations.tributeIds,
    reservations.itemInstanceIds,
  );
}

function resolveSelection(
  definition: EventDefinition,
  state: GameState,
  livingTributes: readonly GameTribute[],
  round: RoundReference,
  selection: ParticipantSelection,
  randomValue: number,
  unavailableItemInstanceIds: ReadonlySet<string>,
): EventResolution {
  return definition.resolve({
    state,
    round,
    livingTributes,

    eventId: `test-${definition.id}`,

    random: () => randomValue,

    participantsByRole: selection.participantsByRole,

    itemsByRole: selection.itemsByRole,

    unavailableItemInstanceIds,
  });
}

function selectTheft(
  fixture: ReservationFixture,
  reservations: RoundReservations,
): ParticipantSelection | null {
  return selectDefinition(
    STEAL_FROM_STRONGER_TRIBUTE_EVENT,
    fixture.state,

    [fixture.thief, fixture.target],

    FIRST_ROUND,
    reservations,
  );
}

function resolveSuccessfulTheft(
  fixture: ReservationFixture,
  selection: ParticipantSelection,
  reservations: RoundReservations,
): EventResolution {
  /*
   * With the fixture's equal Brains/check difficulty,
   * 0.6 selects the normal-success branch.
   */
  return resolveSelection(
    STEAL_FROM_STRONGER_TRIBUTE_EVENT,
    fixture.state,

    [fixture.thief, fixture.target],

    FIRST_ROUND,
    selection,
    0.6,

    reservations.itemInstanceIds,
  );
}

function reserveResolution(
  selection: ParticipantSelection,
  resolution: EventResolution,
  reservations: RoundReservations,
): void {
  reserveEventCommitments(
    selection,
    resolution.changes,
    reservations.tributeIds,
    reservations.itemInstanceIds,
  );
}

function getTransferChanges(changes: readonly GameChange[]): TransferItemChange[] {
  return changes.filter((change): change is TransferItemChange => change.type === "transfer-item");
}

function applyResolution(
  state: GameState,
  definition: EventDefinition,
  selection: ParticipantSelection,
  resolution: EventResolution,
  round: RoundReference,
): GameState {
  const event: ResolvedEvent = {
    id: `test-${definition.id}`,

    definitionId: definition.id,
    kind: "primary",
    resolutionMode: "standard",

    round,

    participantTributeIds: selection.participantTributeIds,

    text: resolution.text,

    changes: resolution.changes,
  };

  return applyResolvedEvent(state, event);
}

function requireTribute(state: GameState, tributeId: string): GameTribute {
  const tribute = state.tributes.find((candidate) => candidate.id === tributeId);

  if (!tribute) {
    throw new Error(`Missing tribute "${tributeId}".`);
  }

  return tribute;
}

describe("cross-event item reservation safety", () => {
  it("prevents the old owner or a truce partner from using an item selected for theft", () => {
    const fixture = createReservationFixture(["rope"]);

    const rope = requireItem(fixture.targetItems);

    const reservations = createRoundReservations();

    const theftSelection = requireSelection(selectTheft(fixture, reservations));

    const theftResolution = resolveSuccessfulTheft(fixture, theftSelection, reservations);

    reserveResolution(theftSelection, theftResolution, reservations);

    expect(reservations.itemInstanceIds.has(rope.id)).toBe(true);

    const ownerUseEvent = createItemEvent({
      id: "owner-uses-stolen-rope",

      userTributeId: fixture.target.id,

      itemDefinitionIds: ["rope"],

      itemAccess: "owned",
    });

    expect(
      selectDefinition(
        ownerUseEvent,
        fixture.state,

        [fixture.target],

        FIRST_ROUND,
        reservations,
      ),
    ).toBeNull();

    const borrowedUseEvent = createItemEvent({
      id: "partner-borrows-stolen-rope",

      userTributeId: fixture.borrower.id,

      itemDefinitionIds: ["rope"],

      itemAccess: "accessible",
    });

    expect(
      selectDefinition(
        borrowedUseEvent,
        fixture.state,

        [fixture.borrower],

        FIRST_ROUND,
        reservations,
      ),
    ).toBeNull();
  });

  it("prevents an item-use participant from becoming a later theft target", () => {
    const fixture = createReservationFixture(["matches", "rope"]);

    const matches = requireItem(fixture.targetItems, 0);

    const reservations = createRoundReservations();

    const consumeEvent = createItemEvent({
      id: "consume-before-theft",

      userTributeId: fixture.target.id,

      itemDefinitionIds: ["matches"],

      itemAccess: "owned",
    });

    const consumeSelection = requireSelection(
      selectDefinition(
        consumeEvent,
        fixture.state,

        [fixture.target],

        FIRST_ROUND,
        reservations,
      ),
    );

    const consumeResolution = resolveSelection(
      consumeEvent,
      fixture.state,

      [fixture.target],

      FIRST_ROUND,
      consumeSelection,
      0,
      reservations.itemInstanceIds,
    );

    expect(consumeResolution.changes[0]?.type).toBe("consume-item");

    reserveResolution(consumeSelection, consumeResolution, reservations);

    expect(reservations.itemInstanceIds.has(matches.id)).toBe(true);

    /*
     * The target is also reserved because they participated
     * in the earlier event and their inventory was mutated.
     */
    expect(reservations.tributeIds.has(fixture.target.id)).toBe(true);

    expect(selectTheft(fixture, reservations)).toBeNull();
  });

  it("selects another target-owned item when one item is already reserved", () => {
    const fixture = createReservationFixture(["matches", "rope"]);

    const [reservedMatches, availableRope] = fixture.targetItems;

    if (!reservedMatches || !availableRope) {
      throw new Error("Expected two target items.");
    }

    const reservations = createRoundReservations();

    /*
     * Isolate item-level reservation behavior. The target
     * remains available, but the matches cannot be selected.
     */
    reservations.itemInstanceIds.add(reservedMatches.id);

    const theftSelection = requireSelection(selectTheft(fixture, reservations));

    expect(theftSelection.itemsByRole.target[0]?.item.id).toBe(availableRope.id);

    expect(theftSelection.itemsByRole.target[0]?.item.id).not.toBe(reservedMatches.id);
  });

  it("prevents death loot from being stolen afterward from the original owner", () => {
    const fixture = createReservationFixture(["rope"]);

    const rope = requireItem(fixture.targetItems);

    const reservations = createRoundReservations();

    const fatalDefinition = createFatalLootEvent(fixture.target.id, fixture.killer.id);

    const fatalSelection = requireSelection(
      selectDefinition(
        fatalDefinition,
        fixture.state,

        [fixture.target, fixture.killer],

        FIRST_ROUND,
        reservations,
      ),
    );

    const fatalResolution = resolveSelection(
      fatalDefinition,
      fixture.state,

      [fixture.target, fixture.killer],

      FIRST_ROUND,
      fatalSelection,
      0,
      reservations.itemInstanceIds,
    );

    reserveResolution(fatalSelection, fatalResolution, reservations);

    expect(selectTheft(fixture, reservations)).toBeNull();

    const ropeTransfers = getTransferChanges(fatalResolution.changes).filter(
      (change) => change.itemInstanceId === rope.id,
    );

    expect(ropeTransfers).toEqual([
      expect.objectContaining({
        itemInstanceId: rope.id,

        fromTributeId: fixture.target.id,

        toTributeId: fixture.killer.id,

        reason: "death-loot",
      }),
    ]);
  });

  it("prevents a stolen item from also entering the former owner's death loot", () => {
    const fixture = createReservationFixture(["rope"]);

    const rope = requireItem(fixture.targetItems);

    const reservations = createRoundReservations();

    const theftSelection = requireSelection(selectTheft(fixture, reservations));

    const theftResolution = resolveSuccessfulTheft(fixture, theftSelection, reservations);

    reserveResolution(theftSelection, theftResolution, reservations);

    const fatalDefinition = createFatalLootEvent(fixture.target.id, fixture.killer.id);

    const fatalSelection = selectDefinition(
      fatalDefinition,
      fixture.state,

      [fixture.target, fixture.killer],

      FIRST_ROUND,
      reservations,
    );

    expect(fatalSelection).toBeNull();

    const ropeTransfers = getTransferChanges(theftResolution.changes).filter(
      (change) => change.itemInstanceId === rope.id,
    );

    expect(ropeTransfers).toEqual([
      expect.objectContaining({
        itemInstanceId: rope.id,

        fromTributeId: fixture.target.id,

        toTributeId: fixture.thief.id,

        reason: "theft",
      }),
    ]);
  });

  it("reserves the physical owner and item when a truce partner borrows equipment", () => {
    const fixture = createReservationFixture(["rope"]);

    const rope = requireItem(fixture.targetItems);

    const reservations = createRoundReservations();

    const borrowedUseEvent = createItemEvent({
      id: "borrow-before-theft",

      userTributeId: fixture.borrower.id,

      itemDefinitionIds: ["rope"],

      itemAccess: "accessible",
    });

    const borrowedSelection = requireSelection(
      selectDefinition(
        borrowedUseEvent,
        fixture.state,

        [fixture.borrower],

        FIRST_ROUND,
        reservations,
      ),
    );

    expect(borrowedSelection.itemsByRole.user[0]?.owner.id).toBe(fixture.target.id);

    const borrowedResolution = resolveSelection(
      borrowedUseEvent,
      fixture.state,

      [fixture.borrower],

      FIRST_ROUND,
      borrowedSelection,
      0,
      reservations.itemInstanceIds,
    );

    expect(borrowedResolution.changes[0]?.type).toBe("use-item");

    reserveResolution(borrowedSelection, borrowedResolution, reservations);

    expect(reservations.tributeIds.has(fixture.target.id)).toBe(true);

    expect(reservations.itemInstanceIds.has(rope.id)).toBe(true);

    expect(selectTheft(fixture, reservations)).toBeNull();
  });

  it("allows reusable stolen and borrowed items to be used again in a later round", () => {
    const stolenFixture = createReservationFixture(["rope"]);

    const stolenRope = requireItem(stolenFixture.targetItems);

    const firstRoundReservations = createRoundReservations();

    const theftSelection = requireSelection(selectTheft(stolenFixture, firstRoundReservations));

    const theftResolution = resolveSuccessfulTheft(
      stolenFixture,
      theftSelection,
      firstRoundReservations,
    );

    reserveResolution(theftSelection, theftResolution, firstRoundReservations);

    const stateAfterTheft = applyResolution(
      stolenFixture.state,
      STEAL_FROM_STRONGER_TRIBUTE_EVENT,
      theftSelection,
      theftResolution,
      FIRST_ROUND,
    );

    const nextThief = requireTribute(stateAfterTheft, stolenFixture.thief.id);

    const nextRoundUseEvent = createItemEvent({
      id: "use-stolen-rope-next-round",

      userTributeId: nextThief.id,

      itemDefinitionIds: ["rope"],

      itemAccess: "owned",
    });

    /*
     * A new round creates new reservation sets.
     */
    const nextRoundReservations = createRoundReservations();

    const nextRoundSelection = requireSelection(
      selectDefinition(
        nextRoundUseEvent,
        stateAfterTheft,

        [nextThief],

        NEXT_ROUND,
        nextRoundReservations,
      ),
    );

    expect(nextRoundSelection.itemsByRole.user[0]?.owner.id).toBe(nextThief.id);

    expect(nextRoundSelection.itemsByRole.user[0]?.item.id).toBe(stolenRope.id);

    const borrowedFixture = createReservationFixture(["rope"]);

    const borrowedRope = requireItem(borrowedFixture.targetItems);

    const borrowEvent = createItemEvent({
      id: "borrow-reusable-rope",

      userTributeId: borrowedFixture.borrower.id,

      itemDefinitionIds: ["rope"],

      itemAccess: "accessible",
    });

    const borrowReservations = createRoundReservations();

    const firstBorrowSelection = requireSelection(
      selectDefinition(
        borrowEvent,
        borrowedFixture.state,

        [borrowedFixture.borrower],

        FIRST_ROUND,
        borrowReservations,
      ),
    );

    const firstBorrowResolution = resolveSelection(
      borrowEvent,
      borrowedFixture.state,

      [borrowedFixture.borrower],

      FIRST_ROUND,
      firstBorrowSelection,
      0,
      borrowReservations.itemInstanceIds,
    );

    reserveResolution(firstBorrowSelection, firstBorrowResolution, borrowReservations);

    expect(borrowReservations.itemInstanceIds.has(borrowedRope.id)).toBe(true);

    const laterBorrowSelection = requireSelection(
      selectDefinition(
        borrowEvent,
        borrowedFixture.state,

        [borrowedFixture.borrower],

        NEXT_ROUND,

        /*
         * Fresh sets prove reservations do not leak
         * out of the round in which they were made.
         */
        createRoundReservations(),
      ),
    );

    expect(laterBorrowSelection.itemsByRole.user[0]?.item.id).toBe(borrowedRope.id);
  });

  it("never commits one physical item in two different events across seeded ordinary rounds", () => {
    for (let index = 0; index < 250; index += 1) {
      const seed = `cross-event-reservation-${index}`;

      const fixture = createReservationFixture(
        ["rope", "matches", "map"],

        seed,
      );

      const round = index % 2 === 0 ? FIRST_ROUND : NEXT_ROUND;

      const events = sequenceRoundEvents(fixture.state, round);

      const committedByEvent = new Map<string, string>();

      for (const event of events) {
        /*
         * Duplicate references inside one event are not
         * the concern here. The same physical item must
         * not be committed by two separate events.
         */
        const eventItemIds = new Set(getCommittedItemInstanceIds(event.changes));

        for (const itemId of eventItemIds) {
          const previousEventId = committedByEvent.get(itemId);

          expect(
            previousEventId,
            `Seed "${seed}" committed item ` +
              `"${itemId}" in both ` +
              `"${previousEventId}" and ` +
              `"${event.id}".`,
          ).toBeUndefined();

          committedByEvent.set(itemId, event.id);
        }
      }
    }
  });
});
