import { describe, expect, it } from "vitest";

import { applyGameChange, applyResolvedEvent } from "~/game/engine/apply-game-change";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type {
  GameChange,
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";

import { CORNUCOPIA_PROVISIONS_ITEM_ID, hasDeprivationProtection } from "./deprivation-protection";
import { getItemDefinition } from "./item-catalogue";
import { isItemDefinitionUsableBy } from "./item-usability";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const satisfies RoundReference;

const DAY_TWO = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

function createGame(): GameState {
  let nextId = 0;

  return createInitialGameState(
    {
      ...createDefaultGameConfig(),
      districtCount: 6,
    },
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
    "random",
    {
      createId: () => {
        nextId += 1;
        return `provisions-test-${nextId}`;
      },
      seed: "cornucopia-provisions-test",
      now: "2026-07-26T12:00:00.000Z",
    },
  );
}

function replaceTribute(state: GameState, tribute: GameTribute): GameState {
  return {
    ...state,
    tributes: state.tributes.map((candidate) =>
      candidate.id === tribute.id ? tribute : candidate,
    ),
  };
}

function createEvent(
  id: string,
  round: RoundReference,
  participantTributeIds: readonly string[],
  changes: readonly GameChange[],
): ResolvedEvent {
  return {
    id,
    definitionId: id,
    kind: "primary",
    resolutionMode: "standard",
    round,
    participantTributeIds: [...participantTributeIds],
    text: "Test event.",
    changes: [...changes],
  };
}

describe("Cornucopia provisions", () => {
  it("is a universally usable passive protection item", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    if (!tribute) {
      throw new Error("Missing test tribute.");
    }

    expect(getItemDefinition(CORNUCOPIA_PROVISIONS_ITEM_ID)).toMatchObject({
      origin: "manufactured",
      tags: ["provisions"],
      deprivationProtection: ["food", "water"],
    });

    expect(isItemDefinitionUsableBy(tribute, CORNUCOPIA_PROVISIONS_ITEM_ID)).toBe(true);
  });

  it("clears deprivation and resets both clocks when acquired", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    if (!tribute) {
      throw new Error("Missing test tribute.");
    }

    const preparedTribute = {
      ...tribute,
      statuses: [
        createStatusEffectInstance("existing-hunger", tribute.id, "hungry", 1, DAY_ONE),
        createStatusEffectInstance("existing-thirst", tribute.id, "thirsty", 1, DAY_ONE),
      ],
    };

    const event = createEvent(
      "cornucopia-provisions-award",
      DAY_ONE,
      [tribute.id],
      [
        {
          type: "acquire-item",
          tributeId: tribute.id,
          acquisitionSource: "cornucopia",
          item: createInventoryItemInstance(
            "cornucopia-provisions-award",
            tribute.id,
            CORNUCOPIA_PROVISIONS_ITEM_ID,
            DAY_ONE,
          ),
        },
      ],
    );

    const activeState: GameState = {
      ...replaceTribute(game, preparedTribute),
      phase: "round-events",
      currentRound: DAY_ONE,
    };

    const nextState = applyResolvedEvent(activeState, event);
    const nextTribute = nextState.tributes.find((candidate) => candidate.id === tribute.id);

    expect(nextTribute).toBeDefined();
    expect(nextTribute?.statuses.map((status) => status.definitionId)).not.toEqual(
      expect.arrayContaining(["hungry", "thirsty"]),
    );
    expect(nextTribute?.survival.lastFoundFoodRound).toEqual(DAY_ONE);
    expect(nextTribute?.survival.lastFoundWaterRound).toEqual(DAY_ONE);
    expect(nextTribute && hasDeprivationProtection(nextTribute, "food")).toBe(true);
  });

  it("moves protection through theft-style transfers", () => {
    const game = createGame();
    const owner = game.tributes[0];
    const thief = game.tributes[1];

    if (!owner || !thief) {
      throw new Error("Missing transfer test tributes.");
    }

    const item = createInventoryItemInstance(
      "original-cornucopia-award",
      owner.id,
      CORNUCOPIA_PROVISIONS_ITEM_ID,
      DAY_ONE,
    );

    const preparedOwner = {
      ...owner,
      inventory: [item],
      survival: {
        ...owner.survival,
        lastFoundFoodRound: DAY_ONE,
        lastFoundWaterRound: DAY_ONE,
      },
    };
    const preparedThief = {
      ...thief,
      statuses: [
        createStatusEffectInstance("thief-hunger", thief.id, "hungry", 1, DAY_ONE),
        createStatusEffectInstance("thief-thirst", thief.id, "thirsty", 1, DAY_ONE),
      ],
    };

    let preparedState = replaceTribute(game, preparedOwner);
    preparedState = replaceTribute(preparedState, preparedThief);
    preparedState = {
      ...preparedState,
      phase: "round-events",
      currentRound: DAY_TWO,
    };

    const nextState = applyResolvedEvent(
      preparedState,
      createEvent(
        "provisions-theft",
        DAY_TWO,
        [owner.id, thief.id],
        [
          {
            type: "transfer-item",
            itemInstanceId: item.id,
            fromTributeId: owner.id,
            toTributeId: thief.id,
            reason: "theft",
          },
        ],
      ),
    );

    const nextOwner = nextState.tributes.find((tribute) => tribute.id === owner.id);
    const nextThief = nextState.tributes.find((tribute) => tribute.id === thief.id);

    expect(nextOwner?.inventory).toEqual([]);
    expect(nextOwner?.statuses).toEqual([]);
    expect(nextThief?.inventory.map((ownedItem) => ownedItem.id)).toContain(item.id);
    expect(nextThief?.statuses.map((status) => status.definitionId)).not.toEqual(
      expect.arrayContaining(["hungry", "thirsty"]),
    );
    expect(nextThief?.survival.lastFoundFoodRound).toEqual(DAY_TWO);
    expect(nextThief?.survival.lastFoundWaterRound).toEqual(DAY_TWO);
  });

  it("blocks deprivation statuses while protection is owned", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    if (!tribute) {
      throw new Error("Missing test tribute.");
    }

    const protectedTribute = {
      ...tribute,
      inventory: [
        createInventoryItemInstance(
          "protected-status-test",
          tribute.id,
          CORNUCOPIA_PROVISIONS_ITEM_ID,
          DAY_ONE,
        ),
      ],
    };
    const protectedState = replaceTribute(game, protectedTribute);
    const hungryStatus = createStatusEffectInstance(
      "blocked-hunger",
      tribute.id,
      "hungry",
      1,
      DAY_TWO,
    );
    const event = createEvent("blocked-hunger-event", DAY_TWO, [tribute.id], []);

    expect(() =>
      applyGameChange(
        protectedState,
        {
          type: "apply-status",
          tributeId: tribute.id,
          status: hungryStatus,
        },
        event,
      ),
    ).toThrow(/cannot receive "hungry".*provisions/i);

    const invalidState = replaceTribute(protectedState, {
      ...protectedTribute,
      statuses: [hungryStatus],
    });

    expect(() => assertGameStateInvariants(invalidState)).toThrow(
      /cannot have "hungry".*protected/i,
    );
  });
});
