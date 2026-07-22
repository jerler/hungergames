import { selectWeightedItem, type RandomSource } from "~/game/engine/random";
import type { GameTribute } from "~/game/types/game-state";
import type { TributeStatValue } from "~/game/types/tribute";

const MIN_CORNUCOPIA_PROPORTION = 0.5;
const MAX_CORNUCOPIA_PROPORTION = 0.9;

/*
 * Averaging two random values creates a central tendency.
 *
 * Beginning the range at 55% rather than 50% keeps the
 * expected result near 75%. The upper tail is clamped to
 * the required 90% maximum.
 */
const CORNUCOPIA_PROPORTION_START = 0.55;
const CORNUCOPIA_PROPORTION_SPREAD = 0.4;

const CORNUCOPIA_BRAINS_MODIFIERS = {
  1: 1.35,
  2: 1.2,
  3: 1,
  4: 0.65,
  5: 0.3,
} satisfies Record<TributeStatValue, number>;

export type BloodbathStrategy = "cornucopia" | "flee";

export interface BloodbathStrategyAssignment {
  tributeId: string;
  strategy: BloodbathStrategy;
}

export interface BloodbathStrategyPlan {
  cornucopiaCount: number;
  assignments: BloodbathStrategyAssignment[];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Determines how many tributes will approach the Cornucopia.
 *
 * The caller supplies the seeded random source so strategy
 * assignment and the later Bloodbath event sequence can
 * consume one deterministic random stream.
 */
export function determineCornucopiaCount(tributeCount: number, random: RandomSource): number {
  if (!Number.isInteger(tributeCount) || tributeCount < 2) {
    throw new Error("Bloodbath strategy assignment requires at least two tributes.");
  }

  const minimumCount = Math.ceil(tributeCount * MIN_CORNUCOPIA_PROPORTION);

  const maximumCount = Math.min(
    tributeCount - 1,
    Math.floor(tributeCount * MAX_CORNUCOPIA_PROPORTION),
  );

  const centeredRandom = (random() + random()) / 2;

  const proportion = clamp(
    CORNUCOPIA_PROPORTION_START + centeredRandom * CORNUCOPIA_PROPORTION_SPREAD,
    MIN_CORNUCOPIA_PROPORTION,
    MAX_CORNUCOPIA_PROPORTION,
  );

  const proposedCount = Math.round(tributeCount * proportion);

  return clamp(proposedCount, minimumCount, maximumCount);
}

/**
 * Calculates a tribute's relative likelihood of approaching
 * the Cornucopia.
 *
 * Brawn has the strongest positive stat effect, Luck has a
 * moderate positive effect, and high Brains strongly reduces
 * the weight. Every possible stat combination retains a
 * positive weight.
 */
export function getCornucopiaWeight(tribute: GameTribute): number {
  const { brains, brawn, luck } = tribute.snapshot.stats;

  return CORNUCOPIA_BRAINS_MODIFIERS[brains] * (0.65 + brawn * 0.15) * (0.8 + luck * 0.08);
}

function selectCornucopiaTributeIds(
  tributes: readonly GameTribute[],
  cornucopiaCount: number,
  random: RandomSource,
): ReadonlySet<string> {
  const remainingTributes = [...tributes];
  const selectedTributeIds = new Set<string>();

  while (selectedTributeIds.size < cornucopiaCount) {
    const selectedTribute = selectWeightedItem(remainingTributes, getCornucopiaWeight, random);

    selectedTributeIds.add(selectedTribute.id);

    const selectedIndex = remainingTributes.indexOf(selectedTribute);

    remainingTributes.splice(selectedIndex, 1);
  }

  return selectedTributeIds;
}

/**
 * Assigns every tribute exactly one Bloodbath strategy.
 *
 * Assignments are returned in the original tribute order,
 * not the weighted selection order.
 */
export function assignBloodbathStrategies(
  tributes: readonly GameTribute[],
  random: RandomSource,
): BloodbathStrategyPlan {
  if (tributes.length < 2) {
    throw new Error("Bloodbath strategy assignment requires at least two tributes.");
  }

  const tributeIds = new Set(tributes.map((tribute) => tribute.id));

  if (tributeIds.size !== tributes.length) {
    throw new Error("Bloodbath strategy assignment received duplicate tribute IDs.");
  }

  const cornucopiaCount = determineCornucopiaCount(tributes.length, random);

  const cornucopiaTributeIds = selectCornucopiaTributeIds(tributes, cornucopiaCount, random);

  return {
    cornucopiaCount,

    assignments: tributes.map((tribute) => ({
      tributeId: tribute.id,

      strategy: cornucopiaTributeIds.has(tribute.id) ? "cornucopia" : "flee",
    })),
  };
}
