import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { createSeededRandom } from "~/game/engine/random";
import { resolveRound } from "~/game/engine/resolve-round";
import { createRoundSeed } from "~/game/engine/rounds";
import {
  CORNUCOPIA_NONFATAL_TRIO_EVENTS,
  CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
  CORNUCOPIA_NONFATAL_PAIR_EVENTS,
  CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS,
  CORNUCOPIA_ACQUISITION_EVENTS,
  CORNUCOPIA_EVENTS,
  CORNUCOPIA_GROUP_CONFLICT_EVENTS,
  CORNUCOPIA_PAIR_CONFLICT_EVENTS,
  FLEE_EVENTS,
  BLOODBATH_EVENT_CATALOGUE,
} from "~/game/events/catalogue/bloodbath";
import { getEventParticipantShape } from "~/game/events/event-participant-shape";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { DistrictCount } from "~/game/types/game-config";
import type { ResolvedEvent, GameState } from "~/game/types/game-state";
import { gameReducer } from "~/state/game-reducer";

import { sequenceBloodbathEvents } from "./bloodbath-sequencer";
import { assignBloodbathStrategies } from "./bloodbath-strategy";
import { getCommittedItemInstanceIds } from "~/game/items/item-reservations";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const NIGHT_ONE = {
  day: 1,
  period: "night",
} as const;

function createTestGame(seed = "bloodbath-sequencer", districtCount: DistrictCount = 6): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount,
  };

  let nextId = 0;

  return createInitialGameState(
    config,

    createRandomTributeDrafts(
      districtCount,
      DEFAULT_TRIBUTES,
      createSeededRandom(`${seed}:reaping`),
    ),

    "random",

    {
      createId: () => {
        nextId += 1;
        return `${seed}-id-${nextId}`;
      },

      seed,
      now: "2026-07-21T12:00:00.000Z",
    },
  );
}

function countEventEliminations(events: readonly ResolvedEvent[]): number {
  return events.reduce(
    (total, event) =>
      total + event.changes.filter((change) => change.type === "eliminate-tribute").length,

    0,
  );
}

function requireGameState(state: GameState | null): GameState {
  if (!state) {
    throw new Error("Expected the game reducer to return a game.");
  }

  return state;
}

describe("Bloodbath sequencer", () => {
  it.each([
    {
      label: "Half Games",
      districtCount: 6 as const,
      minimumAverage: 5,
      maximumAverage: 6.5,
    },
    {
      label: "Full Games",
      districtCount: 12 as const,
      minimumAverage: 10,
      maximumAverage: 12.5,
    },
  ])(
    "produces the intended average fatality range in $label",
    ({ districtCount, minimumAverage, maximumAverage }) => {
      const deathCounts: number[] = [];

      for (let index = 0; index < 500; index += 1) {
        const game = createTestGame(`bloodbath-balance-${districtCount}-${index}`, districtCount);

        deathCounts.push(countEventEliminations(sequenceBloodbathEvents(game, DAY_ONE)));
      }

      const average = deathCounts.reduce((total, count) => total + count, 0) / deathCounts.length;

      expect(average).toBeGreaterThanOrEqual(minimumAverage);

      expect(average).toBeLessThanOrEqual(maximumAverage);

      /*
       * Confirm that the target remains soft rather than
       * generating the same fixed total in every game.
       *
       * The precise size of the spread is an implementation detail;
       * the contract is that more than one fatality total occurs.
       */
      expect(new Set(deathCounts).size).toBeGreaterThanOrEqual(2);
    },
    30_000,
  );

  it("produces identical events for identical seeds", () => {
    const game = createTestGame("deterministic-bloodbath");

    expect(sequenceBloodbathEvents(game, DAY_ONE)).toEqual(sequenceBloodbathEvents(game, DAY_ONE));
  });

  it.each([6 as const, 12 as const])(
    "never repeats an event definition within one Bloodbath for %s districts",
    (districtCount) => {
      for (let index = 0; index < 250; index += 1) {
        const game = createTestGame(`unique-bloodbath-${districtCount}-${index}`, districtCount);

        const definitionIds = sequenceBloodbathEvents(game, DAY_ONE).map(
          (event) => event.definitionId,
        );

        expect(
          new Set(definitionIds).size,
          `Repeated definition for seed "${game.seed}": ${definitionIds.join(", ")}`,
        ).toBe(definitionIds.length);
      }
    },
    30_000,
  );

  /*
   * Pair and group conflicts compete inside the unified fatal pool.
   * Their meaningful contracts are covered by:
   *
   * - definition uniqueness;
   * - fatality balance;
   * - participant coverage;
   * - pair/group conflict-family reachability.
   */

  it("keeps pair and group conflict families reachable under definition uniqueness", () => {
    const pairConflictIds = new Set(CORNUCOPIA_PAIR_CONFLICT_EVENTS.map((event) => event.id));
    const groupConflictIds = new Set(CORNUCOPIA_GROUP_CONFLICT_EVENTS.map((event) => event.id));

    let sawPairConflict = false;
    let sawGroupConflict = false;

    for (let index = 0; index < 500 && (!sawPairConflict || !sawGroupConflict); index += 1) {
      const game = createTestGame(`conflict-family-reachability-${index}`, 12);

      const definitionIds = sequenceBloodbathEvents(game, DAY_ONE).map(
        (event) => event.definitionId,
      );

      sawPairConflict ||= definitionIds.some((definitionId) => pairConflictIds.has(definitionId));
      sawGroupConflict ||= definitionIds.some((definitionId) => groupConflictIds.has(definitionId));
    }

    expect(sawPairConflict).toBe(true);
    expect(sawGroupConflict).toBe(true);
  });

  it("keeps every nonfatal Cornucopia participant shape reachable", () => {
    const weaponAcquisitionDefinitions = [
      ...CORNUCOPIA_ACQUISITION_EVENTS,
      ...CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS,
    ].filter((definition) => (definition.tags as readonly string[]).includes("weapon"));
    const shapeByDefinitionId = new Map(
      [
        ...CORNUCOPIA_NONFATAL_PAIR_EVENTS,
        ...CORNUCOPIA_NONFATAL_TRIO_EVENTS,
        ...CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
        ...weaponAcquisitionDefinitions,
      ].map((definition) => [definition.id, getEventParticipantShape(definition)]),
    );
    const observedShapes = new Set<string>();

    for (let index = 0; index < 500 && observedShapes.size < 4; index += 1) {
      const game = createTestGame(`post-target-shape-reachability-${index}`, 12);

      for (const event of sequenceBloodbathEvents(game, DAY_ONE)) {
        const shape = shapeByDefinitionId.get(event.definitionId);

        if (shape) {
          observedShapes.add(shape);
        }
      }
    }

    expect(observedShapes).toEqual(new Set(["solo", "pair", "trio", "group-four-plus"]));
  }, 30_000);

  it("represents every starting tribute exactly once", () => {
    const game = createTestGame();

    const events = sequenceBloodbathEvents(game, DAY_ONE);

    const participantIds = events.flatMap((event) => event.participantTributeIds);

    expect(participantIds).toHaveLength(game.tributes.length);

    expect(new Set(participantIds).size).toBe(game.tributes.length);

    expect(new Set(participantIds)).toEqual(new Set(game.tributes.map((tribute) => tribute.id)));
  });

  it("uses event families matching each strategy", () => {
    const game = createTestGame("strategy-event-families");

    const strategyPlan = assignBloodbathStrategies(
      game.tributes,

      createSeededRandom(createRoundSeed(game.seed, DAY_ONE)),
    );

    const strategyByTributeId = new Map(
      strategyPlan.assignments.map(({ tributeId, strategy }) => [tributeId, strategy] as const),
    );

    const cornucopiaEventIds = new Set(CORNUCOPIA_EVENTS.map((event) => event.id));

    const fleeEventIds = new Set(FLEE_EVENTS.map((event) => event.id));

    const events = sequenceBloodbathEvents(game, DAY_ONE);

    for (const event of events) {
      for (const tributeId of event.participantTributeIds) {
        const strategy = strategyByTributeId.get(tributeId);

        if (strategy === "cornucopia") {
          expect(cornucopiaEventIds.has(event.definitionId)).toBe(true);
          expect(event.feedGroup).toBe("bloodbath-cornucopia");
        } else {
          expect(fleeEventIds.has(event.definitionId)).toBe(true);
          expect(event.feedGroup).toBe("bloodbath-flee");
        }
      }
    }
  });

  it("places Cornucopia events before fleeing events", () => {
    const game = createTestGame("grouped-bloodbath-feed");

    const events = sequenceBloodbathEvents(game, DAY_ONE);

    const firstFleeEventIndex = events.findIndex((event) => event.feedGroup === "bloodbath-flee");

    expect(firstFleeEventIndex).toBeGreaterThan(0);

    expect(
      events
        .slice(0, firstFleeEventIndex)
        .every((event) => event.feedGroup === "bloodbath-cornucopia"),
    ).toBe(true);

    expect(
      events.slice(firstFleeEventIndex).every((event) => event.feedGroup === "bloodbath-flee"),
    ).toBe(true);
  });

  it("allows a paired flee event to consume two fleeing tributes", () => {
    let pairedEvent: ResolvedEvent | undefined;

    for (let index = 0; index < 500 && !pairedEvent; index += 1) {
      const game = createTestGame(`paired-flee-${index}`);
      pairedEvent = sequenceBloodbathEvents(game, DAY_ONE).find(
        (event) => event.definitionId === "bloodbath-flee-break-away-crowd",
      );
    }

    expect(pairedEvent).toBeDefined();
    expect(pairedEvent?.feedGroup).toBe("bloodbath-flee");
    expect(pairedEvent?.participantTributeIds).toHaveLength(2);
    expect(new Set(pairedEvent?.participantTributeIds ?? []).size).toBe(2);
  });

  it("does not commit an item instance twice", () => {
    const game = createTestGame("item-reservations");

    const events = sequenceBloodbathEvents(game, DAY_ONE);

    const itemInstanceIds = events.flatMap((event) => getCommittedItemInstanceIds(event.changes));

    expect(new Set(itemInstanceIds).size).toBe(itemInstanceIds.length);
  });

  it("produces a state satisfying all invariants", () => {
    const game = createTestGame("bloodbath-invariants");

    const events = sequenceBloodbathEvents(game, DAY_ONE);

    let nextState: GameState = {
      ...game,

      phase: "round-events",
      currentRound: DAY_ONE,
      roundEvents: events,
      revealedEventCount: 0,
    };

    for (const [eventIndex, event] of events.entries()) {
      nextState = applyResolvedEvent(nextState, event);

      nextState = {
        ...nextState,
        revealedEventCount: eventIndex + 1,
      };
    }

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("routes Day 1 daytime through the Bloodbath", () => {
    const game = createTestGame("day-one-routing");

    const bloodbathDefinitionIds = new Set(BLOODBATH_EVENT_CATALOGUE.map((event) => event.id));

    const events = resolveRound(game, DAY_ONE);

    expect(events.every((event) => bloodbathDefinitionIds.has(event.definitionId))).toBe(true);

    expect(events.flatMap((event) => event.participantTributeIds)).toHaveLength(
      game.tributes.length,
    );
  });

  it("returns to ordinary sequencing on Night 1", () => {
    const game = createTestGame("night-one-routing");

    const bloodbathDefinitionIds = new Set(BLOODBATH_EVENT_CATALOGUE.map((event) => event.id));

    const events = resolveRound(game, NIGHT_ONE);

    expect(events.every((event) => !bloodbathDefinitionIds.has(event.definitionId))).toBe(true);
  });

  it("preserves round completion and advancement", () => {
    const game = createTestGame("round-flow");

    const dayState = requireGameState(
      gameReducer(game, {
        type: "round/began",
        now: "2026-07-21T12:01:00.000Z",
      }),
    );

    expect(dayState.currentRound).toEqual(DAY_ONE);

    const completedDayState = requireGameState(
      gameReducer(dayState, {
        type: "round/revealed",
        now: "2026-07-21T12:02:00.000Z",
      }),
    );

    expect(completedDayState.phase).toBe("round-complete");

    const nightState = requireGameState(
      gameReducer(completedDayState, {
        type: "round/began",
        now: "2026-07-21T12:03:00.000Z",
      }),
    );

    expect(nightState.currentRound).toEqual(NIGHT_ONE);

    const bloodbathDefinitionIds = new Set(BLOODBATH_EVENT_CATALOGUE.map((event) => event.id));

    expect(
      nightState.roundEvents.every((event) => !bloodbathDefinitionIds.has(event.definitionId)),
    ).toBe(true);
  });
});
