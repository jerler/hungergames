import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import {
  selectEventParticipants,
  type ParticipantSelection,
} from "~/game/events/participant-selection";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type {
  GameChange,
  GameState,
  GameTribute,
  ResolvedEvent,
  InventoryItem,
  RoundReference,
} from "~/game/types/game-state";
import { COMBAT_EVENTS } from "~/game/events/catalogue/encounters/combat-events";

import {
  MAX_CONSECUTIVE_NON_ELIMINATION_ROUNDS,
  reserveEventCommitments,
  sequenceRoundEvents,
} from "./event-sequencer";

const FIRST_ROUND = {
  day: 1,
  period: "night",
} as const;

const NEXT_ROUND = {
  day: 2,
  period: "day",
} as const;

const THEFT_EVENT_ID = "steal-from-stronger-tribute";

const COMBAT_EVENT_IDS = new Set(COMBAT_EVENTS.map((event) => event.id));

interface SharedItemFixture {
  state: GameState;

  owner: GameTribute;
  firstBorrower: GameTribute;
  secondBorrower: GameTribute;
  outsider: GameTribute;

  item: InventoryItem;
}

function createSafetyCombatGame(seed: string): GameState {
  const game = createTestGame(seed);

  return {
    ...game,
    seed,

    engine: {
      ...game.engine,

      consecutiveNonEliminationRounds: MAX_CONSECUTIVE_NON_ELIMINATION_ROUNDS,
    },

    tributes: game.tributes.map((tribute) => ({
      ...tribute,

      inventory: [
        ...tribute.inventory,

        createInventoryItemInstance(
          `safety-combat:${tribute.id}`,
          tribute.id,
          "knife",
          FIRST_ROUND,
        ),
      ],
    })),

    truces: [],
  };
}

function createTestGame(seed = "event-reservations"): GameState {
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

function createTheftEligibleGame(seed: string): GameState {
  const game = createTestGame(seed);

  const target = game.tributes[1];

  const targetItem = createInventoryItemInstance(
    "theft-catalogue-setup",
    target.id,
    "bow",

    {
      day: 1,
      period: "day",
    },
  );

  return {
    ...game,
    seed,

    tributes: game.tributes.map((tribute, index): GameTribute => {
      if (index === 1) {
        return {
          ...tribute,

          snapshot: {
            ...tribute.snapshot,

            name: "Strong Target",

            stats: {
              brains: 5,
              brawn: 5,
              luck: 5,
            },
          },

          statuses: [],
          inventory: [targetItem],
        };
      }

      /*
       * Every other tribute is a plausible strategic
       * thief with the strong target as a valid mark.
       * This makes the integration test about event
       * selection rather than one particular tribute.
       */
      return {
        ...tribute,

        snapshot: {
          ...tribute.snapshot,

          name: `Potential Thief ${index}`,

          stats: {
            brains: 5,
            brawn: 1,
            luck: 5,
          },
        },

        statuses: [],
        inventory: [],
      };
    }),

    truces: [],
  };
}

function createTheftIneligibleGame(seed: string): GameState {
  const game = createTestGame(seed);

  return {
    ...game,
    seed,

    tributes: game.tributes.map((tribute): GameTribute => ({
      ...tribute,

      snapshot: {
        ...tribute.snapshot,

        stats: {
          brains: 3,
          brawn: 3,
          luck: 3,
        },
      },

      /*
       * Without any personally owned items, no tribute
       * can satisfy the theft target role.
       */
      statuses: [],
      inventory: [],
    })),

    truces: [],
  };
}

interface TheftSequenceFixture {
  seed: string;
  state: GameState;
  events: ResolvedEvent[];
}

function findReachableTheftSequence(): TheftSequenceFixture {
  /*
   * This is a reachability test, not a frequency assertion.
   * Searching deterministic seeds avoids coupling the test
   * to one weighted-catalogue threshold that may move when
   * unrelated event weights are tuned later.
   */
  for (let index = 0; index < 1_000; index += 1) {
    const seed = `theft-reachability-${index}`;

    const state = createTheftEligibleGame(seed);

    const events = sequenceRoundEvents(state, NEXT_ROUND);

    if (events.some((event) => event.definitionId === THEFT_EVENT_ID)) {
      return {
        seed,
        state,
        events,
      };
    }
  }

  throw new Error("No deterministic test seed selected an eligible theft event.");
}

function createSharedItemFixture(definitionId: ItemDefinitionId): SharedItemFixture {
  const originalState = createTestGame(`shared-${definitionId}`);

  const [originalOwner, originalFirstBorrower, originalSecondBorrower] = originalState.tributes;

  const item = createInventoryItemInstance(
    `shared-${definitionId}-source`,
    originalOwner.id,
    definitionId,
    FIRST_ROUND,
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

    truces: [
      {
        id: `shared-${definitionId}-truce`,
        kind: "standard",

        tributeIds: [originalOwner.id, originalFirstBorrower.id, originalSecondBorrower.id],

        createdRound: {
          ...FIRST_ROUND,
        },

        expiresAfterRound: { ...NEXT_ROUND },
      },
    ],
  };

  const [owner, firstBorrower, secondBorrower, outsider] = state.tributes;

  return {
    state,
    owner,
    firstBorrower,
    secondBorrower,
    outsider,
    item,
  };
}

function createRequiredItemEvent(id: string, definitionId: ItemDefinitionId): EventDefinition {
  return {
    id,
    category: "survival",

    tags: ["survival", "item"],

    periods: ["day", "night"],

    baseWeight: 1,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: [definitionId],
      },
    ],

    resolve: () => ({
      text: "Test item event.",
      changes: [],
    }),
  };
}

function createParticipantEvent(id: string): EventDefinition {
  return {
    id,
    category: "survival",
    tags: ["survival"],

    periods: ["day", "night"],

    baseWeight: 1,

    roles: [
      {
        id: "tribute",
        count: 1,
      },
    ],

    resolve: () => ({
      text: "Test participant event.",
      changes: [],
    }),
  };
}

function createContext(
  state: GameState,
  livingTributes: readonly GameTribute[],
  round: RoundReference = FIRST_ROUND,
): EventSelectionContext {
  return {
    state,
    round,
    livingTributes,
  };
}

function selectRequiredItemEvent(
  state: GameState,
  tribute: GameTribute,
  definitionId: ItemDefinitionId,
  unavailableTributeIds: ReadonlySet<string> = new Set<string>(),
  unavailableItemInstanceIds: ReadonlySet<string> = new Set<string>(),
  round: RoundReference = FIRST_ROUND,
  eventId = "required-item-event",
): ParticipantSelection | null {
  return selectEventParticipants(
    createRequiredItemEvent(eventId, definitionId),

    createContext(state, [tribute], round),

    () => 0,

    unavailableTributeIds,
    unavailableItemInstanceIds,
  );
}

function createResolutionOnlySelection(
  participantTributeIds: readonly string[] = [],
): ParticipantSelection {
  return {
    participantsByRole: {},
    participantTributeIds: [...participantTributeIds],

    itemsByRole: {},
    selectedItemInstanceIds: [],
  };
}

describe("ordinary round item reservations", () => {
  it("reserves required items and their hidden truce owners", () => {
    const { state, owner, firstBorrower, secondBorrower, item } = createSharedItemFixture("knife");

    const selection = selectRequiredItemEvent(state, firstBorrower, "knife");

    expect(selection).not.toBeNull();

    if (!selection) {
      throw new Error("Expected the borrowed knife to be selected.");
    }

    const unavailableTributeIds = new Set<string>();

    const unavailableItemInstanceIds = new Set<string>();

    reserveEventCommitments(selection, [], unavailableTributeIds, unavailableItemInstanceIds);

    expect(unavailableItemInstanceIds).toContain(item.id);

    expect(unavailableTributeIds).toContain(firstBorrower.id);

    expect(unavailableTributeIds).toContain(owner.id);

    /*
     * Use an empty tribute reservation set here so this
     * assertion specifically proves the item reservation
     * blocks another borrower.
     */
    const secondSelection = selectRequiredItemEvent(
      state,
      secondBorrower,
      "knife",
      new Set<string>(),
      unavailableItemInstanceIds,
    );

    expect(secondSelection).toBeNull();
  });

  it("prevents a borrowed item's owner from entering an incompatible event", () => {
    const { state, owner, firstBorrower } = createSharedItemFixture("knife");

    const selection = selectRequiredItemEvent(state, firstBorrower, "knife");

    if (!selection) {
      throw new Error("Expected the borrowed knife to be selected.");
    }

    const unavailableTributeIds = new Set<string>();

    reserveEventCommitments(selection, [], unavailableTributeIds, new Set<string>());

    const ownerSelection = selectEventParticipants(
      createParticipantEvent("owner-incompatible-event"),

      createContext(state, [owner]),

      () => 0,

      unavailableTributeIds,
      new Set<string>(),
    );

    expect(ownerSelection).toBeNull();
  });

  it("reserves reusable items referenced by use changes", () => {
    const { state, owner, secondBorrower, outsider, item } = createSharedItemFixture("knife");

    const changes: readonly GameChange[] = [
      {
        type: "use-item",
        tributeId: owner.id,
        itemInstanceId: item.id,
        reason: "opportunistic-test-use",
      },
    ];

    const unavailableTributeIds = new Set<string>();

    const unavailableItemInstanceIds = new Set<string>();

    reserveEventCommitments(
      createResolutionOnlySelection([outsider.id]),
      changes,
      unavailableTributeIds,
      unavailableItemInstanceIds,
    );

    expect(unavailableItemInstanceIds).toContain(item.id);

    /*
     * The owner may be hidden from the event narrative,
     * but the event depends on their inventory remaining
     * stable until it is revealed.
     */
    expect(unavailableTributeIds).toContain(owner.id);

    const laterSelection = selectRequiredItemEvent(
      state,
      secondBorrower,
      "knife",
      new Set<string>(),
      unavailableItemInstanceIds,
    );

    expect(laterSelection).toBeNull();
  });

  it("reserves limited-use items referenced by consumption changes", () => {
    const { state, owner, secondBorrower, outsider, item } = createSharedItemFixture("medicine");

    const changes: readonly GameChange[] = [
      {
        type: "consume-item",
        tributeId: owner.id,
        itemInstanceId: item.id,
        uses: 1,
        reason: "opportunistic-test-consumption",
      },
    ];

    const unavailableTributeIds = new Set<string>();

    const unavailableItemInstanceIds = new Set<string>();

    reserveEventCommitments(
      createResolutionOnlySelection([outsider.id]),
      changes,
      unavailableTributeIds,
      unavailableItemInstanceIds,
    );

    expect(unavailableItemInstanceIds).toContain(item.id);

    expect(unavailableTributeIds).toContain(owner.id);

    const laterSelection = selectRequiredItemEvent(
      state,
      secondBorrower,
      "medicine",
      new Set<string>(),
      unavailableItemInstanceIds,
    );

    expect(laterSelection).toBeNull();
  });

  it("prevents a transferred item from being selected again from the round-opening state", () => {
    const { state, owner, firstBorrower, outsider, item } = createSharedItemFixture("knife");

    const changes: readonly GameChange[] = [
      {
        type: "transfer-item",
        itemInstanceId: item.id,
        fromTributeId: owner.id,
        toTributeId: firstBorrower.id,
        reason: "test-transfer",
      },
    ];

    const unavailableTributeIds = new Set<string>();

    const unavailableItemInstanceIds = new Set<string>();

    reserveEventCommitments(
      createResolutionOnlySelection([outsider.id]),
      changes,
      unavailableTributeIds,
      unavailableItemInstanceIds,
    );

    expect(unavailableItemInstanceIds).toContain(item.id);

    expect(unavailableTributeIds).toContain(owner.id);

    expect(unavailableTributeIds).toContain(firstBorrower.id);

    /*
     * The unchanged round-opening state still says the
     * old owner has the knife. Its reservation must be
     * enough to reject both later use and later transfer
     * event selection.
     */
    const laterUseSelection = selectRequiredItemEvent(
      state,
      owner,
      "knife",
      new Set<string>(),
      unavailableItemInstanceIds,
      FIRST_ROUND,
      "later-use-event",
    );

    const laterTransferSelection = selectRequiredItemEvent(
      state,
      owner,
      "knife",
      new Set<string>(),
      unavailableItemInstanceIds,
      FIRST_ROUND,
      "later-transfer-event",
    );

    expect(laterUseSelection).toBeNull();

    expect(laterTransferSelection).toBeNull();
  });

  it("reserves newly acquired item instance IDs", () => {
    const { firstBorrower, outsider } = createSharedItemFixture("knife");

    const acquiredItem = createInventoryItemInstance(
      "ordinary-acquisition-event",
      firstBorrower.id,
      "rope",
      FIRST_ROUND,
    );

    const changes: readonly GameChange[] = [
      {
        type: "acquire-item",
        tributeId: firstBorrower.id,
        acquisitionSource: "sponsor",
        item: acquiredItem,
      },
    ];

    const unavailableTributeIds = new Set<string>();

    const unavailableItemInstanceIds = new Set<string>();

    reserveEventCommitments(
      createResolutionOnlySelection([outsider.id]),
      changes,
      unavailableTributeIds,
      unavailableItemInstanceIds,
    );

    expect(unavailableItemInstanceIds).toContain(acquiredItem.id);

    expect(unavailableTributeIds).toContain(firstBorrower.id);
  });

  it("makes reusable items available again with fresh next-round reservations", () => {
    const { state, owner, firstBorrower, secondBorrower, item } = createSharedItemFixture("knife");

    const firstSelection = selectRequiredItemEvent(state, firstBorrower, "knife");

    if (!firstSelection) {
      throw new Error("Expected the reusable knife to be selected.");
    }

    const currentRoundTributes = new Set<string>();

    const currentRoundItems = new Set<string>();

    reserveEventCommitments(
      firstSelection,

      [
        {
          type: "use-item",
          tributeId: owner.id,
          itemInstanceId: item.id,
          reason: "current-round-use",
        },
      ],

      currentRoundTributes,
      currentRoundItems,
    );

    const sameRoundSelection = selectRequiredItemEvent(
      state,
      secondBorrower,
      "knife",
      new Set<string>(),
      currentRoundItems,
      FIRST_ROUND,
      "same-round-use",
    );

    expect(sameRoundSelection).toBeNull();

    /*
     * sequenceRoundEvents creates new reservation sets
     * whenever another round is planned. A reusable item
     * therefore becomes eligible again.
     */
    const nextRoundSelection = selectRequiredItemEvent(
      state,
      secondBorrower,
      "knife",
      new Set<string>(),
      new Set<string>(),
      NEXT_ROUND,
      "next-round-use",
    );

    expect(nextRoundSelection).not.toBeNull();
  });
});

describe("ordinary theft sequencing", () => {
  it("can select theft in a real ordinary round and remains deterministic", () => {
    const first = findReachableTheftSequence();

    const repeatedState = createTheftEligibleGame(first.seed);

    const repeatedEvents = sequenceRoundEvents(repeatedState, NEXT_ROUND);

    expect(repeatedEvents).toEqual(first.events);

    const theftEvent = first.events.find((event) => event.definitionId === THEFT_EVENT_ID);

    expect(theftEvent).toBeDefined();

    expect(theftEvent?.participantTributeIds).toHaveLength(2);

    expect(new Set(theftEvent?.participantTributeIds).size).toBe(2);

    /*
     * Ordinary round reservations ensure neither theft
     * participant appears in another planned event.
     */
    const allParticipantIds = first.events.flatMap((event) => event.participantTributeIds);

    expect(new Set(allParticipantIds).size).toBe(allParticipantIds.length);
  });

  it("cannot select theft when no valid pairing exists", () => {
    const state = createTheftIneligibleGame("ineligible-theft");

    const events = sequenceRoundEvents(state, NEXT_ROUND);

    expect(events.some((event) => event.definitionId === THEFT_EVENT_ID)).toBe(false);
  });

  it("does not use the ordinary theft event during the Bloodbath", () => {
    const state = createTheftEligibleGame("bloodbath-excludes-theft");

    const events = sequenceRoundEvents(
      state,

      {
        day: 1,
        period: "day",
      },
    );

    expect(events.some((event) => event.definitionId === THEFT_EVENT_ID)).toBe(false);
  });
});

describe("forced combat elimination", () => {
  it("can use a migrated weapon attack as the safety resolution", () => {
    let combatEvent: ResolvedEvent | undefined;

    for (let index = 0; index < 1_000; index += 1) {
      const events = sequenceRoundEvents(
        createSafetyCombatGame(`safety-combat-${index}`),
        NEXT_ROUND,
      );

      const firstEvent = events[0];

      if (firstEvent && COMBAT_EVENT_IDS.has(firstEvent.definitionId)) {
        combatEvent = firstEvent;
        break;
      }
    }

    expect(combatEvent).toBeDefined();
    expect(combatEvent?.resolutionMode).toBe("safety");

    expect(
      combatEvent?.changes.filter((change) => change.type === "eliminate-tribute"),
    ).toHaveLength(1);

    expect(combatEvent?.changes.some((change) => change.type === "use-item")).toBe(true);
  });
});
