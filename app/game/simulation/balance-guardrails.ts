import type { BalanceMetrics } from "./balance-metrics";

const INFORMATIONAL_EVENT_FAMILY_IDS = new Set<string>(["ordinary:standard-dissolution"]);

export interface BalanceGuardrailResult {
  id: string;
  label: string;

  passed: boolean;

  actual: string;
  expected: string;
}

function createResult(
  id: string,
  label: string,
  passed: boolean,
  actual: string,
  expected: string,
): BalanceGuardrailResult {
  return {
    id,
    label,
    passed,
    actual,
    expected,
  };
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function evaluateBalanceGuardrails(metrics: BalanceMetrics): BalanceGuardrailResult[] {
  const halfGame = metrics.gameSizes["half-game"];

  const fullGame = metrics.gameSizes["full-game"];

  const results: BalanceGuardrailResult[] = [
    createResult(
      "half-completion",

      "Half Games complete",

      halfGame.completionRate === 1,

      formatRate(halfGame.completionRate),

      "100%",
    ),

    createResult(
      "full-completion",

      "Full Games complete",

      fullGame.completionRate === 1,

      formatRate(fullGame.completionRate),

      "100%",
    ),

    createResult(
      "half-game-length",

      "Half Game average length",

      halfGame.rounds.average > 1 && halfGame.rounds.average < 50,

      halfGame.rounds.average.toFixed(2),

      "greater than 1 and less than 50 rounds",
    ),

    createResult(
      "full-game-length",

      "Full Game average length",

      fullGame.rounds.average > 1 && fullGame.rounds.average < 50,

      fullGame.rounds.average.toFixed(2),

      "greater than 1 and less than 50 rounds",
    ),

    createResult(
      "day-one-eliminations",

      "Day 1 elimination share",

      metrics.eliminations.dayOneShare > 0.5 && metrics.eliminations.dayOneShare <= 1,

      formatRate(metrics.eliminations.dayOneShare),

      "greater than 50% and no more than 100%",
    ),

    createResult(
      "direct-combat-outcomes",

      "Direct combat exercises success and failure",

      metrics.combat.directSuccesses > 0 && metrics.combat.directFailures > 0,

      `${metrics.combat.directSuccesses} successes / ${metrics.combat.directFailures} failures`,

      "at least one of each",
    ),

    createResult(
      "tactical-offense",

      "Tactical offense is exercised",

      metrics.combat.tacticalAttempts > 0,

      String(metrics.combat.tacticalAttempts),

      "at least one attempt",
    ),

    // createResult(
    //   "low-brawn-tactical-offense",

    //   "Low-Brawn tributes use tactical offense",

    //   metrics.combat
    //     .lowBrawnTacticalAttempts >
    //     0,

    //   String(
    //     metrics.combat
    //       .lowBrawnTacticalAttempts,
    //   ),

    //   "at least one attempt",
    // ),

    createResult(
      "item-acquisition",

      "Items are acquired",

      metrics.inventory.totalAcquisitions > 0,

      String(metrics.inventory.totalAcquisitions),

      "at least one acquisition",
    ),

    createResult(
      "item-consumption",

      "Limited-use items are consumed",

      metrics.inventory.totalConsumedUses > 0,

      String(metrics.inventory.totalConsumedUses),

      "at least one consumed use",
    ),

    createResult(
      "theft-transfers",

      "Theft transfers occur",

      (metrics.inventory.transferSources.theft ?? 0) > 0,

      String(metrics.inventory.transferSources.theft ?? 0),

      "at least one transfer",
    ),

    createResult(
      "death-loot-transfers",

      "Death-loot transfers occur",

      (metrics.inventory.transferSources["death-loot"] ?? 0) > 0,

      String(metrics.inventory.transferSources["death-loot"] ?? 0),

      "at least one transfer",
    ),

    createResult(
      "unsupported-sponsors",

      "Unsupported sponsor acquisitions remain absent",

      (metrics.inventory.acquisitionSources.sponsor ?? 0) === 0,

      String(metrics.inventory.acquisitionSources.sponsor ?? 0),

      "0",
    ),

    createResult(
      "status-applications",

      "Status mechanics are exercised",

      metrics.statuses.totalApplications > 0,

      String(metrics.statuses.totalApplications),

      "at least one application",
    ),

    createResult(
      "event-driven-night-rest",

      "Event-driven night rest is exercised",

      metrics.preparation.restQuality.sheltered + metrics.preparation.restQuality.unsheltered > 0,

      String(
        metrics.preparation.restQuality.sheltered + metrics.preparation.restQuality.unsheltered,
      ),

      "at least one recorded rest outcome",
    ),
  ];

  for (const family of metrics.eventFamilies) {
    if (INFORMATIONAL_EVENT_FAMILY_IDS.has(family.id)) {
      continue;
    }

    results.push(
      createResult(
        `family:${family.id}`,

        `Event family: ${family.label}`,

        family.eventCount > 0,

        String(family.eventCount),

        "at least one event",
      ),
    );
  }

  return results;
}
