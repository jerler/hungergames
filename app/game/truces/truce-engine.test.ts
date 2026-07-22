import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import {
  areTributesInSameTruce,
  createTruceInstance,
  expireTrucesAfterRound,
  getActiveTruceForTribute,
  getTruceFormationPopulationMultiplier,
} from "~/game/truces/truce-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameChange, GameState, ResolvedEvent, RoundReference } from "~/game/types/game-state";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { createEvenTruceInventoryRedistributionChanges } from "~/game/truces/truce-inventory";
import { createSeededRandom } from "~/game/engine/random";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const NIGHT_ONE = {
  day: 1,
  period: "night",
} as const;

function createGame(): GameState {
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
        return `id-${nextId}`;
      },
      seed: "truce-tests",
      now: "2026-07-20T12:00:00.000Z",
    },
  );
}

function createEvent(
  id: string,
  changes: GameChange[],
  participantTributeIds: string[],
  round: RoundReference = DAY_ONE,
): ResolvedEvent {
  return {
    id,
    definitionId: id,
    resolutionMode: "standard",
    round,
    participantTributeIds,
    text: "Test event.",
    changes,
  };
}

describe("truce engine", () => {
  it("forms and breaks a truce", () => {
    const game = createGame();

    const members = game.tributes.slice(0, 2);

    const truce = createTruceInstance(
      "form-event",
      members.map((tribute) => tribute.id),
      DAY_ONE,
      NIGHT_ONE,
    );

    const formedState = applyResolvedEvent(
      game,
      createEvent(
        "form-event",
        [
          {
            type: "form-truce",
            truce,
          },
        ],
        truce.tributeIds,
      ),
    );

    expect(formedState.truces).toEqual([truce]);

    expect(getActiveTruceForTribute(formedState, members[0].id)).toEqual(truce);

    expect(areTributesInSameTruce(formedState, members[0].id, members[1].id)).toBe(true);

    const brokenState = applyResolvedEvent(
      formedState,
      createEvent(
        "break-event",
        [
          {
            type: "break-truce",
            truceId: truce.id,
            reason: "amicable",
          },
        ],
        truce.tributeIds,
      ),
    );

    expect(brokenState.truces).toEqual([]);
  });

  it("rejects a standard truce without an expiry round", () => {
    const game = createGame();

    expect(() =>
      createTruceInstance(
        "permanent-standard-truce",
        [game.tributes[0].id, game.tributes[1].id],
        DAY_ONE,
        null,
        "standard",
      ),
    ).toThrow(/standard truce requires an expiry round/i);
  });

  it("rejects loaded state containing a permanent standard truce", () => {
    const game = createGame();

    const validTruce = createTruceInstance(
      "valid-standard-truce",
      [game.tributes[0].id, game.tributes[1].id],
      DAY_ONE,
      NIGHT_ONE,
      "standard",
    );

    const invalidTruce = {
      ...validTruce,
      expiresAfterRound: null,
    };

    expect(() =>
      assertGameStateInvariants({
        ...game,
        truces: [invalidTruce],
      }),
    ).toThrow(/standard truce.*expiry round/i);
  });

  it("prevents ordinary breakup changes from ending a romantic truce", () => {
    const game = createGame();

    const romanticTruce = createTruceInstance(
      "romantic-formation",
      [game.tributes[0].id, game.tributes[1].id],
      DAY_ONE,
      null,
      "romantic",
    );

    const formedState = applyResolvedEvent(
      game,
      createEvent(
        "romantic-formation",
        [
          {
            type: "form-truce",
            truce: romanticTruce,
          },
        ],
        romanticTruce.tributeIds,
      ),
    );

    const forbiddenReasons = ["expired", "amicable", "betrayal"] as const;

    for (const reason of forbiddenReasons) {
      expect(() =>
        applyResolvedEvent(
          formedState,
          createEvent(
            `invalid-romantic-break-${reason}`,
            [
              {
                type: "break-truce",
                truceId: romanticTruce.id,
                reason,
              },
            ],
            romanticTruce.tributeIds,
          ),
        ),
      ).toThrow(/romantic truce.*accidental separation/i);
    }

    expect(formedState.truces).toEqual([romanticTruce]);
  });

  it("allows accidental separation to end a romantic truce", () => {
    const game = createGame();

    const romanticTruce = createTruceInstance(
      "romantic-formation",
      [game.tributes[0].id, game.tributes[1].id],
      DAY_ONE,
      null,
      "romantic",
    );

    const formedState = applyResolvedEvent(
      game,
      createEvent(
        "romantic-formation",
        [
          {
            type: "form-truce",
            truce: romanticTruce,
          },
        ],
        romanticTruce.tributeIds,
      ),
    );

    const separatedState = applyResolvedEvent(
      formedState,
      createEvent(
        "accidental-romantic-separation",
        [
          {
            type: "break-truce",
            truceId: romanticTruce.id,
            reason: "accidental",
          },
        ],
        romanticTruce.tributeIds,
      ),
    );

    expect(separatedState.truces).toEqual([]);
  });

  it("prevents a tribute from joining two active truces", () => {
    const game = createGame();

    const firstTruce = createTruceInstance(
      "first-form",
      [game.tributes[0].id, game.tributes[1].id],
      DAY_ONE,
      NIGHT_ONE,
    );

    const formedState = applyResolvedEvent(
      game,
      createEvent(
        "first-form",
        [
          {
            type: "form-truce",
            truce: firstTruce,
          },
        ],
        firstTruce.tributeIds,
      ),
    );

    const overlappingTruce = createTruceInstance(
      "second-form",
      [game.tributes[0].id, game.tributes[2].id],
      DAY_ONE,
      NIGHT_ONE,
    );

    expect(() =>
      applyResolvedEvent(
        formedState,
        createEvent(
          "second-form",
          [
            {
              type: "form-truce",
              truce: overlappingTruce,
            },
          ],
          overlappingTruce.tributeIds,
        ),
      ),
    ).toThrow(/already belongs to truce/);
  });

  it("dissolves the whole truce when one member dies", () => {
    const game = createGame();

    const firstTribute = game.tributes[0];

    const secondTribute = game.tributes[1];

    const truce = createTruceInstance(
      "form-event",
      [firstTribute.id, secondTribute.id],
      DAY_ONE,
      NIGHT_ONE,
    );

    const formedState = applyResolvedEvent(
      game,
      createEvent(
        "form-event",
        [
          {
            type: "form-truce",
            truce,
          },
        ],
        truce.tributeIds,
      ),
    );

    const stateAfterDeath = applyResolvedEvent(
      formedState,
      createEvent(
        "death-event",
        [
          {
            type: "eliminate-tribute",

            tributeId: firstTribute.id,

            causeId: "test-death",

            causeLabel: "Test death",

            summary: "A tribute died.",

            killerTributeIds: [],
          },
        ],
        [firstTribute.id],
      ),
    );

    expect(stateAfterDeath.truces).toEqual([]);
    expect(
      stateAfterDeath.eventHistory.some((event) => event.definitionId === "truce-ended-by-death"),
    ).toBe(true);
  });

  it("expires a truce after its final active round", () => {
    const game = createGame();

    const truce = createTruceInstance(
      "form-event",
      [game.tributes[0].id, game.tributes[1].id],
      DAY_ONE,
      NIGHT_ONE,
    );

    const formedState = applyResolvedEvent(
      game,
      createEvent(
        "form-event",
        [
          {
            type: "form-truce",
            truce,
          },
        ],
        truce.tributeIds,
      ),
    );

    const expiredState = expireTrucesAfterRound({
      ...formedState,
      currentRound: NIGHT_ONE,
      roundEvents: [],
      revealedEventCount: 0,
    });

    expect(expiredState.truces).toEqual([]);

    expect(expiredState.roundEvents).toEqual([
      expect.objectContaining({
        definitionId: "truce-expired",

        participantTributeIds: truce.tributeIds,
      }),
    ]);

    expect(expiredState.eventHistory[expiredState.eventHistory.length - 1]?.definitionId).toBe(
      "truce-expired",
    );

    expect(expiredState.revealedEventCount).toBe(1);
  });

  it("makes formation less likely as the population falls", () => {
    const game = createGame();

    const earlyMultiplier = getTruceFormationPopulationMultiplier(game);

    const fourRemaining = {
      ...game,

      tributes: game.tributes.map((tribute, index) => ({
        ...tribute,
        isAlive: index < 4,
      })),
    };

    const lateMultiplier = getTruceFormationPopulationMultiplier(fourRemaining);

    const threeRemaining = {
      ...game,

      tributes: game.tributes.map((tribute, index) => ({
        ...tribute,
        isAlive: index < 3,
      })),
    };

    expect(earlyMultiplier).toBeGreaterThan(lateMultiplier);

    expect(getTruceFormationPopulationMultiplier(threeRemaining)).toBe(0);
  });

  it("transfers an item without changing its identity or uses", () => {
    const game = createGame();

    const source = game.tributes[0];

    const recipient = game.tributes[1];

    const item = createInventoryItemInstance("item-found", source.id, "medicine", DAY_ONE);

    const stateWithItem = applyResolvedEvent(
      game,
      createEvent(
        "item-found",
        [
          {
            type: "acquire-item",

            tributeId: source.id,
            acquisitionSource: "cornucopia",
            item,
          },
        ],
        [source.id],
      ),
    );

    const transferredState = applyResolvedEvent(
      stateWithItem,
      createEvent(
        "item-shared",
        [
          {
            type: "transfer-item",

            itemInstanceId: item.id,

            fromTributeId: source.id,

            toTributeId: recipient.id,

            reason: "test-transfer",
          },
        ],
        [source.id, recipient.id],
      ),
    );

    const resultingSource = transferredState.tributes.find((tribute) => tribute.id === source.id);

    const resultingRecipient = transferredState.tributes.find(
      (tribute) => tribute.id === recipient.id,
    );

    expect(resultingSource?.inventory).toEqual([]);

    expect(resultingRecipient?.inventory).toContainEqual(item);

    expect(resultingRecipient?.inventory[0].usesRemaining).toBe(item.usesRemaining);

    expect(
      transferredState.itemTransactions[transferredState.itemTransactions.length - 1],
    ).toMatchObject({
      type: "transferred",
      tributeId: recipient.id,
      fromTributeId: source.id,
      toTributeId: recipient.id,
      itemInstanceId: item.id,
      uses: item.usesRemaining,
      sourceId: "test-transfer",
    });

    expect(() => assertGameStateInvariants(transferredState)).not.toThrow();
  });

  it("redistributes truce inventory evenly and deterministically", () => {
    const game = createGame();

    const members = game.tributes.slice(0, 3);

    const itemIds = ["water", "food", "medicine", "blanket", "rope"] as const;

    const acquiredItems = itemIds.map((itemId, index) =>
      createInventoryItemInstance(`setup-item-${index}`, members[0].id, itemId, DAY_ONE),
    );

    const gameWithItems = acquiredItems.reduce(
      (currentState, item, index) =>
        applyResolvedEvent(
          currentState,
          createEvent(
            `setup-item-${index}`,
            [
              {
                type: "acquire-item",

                tributeId: members[0].id,
                acquisitionSource: "cornucopia",

                item,
              },
            ],
            [members[0].id],
          ),
        ),
      game,
    );

    const truce = createTruceInstance(
      "group-truce",
      members.map((member) => member.id),
      DAY_ONE,
      NIGHT_ONE,
    );

    const stateWithTruce = applyResolvedEvent(
      gameWithItems,
      createEvent(
        "group-truce",
        [
          {
            type: "form-truce",

            truce,
          },
        ],
        truce.tributeIds,
      ),
    );

    const createChanges = () =>
      createEvenTruceInventoryRedistributionChanges(
        stateWithTruce,
        truce,
        createSeededRandom("even-distribution"),
        "test-separation",
      );

    const firstChanges = createChanges();

    const secondChanges = createChanges();

    expect(secondChanges).toEqual(firstChanges);

    const redistributedState = applyResolvedEvent(
      stateWithTruce,
      createEvent("redistribution", firstChanges, truce.tributeIds),
    );

    const finalCounts = members.map(
      (member) =>
        redistributedState.tributes.find((tribute) => tribute.id === member.id)?.inventory.length ??
        0,
    );

    expect(Math.max(...finalCounts) - Math.min(...finalCounts)).toBeLessThanOrEqual(1);

    expect(finalCounts.reduce((total, count) => total + count, 0)).toBe(acquiredItems.length);

    expect(() => assertGameStateInvariants(redistributedState)).not.toThrow();
  });
});
