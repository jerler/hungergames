import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { createSeededRandom, selectWeightedItem } from "~/game/engine/random";
import { STANDARD_FORMATION_EVENTS } from "~/game/events/catalogue/relationships/standard-formation-events";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
import { getTruceFormationPopulationMultiplier } from "~/game/truces/truce-engine";
import {
  getAverageDistrictAffinityWeight,
  TRUCE_GROUP_SIZE_WEIGHTS,
} from "~/game/truces/truce-selection";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";

const SAMPLE_COUNT = 100_000;

function createGame(seed = "truce-balance-tests"): GameState {
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

function requireTribute(game: GameState, district: number, districtPosition: 1 | 2): GameTribute {
  const tribute = game.tributes.find(
    (candidate) =>
      candidate.district === district && candidate.districtPosition === districtPosition,
  );

  if (!tribute) {
    throw new Error(`Missing District ${district}, position ${districtPosition}.`);
  }

  return tribute;
}

function withLivingTributeCount(game: GameState, livingCount: number): GameState {
  return {
    ...game,

    tributes: game.tributes.map((tribute, index) => ({
      ...tribute,
      isAlive: index < livingCount,
    })),
  };
}

function sampleFormationRate(multiplier: number, seed: string): number {
  const random = createSeededRandom(seed);

  const options = ["formation", "other"] as const;

  let formationCount = 0;

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const selected = selectWeightedItem(
      options,

      (option) => (option === "formation" ? multiplier : 1),

      random,
    );

    if (selected === "formation") {
      formationCount += 1;
    }
  }

  return formationCount / SAMPLE_COUNT;
}

describe("truce balance", () => {
  it("produces the intended group-size distribution", () => {
    const random = createSeededRandom("truce-size-distribution");

    const counts = new Map<number, number>();

    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const selected = selectWeightedItem(
        TRUCE_GROUP_SIZE_WEIGHTS,

        (option) => option.weight,

        random,
      );

      counts.set(
        selected.size,

        (counts.get(selected.size) ?? 0) + 1,
      );
    }

    const totalWeight = TRUCE_GROUP_SIZE_WEIGHTS.reduce(
      (total, option) => total + option.weight,
      0,
    );

    for (const option of TRUCE_GROUP_SIZE_WEIGHTS) {
      const observedRate = (counts.get(option.size) ?? 0) / SAMPLE_COUNT;

      const expectedRate = option.weight / totalWeight;

      expect(Math.abs(observedRate - expectedRate)).toBeLessThan(0.01);
    }

    expect(counts.get(2) ?? 0).toBeGreaterThan(counts.get(3) ?? 0);

    expect(counts.get(3) ?? 0).toBeGreaterThan(counts.get(4) ?? 0);

    expect(counts.get(4) ?? 0).toBeGreaterThan(counts.get(5) ?? 0);

    expect(counts.get(5) ?? 0).toBeGreaterThan(counts.get(6) ?? 0);
  });

  it("selects nearby districts more often than distant districts", () => {
    const game = createGame("district-affinity");

    const anchor = requireTribute(game, 6, 1);

    /*
     * One candidate at each distance:
     *
     * 0 — same district
     * 1 — adjacent district
     * 2–5 — increasingly distant
     */
    const candidates = [
      requireTribute(game, 6, 2),

      requireTribute(game, 7, 1),

      requireTribute(game, 8, 1),

      requireTribute(game, 9, 1),

      requireTribute(game, 10, 1),

      requireTribute(game, 11, 1),
    ];

    const affinityWeights = candidates.map((candidate) =>
      getAverageDistrictAffinityWeight(candidate, [anchor]),
    );

    expect(affinityWeights).toEqual([3, 2, 1.35, 0.9, 0.6, 0.3]);

    const random = createSeededRandom("district-distance-distribution");

    const counts = new Map<number, number>();

    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const selected = selectWeightedItem(
        candidates,

        (candidate) => getAverageDistrictAffinityWeight(candidate, [anchor]),

        random,
      );

      const distance = Math.abs(selected.district - anchor.district);

      counts.set(
        distance,

        (counts.get(distance) ?? 0) + 1,
      );
    }

    expect(counts.get(0) ?? 0).toBeGreaterThan(counts.get(1) ?? 0);

    expect(counts.get(1) ?? 0).toBeGreaterThan(counts.get(2) ?? 0);

    expect(counts.get(2) ?? 0).toBeGreaterThan(counts.get(3) ?? 0);

    expect(counts.get(3) ?? 0).toBeGreaterThan(counts.get(4) ?? 0);

    expect(counts.get(4) ?? 0).toBeGreaterThan(counts.get(5) ?? 0);
  });

  it("makes new truce formation progressively rarer as the population falls", () => {
    const game = createGame("population-balance");

    const populations = [24, 16, 8, 4, 3] as const;

    const multipliers = populations.map((livingCount) =>
      getTruceFormationPopulationMultiplier(withLivingTributeCount(game, livingCount)),
    );

    expect(multipliers).toEqual([1, 0.65, 0.25, 0.05, 0]);

    const observedRates = multipliers.map((multiplier, index) =>
      sampleFormationRate(multiplier, `formation-population-${populations[index]}`),
    );

    expect(observedRates[0]).toBeGreaterThan(observedRates[1]);

    expect(observedRates[1]).toBeGreaterThan(observedRates[2]);

    expect(observedRates[2]).toBeGreaterThan(observedRates[3]);

    expect(observedRates[3]).toBeGreaterThan(observedRates[4]);

    expect(observedRates[4]).toBe(0);

    for (let index = 0; index < multipliers.length; index += 1) {
      const multiplier = multipliers[index];

      const expectedRate = multiplier / (multiplier + 1);

      expect(Math.abs(observedRates[index] - expectedRate)).toBeLessThan(0.01);
    }
  });

  it("applies the population multiplier to every playable truce formation event", () => {
    const game = createGame("formation-event-weighting");

    const populationCases = [
      {
        livingCount: 24,
        multiplier: 1,
      },
      {
        livingCount: 16,
        multiplier: 0.65,
      },
      {
        livingCount: 8,
        multiplier: 0.25,
      },
      {
        livingCount: 4,
        multiplier: 0.05,
      },
      {
        livingCount: 3,
        multiplier: 0,
      },
    ] as const;

    for (const { livingCount, multiplier } of populationCases) {
      const state = withLivingTributeCount(game, livingCount);

      const context = {
        state,

        round: {
          day: 1,
          period: "day",
        } as const,

        livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
      };

      expect(getTruceFormationPopulationMultiplier(state)).toBe(multiplier);

      for (const definition of STANDARD_FORMATION_EVENTS) {
        expect(getEventDefinitionWeight(definition, context)).toBeCloseTo(
          definition.baseWeight * multiplier,
          10,
        );
      }
    }
  });
});
