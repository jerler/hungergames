import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { createSeededRandom } from "~/game/engine/random";
import { isEventDefinitionEligible } from "~/game/events/event-eligibility";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { TRUCE_CONFLICT_EVENTS } from "~/game/events/truce-conflict-events";
import { TRUCE_DISSOLUTION_EVENTS } from "~/game/events/truce-dissolution-events";
import type { EventDefinition } from "~/game/events/event-schema";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { createTruceInstance } from "~/game/truces/truce-engine";
import { createEvenTruceInventoryRedistributionChanges } from "~/game/truces/truce-inventory";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type {
  GameChange,
  GameState,
  ResolvedEvent,
  RoundReference,
  Truce,
  TruceKind,
} from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const NIGHT_ONE = {
  day: 1,
  period: "night",
} as const;

const INVENTORY_DEFINITIONS = [
  "water",
  "food",
  "medicine",
  "blanket",
  "matches",
  "rope",
  "map",
  "camouflage-net",
  "trap-kit",
  "fishing-gear",
  "slingshot",
  "knife",
] satisfies readonly ItemDefinitionId[];

function createGame(seed = "truce-integrity-tests"): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 12 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,

    createRandomTributeDrafts(12, DEFAULT_TRIBUTES, createSeededRandom(`${seed}:reaping`)),

    "random",

    {
      createId: () => {
        nextId += 1;

        return `${seed}-id-${nextId}`;
      },

      seed,

      now: "2026-07-20T12:00:00.000Z",
    },
  );
}

function createEvent(
  id: string,
  changes: readonly GameChange[],
  participantTributeIds: readonly string[],
  round: RoundReference = DAY_ONE,
): ResolvedEvent {
  return {
    id,
    definitionId: id,
    resolutionMode: "standard",
    round,

    participantTributeIds: [...participantTributeIds],

    text: `Test event: ${id}.`,

    changes: [...changes],
  };
}

function formTruce(
  state: GameState,
  tributeIds: readonly string[],
  kind: TruceKind = "standard",
  id = "test-truce",
): {
  state: GameState;
  truce: Truce;
} {
  const truce = createTruceInstance(
    id,

    tributeIds,

    DAY_ONE,

    kind === "romantic" ? null : NIGHT_ONE,

    kind,
  );

  return {
    truce,

    state: applyResolvedEvent(
      state,

      createEvent(
        `${id}-formed`,

        [
          {
            type: "form-truce",

            truce,
          },
        ],

        tributeIds,
      ),
    ),
  };
}

function shareActiveTruce(
  state: GameState,
  firstTributeId: string,
  secondTributeId: string,
): boolean {
  return state.truces.some(
    (truce) =>
      truce.tributeIds.includes(firstTributeId) && truce.tributeIds.includes(secondTributeId),
  );
}

function createInventoryRedistributionState(): {
  state: GameState;
  truce: Truce;
} {
  let state = createGame("inventory-redistribution");

  const members = state.tributes.slice(0, 4);

  /*
   * Deliberately uneven starting
   * distribution:
   *
   * Member 1: 9 items
   * Member 2: 2 items
   * Member 3: 1 item
   * Member 4: 0 items
   */
  for (let index = 0; index < INVENTORY_DEFINITIONS.length; index += 1) {
    const ownerIndex = index < 9 ? 0 : index < 11 ? 1 : 2;

    const owner = members[ownerIndex];

    const definitionId = INVENTORY_DEFINITIONS[index];

    if (!owner || !definitionId) {
      throw new Error("Invalid inventory test setup.");
    }

    const eventId = `inventory-setup-${index}`;

    const item = createInventoryItemInstance(eventId, owner.id, definitionId, DAY_ONE);

    state = applyResolvedEvent(
      state,

      createEvent(
        eventId,

        [
          {
            type: "acquire-item",

            tributeId: owner.id,

            item,
          },
        ],

        [owner.id],
      ),
    );
  }

  return formTruce(
    state,

    members.map((member) => member.id),

    "standard",

    "inventory-truce",
  );
}

function getInventoryItemIds(state: GameState): string[] {
  return state.tributes.flatMap((tribute) => tribute.inventory.map((item) => item.id)).sort();
}

function requireEvent(events: readonly EventDefinition[], id: string): EventDefinition {
  const event = events.find((candidate) => candidate.id === id);

  if (!event) {
    throw new Error(`Missing event definition "${id}".`);
  }

  return event;
}

describe("truce integrity stress tests", () => {
  it("rejects a tribute belonging to two active truces", () => {
    const game = createGame("duplicate-membership");

    const firstTruce = createTruceInstance(
      "first-truce",

      [game.tributes[0].id, game.tributes[1].id],

      DAY_ONE,
      NIGHT_ONE,
      "standard",
    );

    const secondTruce = createTruceInstance(
      "second-truce",

      [game.tributes[0].id, game.tributes[2].id],

      DAY_ONE,
      NIGHT_ONE,
      "standard",
    );

    const invalidState: GameState = {
      ...game,

      truces: [firstTruce, secondTruce],
    };

    expect(() => assertGameStateInvariants(invalidState)).toThrow();
  });

  it("rejects a one-member active truce", () => {
    const game = createGame("one-member-truce");

    const validTruce = createTruceInstance(
      "invalid-truce",

      [game.tributes[0].id, game.tributes[1].id],

      DAY_ONE,
      NIGHT_ONE,
      "standard",
    );

    const invalidTruce: Truce = {
      ...validTruce,

      tributeIds: [game.tributes[0].id],
    };

    expect(() =>
      assertGameStateInvariants({
        ...game,

        truces: [invalidTruce],
      }),
    ).toThrow();
  });

  it("conserves inventory and validates the transfer ledger across repeated redistributions", () => {
    const { state, truce } = createInventoryRedistributionState();

    const initialItemIds = getInventoryItemIds(state);

    expect(initialItemIds).toHaveLength(INVENTORY_DEFINITIONS.length);

    for (let seedIndex = 0; seedIndex < 100; seedIndex += 1) {
      const changes = createEvenTruceInventoryRedistributionChanges(
        state,
        truce,

        createSeededRandom(`redistribution-${seedIndex}`),

        "balance-test",
      );

      const transactionCountBefore = state.itemTransactions.length;

      const nextState = applyResolvedEvent(
        state,

        createEvent(
          `redistribution-event-${seedIndex}`,

          changes,

          truce.tributeIds,
        ),
      );

      expect(getInventoryItemIds(nextState)).toEqual(initialItemIds);

      const resultingCounts = truce.tributeIds.map(
        (tributeId) =>
          nextState.tributes.find((tribute) => tribute.id === tributeId)?.inventory.length ?? 0,
      );

      const smallestCount = Math.min(...resultingCounts);

      const largestCount = Math.max(...resultingCounts);

      expect(largestCount - smallestCount).toBeLessThanOrEqual(1);

      expect(nextState.itemTransactions.length - transactionCountBefore).toBe(changes.length);

      expect(
        nextState.itemTransactions
          .slice(transactionCountBefore)
          .every((transaction) => transaction.type === "transferred"),
      ).toBe(true);

      expect(() => assertGameStateInvariants(nextState)).not.toThrow();
    }
  });

  it("always dissolves the complete truce when any member dies", () => {
    for (let size = 2; size <= 6; size += 1) {
      const game = createGame(`accidental-dissolution-${size}`);

      const members = game.tributes.slice(0, size);

      const { state: formedState, truce } = formTruce(
        game,

        members.map((member) => member.id),

        "standard",

        `death-test-truce-${size}`,
      );

      const victim = members[0];

      const text = `${victim.snapshot.name} dies during a test event.`;

      const nextState = applyResolvedEvent(
        formedState,

        createEvent(
          `member-death-${size}`,

          [
            {
              type: "eliminate-tribute",

              tributeId: victim.id,

              causeId: "test-death",

              causeLabel: "Test death",

              summary: text,

              killerTributeIds: [],
            },
          ],

          [victim.id],
        ),
      );

      expect(nextState.truces.some((candidate) => candidate.id === truce.id)).toBe(false);

      expect(
        nextState.truces.some((candidate) =>
          candidate.tributeIds.some((tributeId) => truce.tributeIds.includes(tributeId)),
        ),
      ).toBe(false);

      expect(
        nextState.eventHistory.filter((event) => event.definitionId === "truce-ended-by-death"),
      ).toHaveLength(1);

      expect(() => assertGameStateInvariants(nextState)).not.toThrow();
    }
  });

  it("never offers standard breakup events to a romantic pair", () => {
    const game = createGame("romantic-breakup-protection");

    const partners = game.tributes.slice(0, 2);

    const { state } = formTruce(
      game,

      partners.map((partner) => partner.id),

      "romantic",

      "protected-romantic-truce",
    );

    const context = {
      state,
      round: DAY_ONE,

      livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    };

    const standardBreakupEvents = [
      ...TRUCE_DISSOLUTION_EVENTS,

      ...TRUCE_CONFLICT_EVENTS.filter((event) => event.id.startsWith("truce-betrayal-")),
    ];

    expect(standardBreakupEvents.length).toBeGreaterThan(0);

    for (const definition of standardBreakupEvents) {
      expect(isEventDefinitionEligible(definition, context)).toBe(false);

      expect(
        selectEventParticipants(
          definition,
          context,

          createSeededRandom(`romantic-rejection-${definition.id}`),

          new Set(),
        ),
      ).toBeNull();
    }
  });

  it("never selects active truce partners as opposing combat roles", () => {
    const game = createGame("combat-opponent-protection");

    const members = game.tributes.slice(0, 2);

    const firstMember = members[0];

    const secondMember = members[1];

    if (!firstMember || !secondMember) {
      throw new Error("The combat test requires two truce members.");
    }

    const { state } = formTruce(
      game,

      [firstMember.id, secondMember.id],

      "standard",

      "combat-protection-truce",
    );

    /*
     * Restrict the selection pool to:
     *
     * - Two members of the same truce
     * - Two unrelated tributes
     *
     * The attacker is forced to be the
     * first truce member. The defender
     * must therefore be one of the two
     * outsiders, never their partner.
     */
    const livingTributes = state.tributes.slice(0, 4);

    const combatDefinition: EventDefinition = {
      id: "test-opposing-combat-roles",

      category: "fatal",

      tags: ["combat"],

      periods: ["day"],

      baseWeight: 1,

      roles: [
        {
          id: "attacker",

          count: 1,

          opposesRoleIds: ["defender"],

          isEligible: (tribute) => tribute.id === firstMember.id,
        },

        {
          id: "defender",

          count: 1,

          opposesRoleIds: ["attacker"],
        },
      ],

      resolve({ participantsByRole }) {
        const attacker = participantsByRole.attacker?.[0];

        const defender = participantsByRole.defender?.[0];

        if (!attacker || !defender) {
          throw new Error("The test combat event requires an attacker and defender.");
        }

        return {
          text: `${attacker.snapshot.name} confronts ${defender.snapshot.name}.`,

          changes: [],
        };
      },
    };

    const outsiderIds = new Set(livingTributes.slice(2).map((tribute) => tribute.id));

    for (let seedIndex = 0; seedIndex < 100; seedIndex += 1) {
      const selection = selectEventParticipants(
        combatDefinition,

        {
          state,
          round: DAY_ONE,
          livingTributes,
        },

        createSeededRandom(`opposing-role-test-${seedIndex}`),

        new Set(),
      );

      expect(selection).not.toBeNull();

      const attacker = selection?.participantsByRole.attacker?.[0];

      const defender = selection?.participantsByRole.defender?.[0];

      expect(attacker?.id).toBe(firstMember.id);

      /*
       * The first member's truce
       * partner must not be selected
       * as their combat opponent.
       */
      expect(defender?.id).not.toBe(secondMember.id);

      expect(outsiderIds.has(defender?.id ?? "")).toBe(true);

      if (!attacker || !defender) {
        throw new Error("Participant selection unexpectedly omitted a combat role.");
      }

      expect(shareActiveTruce(state, attacker.id, defender.id)).toBe(false);
    }
  });

  it("allows a cooperative protection event to select truce partners", () => {
    const game = createGame("cooperative-selection");

    const members = game.tributes.slice(0, 2);

    const { state } = formTruce(
      game,

      members.map((member) => member.id),

      "standard",

      "cooperative-truce",
    );

    const definition = requireEvent(TRUCE_CONFLICT_EVENTS, "protects-truce-partner");

    const context = {
      state,
      round: DAY_ONE,

      livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    };

    const selection = selectEventParticipants(
      definition,
      context,

      createSeededRandom("cooperative-partner-selection"),

      new Set(),
    );

    expect(selection).not.toBeNull();

    expect(new Set(selection?.participantTributeIds)).toEqual(
      new Set(members.map((member) => member.id)),
    );

    expect(shareActiveTruce(state, members[0].id, members[1].id)).toBe(true);
  });
});
