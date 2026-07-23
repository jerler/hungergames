import { selectWeightedItem, type RandomSource } from "~/game/engine/random";
import type { TributeStats, TributeStatValue } from "~/game/types/tribute";

export const EVENT_STATS = [
  "brains",
  "brawn",
  "luck",
] as const satisfies readonly (keyof TributeStats)[];

export type EventStat = (typeof EVENT_STATS)[number];

export type StatCheckDifficulty = TributeStatValue;

export type StatCheckOutcome = "critical-failure" | "failure" | "success" | "exceptional-success";

interface ResolveStatCheckOptions {
  stats: TributeStats;
  stat: EventStat;
  difficulty: StatCheckDifficulty;
  random: RandomSource;
}

const STAT_CHECK_OUTCOMES = [
  "critical-failure",
  "failure",
  "success",
  "exceptional-success",
] satisfies readonly StatCheckOutcome[];

export function isStatAtLeast(
  stats: TributeStats,
  stat: EventStat,
  minimum: TributeStatValue,
): boolean {
  return stats[stat] >= minimum;
}

export function isStatAtMost(
  stats: TributeStats,
  stat: EventStat,
  maximum: TributeStatValue,
): boolean {
  return stats[stat] <= maximum;
}

export function isSuccessfulStatCheckOutcome(outcome: StatCheckOutcome): boolean {
  return outcome === "success" || outcome === "exceptional-success";
}

/**
 * Returns the relative likelihood of an outcome.
 *
 * Advantage is calculated as:
 *
 *   selected stat - difficulty
 *
 * An evenly matched check has the following distribution:
 *
 *   Critical failure:     10%
 *   Failure:              40%
 *   Success:              40%
 *   Exceptional success:  10%
 *
 * Higher stats shift weight toward better outcomes, while
 * lower stats shift weight toward worse outcomes. Every
 * outcome retains some chance of occurring.
 */
function getOutcomeWeight(outcome: StatCheckOutcome, advantage: number): number {
  switch (outcome) {
    case "critical-failure":
      return Math.max(0.5, 1 - advantage * 0.5);

    case "failure":
      return Math.max(1, 4 - advantage);

    case "success":
      return Math.max(1, 4 + advantage);

    case "exceptional-success":
      return Math.max(0.5, 1 + advantage * 0.5);
  }
}

export function resolveStatCheck({
  stats,
  stat,
  difficulty,
  random,
}: ResolveStatCheckOptions): StatCheckOutcome {
  const statValue = stats[stat];
  const advantage = statValue - difficulty;

  return selectWeightedItem(
    STAT_CHECK_OUTCOMES,
    (outcome) => getOutcomeWeight(outcome, advantage),
    random,
  );
}
