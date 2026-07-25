import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";

import {
  assertGameStateInvariants,
  assertNeedResolutionEventInvariants,
} from "~/game/engine/game-invariants";

import { createInventoryItemInstance } from "~/game/items/inventory-engine";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import { createStatusEffectInstance } from "~/game/statuses/status-engine";

import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";

import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";

import { createDefaultGameConfig } from "~/game/types/game-config";

import type { GameState, GameTribute, ResolvedEvent } from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
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
        return `invariant-id-${nextId}`;
      },

      seed: "game-invariant-tests",
      now: "2026-07-25T12:00:00.000Z",
    },
  );
}

function updateTribute(
  state: GameState,
  tributeId: string,
  update: (tribute: GameTribute) => GameTribute,
): GameState {
  return {
    ...state,

    tributes: state.tributes.map((tribute) =>
      tribute.id === tributeId ? update(tribute) : tribute,
    ),
  };
}

function acquireItem(state: GameState, definitionId: ItemDefinitionId) {
  const tribute = state.tributes[0];

  if (!tribute) {
    throw new Error("Invariant test game has no tribute.");
  }

  const eventId = `invariant-acquisition-${definitionId}`;

  const item = createInventoryItemInstance(eventId, tribute.id, definitionId, DAY_ONE);

  const event: ResolvedEvent = {
    id: eventId,
    definitionId: eventId,

    kind: "primary",
    resolutionMode: "standard",

    round: DAY_ONE,
    participantTributeIds: [tribute.id],

    text: `${tribute.snapshot.name} receives an item.`,

    changes: [
      {
        type: "acquire-item",
        tributeId: tribute.id,
        acquisitionSource: "cornucopia",
        item,
      },
    ],
  };

  return {
    state: applyResolvedEvent(state, event),

    tributeId: tribute.id,
    item,
  };
}

describe("game-state invariants", () => {
  it("accepts a valid initial state", () => {
    expect(() => assertGameStateInvariants(createGame())).not.toThrow();
  });

  it("rejects conflicting hunger statuses", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    if (!tribute) {
      throw new Error("Invariant test tribute is missing.");
    }

    const invalidState = updateTribute(state, tribute.id, (candidate) => ({
      ...candidate,

      survival: {
        ...candidate.survival,
        roundsWithoutFood: 4,
      },

      statuses: [
        createStatusEffectInstance("well-fed-conflict", candidate.id, "well-fed", 1, DAY_ONE),

        createStatusEffectInstance("hungry-conflict", candidate.id, "hungry", 1, DAY_ONE),
      ],
    }));

    expect(() => assertGameStateInvariants(invalidState)).toThrow(
      /cannot have both.*well-fed.*hungry/i,
    );
  });

  it("allows alert and well-rested to coexist", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    if (!tribute) {
      throw new Error("Invariant test tribute is missing.");
    }

    const validState = updateTribute(state, tribute.id, (candidate) => ({
      ...candidate,

      statuses: [
        createStatusEffectInstance("alert-compatible", candidate.id, "alert", 1, DAY_ONE),

        createStatusEffectInstance("rest-compatible", candidate.id, "well-rested", 1, DAY_ONE),
      ],
    }));

    expect(() => assertGameStateInvariants(validState)).not.toThrow();
  });

  it("rejects negative survival-need counters", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    if (!tribute) {
      throw new Error("Invariant test tribute is missing.");
    }

    const invalidState = updateTribute(state, tribute.id, (candidate) => ({
      ...candidate,

      survival: {
        ...candidate.survival,
        roundsWithoutWater: -1,
      },
    }));

    expect(() => assertGameStateInvariants(invalidState)).toThrow(
      /rounds without water must be a non-negative integer/i,
    );
  });

  it("rejects multiple active stages for one need", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    if (!tribute) {
      throw new Error("Invariant test tribute is missing.");
    }

    const invalidState = updateTribute(state, tribute.id, (candidate) => ({
      ...candidate,

      survival: {
        ...candidate.survival,
        roundsWithoutWater: 2,
      },

      statuses: [
        createStatusEffectInstance("thirst-stage", candidate.id, "thirsty", 1, DAY_ONE),

        createStatusEffectInstance("dehydration-stage", candidate.id, "dehydrated", 1, DAY_ONE),
      ],
    }));

    expect(() => assertGameStateInvariants(invalidState)).toThrow(
      /exactly one active water stage/i,
    );
  });

  it("rejects a need status that disagrees with its counter", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    if (!tribute) {
      throw new Error("Invariant test tribute is missing.");
    }

    const invalidState = updateTribute(state, tribute.id, (candidate) => ({
      ...candidate,

      survival: {
        ...candidate.survival,
        roundsWithoutWater: 4,
      },

      statuses: [
        createStatusEffectInstance("incorrect-thirst-stage", candidate.id, "thirsty", 1, DAY_ONE),
      ],
    }));

    expect(() => assertGameStateInvariants(invalidState)).toThrow(
      /counter 4 requires "dehydrated"/i,
    );
  });

  it("requires persistent statuses to have null duration", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    if (!tribute) {
      throw new Error("Invariant test tribute is missing.");
    }

    const thirstyStatus = {
      ...createStatusEffectInstance("persistent-duration", tribute.id, "thirsty", 1, DAY_ONE),

      remainingRounds: 2,
    };

    const invalidState = updateTribute(state, tribute.id, (candidate) => ({
      ...candidate,

      survival: {
        ...candidate.survival,
        roundsWithoutWater: 2,
      },

      statuses: [thirstyStatus],
    }));

    expect(() => assertGameStateInvariants(invalidState)).toThrow(
      /persistent status.*must have null duration/i,
    );
  });

  it("requires timed statuses to have positive duration", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    if (!tribute) {
      throw new Error("Invariant test tribute is missing.");
    }

    const injuredStatus = {
      ...createStatusEffectInstance("invalid-timed-duration", tribute.id, "injured", 1, DAY_ONE),

      remainingRounds: 0,
    };

    const invalidState = updateTribute(state, tribute.id, (candidate) => ({
      ...candidate,
      statuses: [injuredStatus],
    }));

    expect(() => assertGameStateInvariants(invalidState)).toThrow(
      /timed status.*has invalid duration/i,
    );
  });

  it("rejects item uses above the catalogue maximum", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    if (!tribute) {
      throw new Error("Invariant test tribute is missing.");
    }

    const medKit = {
      ...createInventoryItemInstance("invalid-med-kit", tribute.id, "med-kit", DAY_ONE),

      usesRemaining: 4,
    };

    const invalidState = updateTribute(state, tribute.id, (candidate) => ({
      ...candidate,
      inventory: [medKit],
    }));

    expect(() => assertGameStateInvariants(invalidState)).toThrow(
      /limited-use item.*has invalid remaining uses/i,
    );
  });

  it("rejects inventory without acquisition history", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    if (!tribute) {
      throw new Error("Invariant test tribute is missing.");
    }

    const knife = createInventoryItemInstance("unrecorded-item", tribute.id, "knife", DAY_ONE);

    const invalidState = updateTribute(state, tribute.id, (candidate) => ({
      ...candidate,
      inventory: [knife],
    }));

    expect(() => assertGameStateInvariants(invalidState)).toThrow(
      /present in inventory without an acquisition transaction/i,
    );
  });

  it("rejects ledger items that disappear without consumption", () => {
    const { state, tributeId, item } = acquireItem(createGame(), "knife");

    const invalidState = updateTribute(state, tributeId, (tribute) => ({
      ...tribute,

      inventory: tribute.inventory.filter((candidate) => candidate.id !== item.id),
    }));

    expect(() => assertGameStateInvariants(invalidState)).toThrow(
      /remaining uses but no current inventory owner/i,
    );
  });

  it("rejects cross-event item commitments", () => {
    const { state, tributeId, item } = acquireItem(createGame(), "camouflage-net");

    const preparationEvent: ResolvedEvent = {
      id: "reservation-preparation",
      definitionId: "reservation-preparation",

      kind: "preparation",
      resolutionMode: "standard",

      round: DAY_ONE,

      participantTributeIds: [tributeId],

      text: "A tribute prepares camouflage.",

      changes: [
        {
          type: "use-item",
          tributeId,
          itemInstanceId: item.id,
          reason: "reservation-preparation",
        },
      ],

      preparation: {
        mechanic: "camouflage-preparation",

        actingTributeId: tributeId,

        itemInstanceId: item.id,

        itemDefinitionId: item.definitionId,

        itemOwnerTributeId: tributeId,

        usesRemainingAfter: null,
      },
    };

    const primaryEvent: ResolvedEvent = {
      id: "reservation-primary",
      definitionId: "reservation-primary",

      kind: "primary",
      resolutionMode: "standard",

      round: DAY_ONE,

      participantTributeIds: [tributeId],

      text: "The same tribute uses the item again.",

      changes: [
        {
          type: "use-item",
          tributeId,
          itemInstanceId: item.id,
          reason: "reservation-primary",
        },
      ],
    };

    const invalidState: GameState = {
      ...state,

      phase: "round-events",
      currentRound: DAY_ONE,

      roundEvents: [preparationEvent, primaryEvent],

      revealedEventCount: 0,
    };

    expect(() => assertGameStateInvariants(invalidState)).toThrow(/committed by both/i);
  });

  it("rejects killer attribution on need deaths", () => {
    const event: ResolvedEvent = {
      id: "invalid-need-death",
      definitionId: "need-fatality:dehydration",

      kind: "need-resolution",
      resolutionMode: "standard",

      round: DAY_ONE,

      participantTributeIds: ["victim"],

      text: "The victim dies of dehydration.",

      changes: [
        {
          type: "eliminate-tribute",

          tributeId: "victim",

          causeId: "survival-need:water",

          causeLabel: "Dehydration",

          summary: "The victim dies of dehydration.",

          killerTributeIds: ["killer"],
        },
      ],
    };

    expect(() => assertNeedResolutionEventInvariants(event)).toThrow(/cannot have a killer/i);
  });

  it("requires death records to match elimination history", () => {
    const state = createGame();
    const victim = state.tributes[0];
    const killer = state.tributes[1];

    if (!victim || !killer) {
      throw new Error("Invariant test tributes are missing.");
    }

    const event: ResolvedEvent = {
      id: "recorded-elimination",
      definitionId: "recorded-elimination",

      kind: "primary",
      resolutionMode: "standard",

      round: DAY_ONE,

      participantTributeIds: [victim.id, killer.id],

      text: `${killer.snapshot.name} eliminates ${victim.snapshot.name}.`,

      changes: [
        {
          type: "eliminate-tribute",

          tributeId: victim.id,

          causeId: "test-elimination",

          causeLabel: "Eliminated",

          summary: `${victim.snapshot.name} was eliminated.`,

          killerTributeIds: [killer.id],
        },
      ],
    };

    const stateAfterDeath = applyResolvedEvent(state, event);

    const invalidState = updateTribute(stateAfterDeath, victim.id, (tribute) => {
      if (!tribute.death) {
        throw new Error("Test victim has no death record.");
      }

      return {
        ...tribute,

        death: {
          ...tribute.death,
          causeLabel: "Incorrect cause",
        },
      };
    });

    expect(() => assertGameStateInvariants(invalidState)).toThrow(/cause label.*disagrees/i);
  });
});
