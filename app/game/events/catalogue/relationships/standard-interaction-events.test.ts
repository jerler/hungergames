import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import type { RandomSource } from "~/game/engine/random";
import { EVENT_CATALOGUE } from "~/game/events/catalogue/index";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { STANDARD_INTERACTION_EVENTS } from "./standard-interaction-events";
import type {
  EventDefinition,
  EventResolution,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { createTruceInstance } from "~/game/truces/truce-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute, Truce } from "~/game/types/game-state";
import type { ItemAcquisitionSource, ItemDefinitionId } from "~/game/items/item-schema";
import type { TributeStats } from "~/game/types/tribute";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const NIGHT_ONE = {
  day: 1,
  period: "night",
} as const;

const BALANCED_STATS = {
  brains: 3,
  brawn: 3,
  luck: 3,
} satisfies TributeStats;

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

      seed: "truce-conflict-tests",

      now: "2026-07-20T12:00:00.000Z",
    },
  );
}

function withStats(tribute: GameTribute, stats: TributeStats): GameTribute {
  return {
    ...tribute,

    snapshot: {
      ...tribute.snapshot,
      stats,
    },
  };
}

function createSequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;

  const fallback = values[values.length - 1] ?? 0.5;

  return () => {
    const value = values[index] ?? fallback;

    index += 1;
    return value;
  };
}

function requireConflictEvent(eventId: string): EventDefinition {
  const event = STANDARD_INTERACTION_EVENTS.find((candidate) => candidate.id === eventId);

  if (!event) {
    throw new Error(`Missing truce conflict event "${eventId}".`);
  }

  return event;
}

function formTruce(
  game: GameState,
  members: readonly GameTribute[],
  kind: Truce["kind"] = "standard",
): GameState {
  const truce = createTruceInstance(
    `setup-truce-${members.length}`,
    members.map((member) => member.id),
    DAY_ONE,
    kind === "romantic" ? null : NIGHT_ONE,
    kind,
  );

  return applyResolvedEvent(game, {
    id: `setup-truce-event-${members.length}-${kind}`,

    definitionId: "setup-truce",

    resolutionMode: "standard",

    round: DAY_ONE,

    participantTributeIds: truce.tributeIds,

    text: "A test truce forms.",

    changes: [
      {
        type: "form-truce",

        truce,
      },
    ],
  });
}

function acquireItem(
  game: GameState,
  tribute: GameTribute,
  itemId: ItemDefinitionId,
  acquisitionSource: ItemAcquisitionSource,
  index: number,
): GameState {
  const item = createInventoryItemInstance(`setup-item-${index}`, tribute.id, itemId, DAY_ONE);

  return applyResolvedEvent(game, {
    id: `setup-item-event-${index}`,

    definitionId: "setup-item",

    resolutionMode: "standard",

    round: DAY_ONE,

    participantTributeIds: [tribute.id],

    text: "A test item is acquired.",

    changes: [
      {
        type: "acquire-item",

        tributeId: tribute.id,
        acquisitionSource,
        item,
      },
    ],
  });
}

function resolveEvent(
  definition: EventDefinition,
  game: GameState,
  participantsByRole: ParticipantsByRole,
  randomValues: readonly number[],
): EventResolution {
  return definition.resolve({
    state: game,
    round: DAY_ONE,

    livingTributes: game.tributes.filter((tribute) => tribute.isAlive),

    eventId: `resolved:${definition.id}`,

    random: createSequenceRandom(randomValues),

    participantsByRole,
  });
}

function applyResolution(
  game: GameState,
  definition: EventDefinition,
  participantIds: string[],
  resolution: EventResolution,
): GameState {
  return applyResolvedEvent(game, {
    id: `applied:${definition.id}`,

    definitionId: definition.id,

    resolutionMode: "standard",

    round: DAY_ONE,
    participantTributeIds: participantIds,

    ...resolution,
  });
}

describe("truce conflict events", () => {
  it("includes every conflict event in the main catalogue", () => {
    expect(
      STANDARD_INTERACTION_EVENTS.every((event) =>
        EVENT_CATALOGUE.some((candidate) => candidate.id === event.id),
      ),
    ).toBe(true);
  });

  it("selects every member of the same truce for betrayal", () => {
    const game = createGame();

    const members = game.tributes.slice(0, 3);

    const state = formTruce(game, members);

    const definition = requireConflictEvent("truce-betrayal-3");

    const selection = selectEventParticipants(
      definition,
      {
        state,
        round: DAY_ONE,

        livingTributes: state.tributes,
      },

      createSequenceRandom([0, 0, 0]),

      new Set(),
    );

    expect(new Set(selection?.participantTributeIds)).toEqual(
      new Set(members.map((member) => member.id)),
    );
  });

  it("does not allow romantic truces into betrayal events", () => {
    const game = createGame();

    const members = game.tributes.slice(0, 2);

    const state = formTruce(game, members, "romantic");

    const definition = requireConflictEvent("truce-betrayal-2");

    expect(
      definition.isEligible?.({
        state,
        round: DAY_ONE,

        livingTributes: state.tributes,
      }),
    ).toBe(false);
  });

  it("reaches all four betrayal outcomes", () => {
    const game = createGame();

    const betrayer = withStats(game.tributes[0], BALANCED_STATS);

    const partner = withStats(game.tributes[1], BALANCED_STATS);

    const state = formTruce(
      {
        ...game,

        tributes: game.tributes.map((tribute) => {
          if (tribute.id === betrayer.id) {
            return betrayer;
          }

          if (tribute.id === partner.id) {
            return partner;
          }

          return tribute;
        }),
      },
      [betrayer, partner],
    );

    const definition = requireConflictEvent("truce-betrayal-2");

    const texts = [0, 0.2, 0.6, 0.999].map(
      (randomValue) =>
        resolveEvent(
          definition,
          state,
          {
            betrayer: [betrayer],

            partners: [partner],
          },
          [randomValue],
        ).text,
    );

    expect(new Set(texts).size).toBe(4);
  });

  it("successful betrayal steals gear and breaks the truce", () => {
    const originalGame = createGame();

    const betrayer = withStats(originalGame.tributes[0], BALANCED_STATS);

    const partner = withStats(originalGame.tributes[1], BALANCED_STATS);

    let state: GameState = {
      ...originalGame,

      tributes: originalGame.tributes.map((tribute) => {
        if (tribute.id === betrayer.id) {
          return betrayer;
        }

        if (tribute.id === partner.id) {
          return partner;
        }

        return tribute;
      }),
    };

    state = acquireItem(state, partner, "medicine", "cornucopia", 1);

    const itemBefore = state.tributes.find((tribute) => tribute.id === partner.id)?.inventory[0];

    if (!itemBefore) {
      throw new Error("Missing betrayal test item.");
    }

    state = formTruce(state, [betrayer, partner]);

    const definition = requireConflictEvent("truce-betrayal-2");

    const resolution = resolveEvent(
      definition,
      state,
      {
        betrayer: [state.tributes[0]],

        partners: [state.tributes[1]],
      },
      [0.6, 0],
    );

    expect(resolution.changes.some((change) => change.type === "transfer-item")).toBe(true);

    const nextState = applyResolution(state, definition, [betrayer.id, partner.id], resolution);

    const resultingBetrayer = nextState.tributes.find((tribute) => tribute.id === betrayer.id);

    expect(resultingBetrayer?.inventory).toContainEqual(itemBefore);

    expect(nextState.truces).toEqual([]);

    expect(nextState.itemTransactions[nextState.itemTransactions.length - 1]).toMatchObject({
      type: "transferred",

      fromTributeId: partner.id,

      toTributeId: betrayer.id,

      itemInstanceId: itemBefore.id,

      uses: itemBefore.usesRemaining,
    });

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("a critically failed betrayal kills the betrayer without duplicate aftermath", () => {
    const game = createGame();

    const betrayer = game.tributes[0];

    const partner = game.tributes[1];

    const state = formTruce(game, [betrayer, partner]);

    const definition = requireConflictEvent("truce-betrayal-2");

    const resolution = resolveEvent(
      definition,
      state,
      {
        betrayer: [betrayer],

        partners: [partner],
      },
      [0],
    );

    const nextState = applyResolution(state, definition, [betrayer.id, partner.id], resolution);

    expect(nextState.tributes.find((tribute) => tribute.id === betrayer.id)?.isAlive).toBe(false);

    expect(nextState.truces).toEqual([]);

    expect(
      nextState.eventHistory.filter((event) => event.definitionId === "truce-ended-by-death"),
    ).toHaveLength(0);
  });

  it("exceptional betrayal steals all partner inventory and kills the defender", () => {
    const originalGame = createGame();

    const betrayer = originalGame.tributes[0];

    const partner = originalGame.tributes[1];

    let state = acquireItem(originalGame, partner, "food", "natural-foraging", 1);

    state = acquireItem(state, partner, "water", "natural-foraging", 2);

    state = formTruce(state, [betrayer, partner]);

    const partnerBefore = state.tributes.find((tribute) => tribute.id === partner.id);

    const originalItems = partnerBefore?.inventory ?? [];

    const definition = requireConflictEvent("truce-betrayal-2");

    const resolution = resolveEvent(
      definition,
      state,
      {
        betrayer: [state.tributes[0]],

        partners: [state.tributes[1]],
      },
      [0.999],
    );

    const nextState = applyResolution(state, definition, [betrayer.id, partner.id], resolution);

    const resultingBetrayer = nextState.tributes.find((tribute) => tribute.id === betrayer.id);

    const resultingPartner = nextState.tributes.find((tribute) => tribute.id === partner.id);

    expect(resultingBetrayer?.inventory).toEqual(expect.arrayContaining(originalItems));

    expect(resultingPartner?.inventory).toEqual([]);
    const originalItemIds = new Set(originalItems.map((item) => item.id));

    const originalItemTransfers = nextState.itemTransactions.filter(
      (transaction) =>
        transaction.type === "transferred" && originalItemIds.has(transaction.itemInstanceId),
    );

    expect(originalItemTransfers).toHaveLength(originalItems.length);

    for (const item of originalItems) {
      expect(
        originalItemTransfers.filter((transaction) => transaction.itemInstanceId === item.id),
      ).toHaveLength(1);
    }

    /*
     * In this two-person betrayal, the only
     * partner is also the killed defender.
     * Their inventory must therefore move
     * exclusively through death loot.
     */
    expect(
      originalItemTransfers.every((transaction) => transaction.sourceId === "death-loot"),
    ).toBe(true);

    expect(resultingPartner?.isAlive).toBe(false);

    expect(resultingBetrayer?.statistics.kills).toBe(1);

    expect(nextState.truces).toEqual([]);

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("selects a protection target from the protector's own truce", () => {
    const game = createGame();

    const protector = game.tributes[0];

    const partner = game.tributes[1];

    const outsider = game.tributes[2];

    const state = formTruce(game, [protector, partner]);

    const definition = requireConflictEvent("protects-truce-partner");

    const selection = selectEventParticipants(
      definition,
      {
        state,
        round: DAY_ONE,

        livingTributes: [protector, partner, outsider],
      },

      createSequenceRandom([0, 0.999]),

      new Set(),
    );

    expect(selection?.participantTributeIds).toEqual([protector.id, partner.id]);
  });

  it("a fatal protection attempt triggers accidental dissolution", () => {
    const game = createGame();

    const protector = withStats(game.tributes[0], BALANCED_STATS);

    const partner = withStats(game.tributes[1], BALANCED_STATS);

    const state = formTruce(
      {
        ...game,

        tributes: game.tributes.map((tribute) => {
          if (tribute.id === protector.id) {
            return protector;
          }

          if (tribute.id === partner.id) {
            return partner;
          }

          return tribute;
        }),
      },
      [protector, partner],
    );

    const definition = requireConflictEvent("protects-truce-partner");

    const resolution = resolveEvent(
      definition,
      state,
      {
        protector: [protector],

        partner: [partner],
      },
      [0],
    );

    const nextState = applyResolution(state, definition, [protector.id, partner.id], resolution);

    expect(nextState.tributes.find((tribute) => tribute.id === protector.id)?.isAlive).toBe(false);

    expect(nextState.truces).toEqual([]);

    expect(
      nextState.eventHistory.some((event) => event.definitionId === "truce-ended-by-death"),
    ).toBe(true);
  });

  it("successful protection leaves the truce active", () => {
    const game = createGame();

    const protector = withStats(game.tributes[0], BALANCED_STATS);

    const partner = withStats(game.tributes[1], BALANCED_STATS);

    const state = formTruce(
      {
        ...game,

        tributes: game.tributes.map((tribute) => {
          if (tribute.id === protector.id) {
            return protector;
          }

          if (tribute.id === partner.id) {
            return partner;
          }

          return tribute;
        }),
      },
      [protector, partner],
    );

    const definition = requireConflictEvent("protects-truce-partner");

    const resolution = resolveEvent(
      definition,
      state,
      {
        protector: [protector],

        partner: [partner],
      },
      [0.6],
    );

    const nextState = applyResolution(state, definition, [protector.id, partner.id], resolution);

    expect(nextState.truces).toHaveLength(1);

    expect(nextState.tributes.find((tribute) => tribute.id === protector.id)?.isAlive).toBe(true);

    expect(nextState.tributes.find((tribute) => tribute.id === partner.id)?.isAlive).toBe(true);
  });

  it("resolves identically with the same random sequence", () => {
    const game = createGame();

    const members = game.tributes.slice(0, 2);

    const state = formTruce(game, members);

    const definition = requireConflictEvent("truce-betrayal-2");

    const resolve = () =>
      resolveEvent(
        definition,
        state,
        {
          betrayer: [members[0]],

          partners: [members[1]],
        },
        [0.6, 0.4],
      );

    expect(resolve()).toEqual(resolve());
  });
});
