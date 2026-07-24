import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemAcquisitionSource, ItemDefinitionId } from "~/game/items/item-schema";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, ResolvedEvent, RoundReference } from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const NIGHT_ONE = {
  day: 1,
  period: "night",
} as const;

const DAY_TWO = {
  day: 2,
  period: "day",
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

      seed: "item-provenance-test",
      now: "2026-07-21T12:00:00.000Z",
    },
  );
}

function createAcquisitionEvent(
  state: GameState,
  eventId: string,
  itemId: ItemDefinitionId,
  acquisitionSource: ItemAcquisitionSource,
  round: RoundReference,
): {
  event: ResolvedEvent;
  itemId: string;
} {
  const tribute = state.tributes[0];

  const item = createInventoryItemInstance(eventId, tribute.id, itemId, round);

  return {
    itemId: item.id,

    event: {
      id: eventId,
      definitionId: eventId,
      kind: "primary",
      resolutionMode: "standard",

      round: {
        ...round,
      },

      participantTributeIds: [tribute.id],

      text: "Test acquisition.",

      changes: [
        {
          type: "acquire-item",

          tributeId: tribute.id,
          acquisitionSource,

          item,
        },
      ],
    },
  };
}

describe("item acquisition provenance", () => {
  it.each(["food", "water"] satisfies readonly ItemDefinitionId[])(
    "allows %s to be naturally foraged after Day 1",
    (itemId) => {
      const game = createGame();

      const { event } = createAcquisitionEvent(
        game,
        `forage-${itemId}`,
        itemId,
        "natural-foraging",
        DAY_TWO,
      );

      const nextState = applyResolvedEvent(game, event);

      expect(nextState.itemTransactions).toContainEqual(
        expect.objectContaining({
          type: "acquired",
          definitionId: itemId,
          acquisitionSource: "natural-foraging",

          round: DAY_TWO,
        }),
      );

      expect(() => assertGameStateInvariants(nextState)).not.toThrow();
    },
  );

  it("rejects manufactured natural-foraging acquisitions", () => {
    const game = createGame();

    const { event } = createAcquisitionEvent(
      game,
      "forage-knife",
      "knife",
      "natural-foraging",
      DAY_TWO,
    );

    expect(() => applyResolvedEvent(game, event)).toThrow(
      /cannot be acquired through natural foraging/i,
    );
  });

  it("allows manufactured Cornucopia items during Day 1 daytime", () => {
    const game = createGame();

    const { event } = createAcquisitionEvent(
      game,
      "cornucopia-knife",
      "knife",
      "cornucopia",
      DAY_ONE,
    );

    const nextState = applyResolvedEvent(game, event);

    expect(nextState.itemTransactions).toContainEqual(
      expect.objectContaining({
        type: "acquired",
        definitionId: "knife",
        acquisitionSource: "cornucopia",

        round: DAY_ONE,
      }),
    );

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("allows natural resources to come from the Cornucopia", () => {
    const game = createGame();

    const { event } = createAcquisitionEvent(
      game,
      "cornucopia-water",
      "water",
      "cornucopia",
      DAY_ONE,
    );

    const nextState = applyResolvedEvent(game, event);

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it.each([NIGHT_ONE, DAY_TWO])(
    "rejects Cornucopia acquisitions outside Day 1 daytime",
    (round) => {
      const game = createGame();

      const { event } = createAcquisitionEvent(
        game,
        `invalid-cornucopia-${round.day}-${round.period}`,
        "knife",
        "cornucopia",
        round,
      );

      expect(() => applyResolvedEvent(game, event)).toThrow(
        /only be acquired during Day 1 daytime/i,
      );
    },
  );

  it("rejects sponsor acquisitions until sponsor delivery exists", () => {
    const game = createGame();

    const { event } = createAcquisitionEvent(
      game,
      "sponsor-medicine",
      "medicine",
      "sponsor",
      DAY_TWO,
    );

    expect(() => applyResolvedEvent(game, event)).toThrow(
      /Sponsor item acquisition is not implemented/i,
    );
  });

  it("preserves manufactured-item provenance during a later transfer", () => {
    const game = createGame();

    const sourceTribute = game.tributes[0];

    const targetTribute = game.tributes[1];

    const acquisition = createAcquisitionEvent(
      game,
      "cornucopia-transfer-knife",
      "knife",
      "cornucopia",
      DAY_ONE,
    );

    const stateWithKnife = applyResolvedEvent(game, acquisition.event);

    const acquiredKnife = stateWithKnife.tributes[0].inventory.find(
      (item) => item.id === acquisition.itemId,
    );

    if (!acquiredKnife) {
      throw new Error("Acquired knife is missing.");
    }

    const transferEvent: ResolvedEvent = {
      id: "later-theft",
      definitionId: "later-theft",
      kind: "primary",
      resolutionMode: "standard",

      round: DAY_TWO,

      participantTributeIds: [sourceTribute.id, targetTribute.id],

      text: "A tribute steals a knife.",

      changes: [
        {
          type: "transfer-item",

          itemInstanceId: acquiredKnife.id,

          fromTributeId: sourceTribute.id,

          toTributeId: targetTribute.id,

          reason: "theft",
        },
      ],
    };

    const stateAfterTransfer = applyResolvedEvent(stateWithKnife, transferEvent);

    const transferredKnife = stateAfterTransfer.tributes[1].inventory.find(
      (item) => item.id === acquiredKnife.id,
    );

    expect(transferredKnife).toEqual(acquiredKnife);

    expect(() => assertGameStateInvariants(stateAfterTransfer)).not.toThrow();
  });

  it("rejects forged acquisition provenance in the ledger", () => {
    const game = createGame();

    const { event } = createAcquisitionEvent(
      game,
      "valid-foraging",
      "food",
      "natural-foraging",
      DAY_TWO,
    );

    const validState = applyResolvedEvent(game, event);

    const forgedState: GameState = {
      ...validState,

      itemTransactions: validState.itemTransactions.map((transaction) =>
        transaction.type === "acquired"
          ? {
              ...transaction,

              acquisitionSource: "cornucopia",
            }
          : transaction,
      ),
    };

    expect(() => assertGameStateInvariants(forgedState)).toThrow(/acquired outside Day 1 daytime/i);
  });
});
