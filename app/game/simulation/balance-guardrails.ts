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

      "Remaining limited-use items are consumed",

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

      metrics.preparation.restQuality.comfortable +
        metrics.preparation.restQuality.sheltered +
        metrics.preparation.restQuality.unsheltered >
        0,

      String(
        metrics.preparation.restQuality.comfortable +
          metrics.preparation.restQuality.sheltered +
          metrics.preparation.restQuality.unsheltered,
      ),

      "at least one recorded rest outcome",
    ),

    createResult(
      "night-rest-quality-coverage",

      "All night-rest qualities are exercised",

      metrics.preparation.restQuality.comfortable > 0 &&
        metrics.preparation.restQuality.sheltered > 0 &&
        metrics.preparation.restQuality.unsheltered > 0,

      `${metrics.preparation.restQuality.comfortable} comfortable / ` +
        `${metrics.preparation.restQuality.sheltered} sheltered / ` +
        `${metrics.preparation.restQuality.unsheltered} unsheltered`,

      "at least one of each",
    ),

    createResult(
      "morning-rest-resolution",

      "Morning rest resolution is exercised",

      metrics.preparation.byMechanic["morning-rest-resolution"] > 0,

      String(metrics.preparation.byMechanic["morning-rest-resolution"]),

      "at least one resolution",
    ),

    createResult(
      "morning-rest-consequences",

      "Both morning rest consequences are exercised",

      (metrics.statuses.applicationsByStatus.exhausted ?? 0) > 0 &&
        (metrics.statuses.applicationsByStatus["well-rested"] ?? 0) > 0,

      `${metrics.statuses.applicationsByStatus.exhausted ?? 0} exhausted / ` +
        `${metrics.statuses.applicationsByStatus["well-rested"] ?? 0} well-rested`,

      "at least one of each",
    ),

    createResult(
      "night-rest-balance",

      "Protected and unsheltered rest both remain meaningful",

      (() => {
        const protectedRest =
          metrics.preparation.restQuality.comfortable + metrics.preparation.restQuality.sheltered;

        const totalRest = protectedRest + metrics.preparation.restQuality.unsheltered;

        const protectedRate = totalRest === 0 ? 0 : protectedRest / totalRest;

        return protectedRate >= 0.1 && protectedRate <= 0.95;
      })(),

      (() => {
        const protectedRest =
          metrics.preparation.restQuality.comfortable + metrics.preparation.restQuality.sheltered;

        const totalRest = protectedRest + metrics.preparation.restQuality.unsheltered;

        return formatRate(totalRest === 0 ? 0 : protectedRest / totalRest);
      })(),

      "protected rest between 10% and 95%",
    ),
    createResult(
      "deprivation-events-occur",

      "Hunger and thirst occur sometimes",
      metrics.survival.hungryApplications > 0 && metrics.survival.thirstyApplications > 0,
      `${metrics.survival.hungryApplications} hungry / ` +
        `${metrics.survival.thirstyApplications} thirsty`,
      "at least one application of each across the deterministic batch",
    ),

    createResult(
      "deprivation-never-premature",

      "Deprivation statuses never occur before eligibility",
      metrics.survival.prematureHungerApplications === 0 &&
        metrics.survival.prematureThirstApplications === 0,
      `${metrics.survival.prematureHungerApplications} premature hungry / ` +
        `${metrics.survival.prematureThirstApplications} premature thirsty`,
      "0 premature applications",
    ),

    createResult(
      "deprivation-remains-optional",

      "Eligibility does not guarantee a deprivation event",
      metrics.survival.hungryApplications < metrics.survival.hungerEligibilityOpportunities &&
        metrics.survival.thirstyApplications < metrics.survival.thirstEligibilityOpportunities,
      `${metrics.survival.hungryApplications}/` +
        `${metrics.survival.hungerEligibilityOpportunities} hunger; ` +
        `${metrics.survival.thirstyApplications}/` +
        `${metrics.survival.thirstEligibilityOpportunities} thirst`,
      "applications lower than tribute-round eligibility opportunities",
    ),

    createResult(
      "deprivation-balance",

      "Hunger and thirst do not dominate later play",
      metrics.survival.deprivationPrimaryEventRate > 0 &&
        metrics.survival.deprivationPrimaryEventRate <= 0.2,
      formatRate(metrics.survival.deprivationPrimaryEventRate),
      "greater than 0% and no more than 20% of primary events",
    ),

    createResult(
      "deprivation-resolutions",

      "Hunger and thirst can both be resolved",
      metrics.survival.hungerResolutions > 0 && metrics.survival.thirstResolutions > 0,
      `${metrics.survival.hungerResolutions} hunger / ` +
        `${metrics.survival.thirstResolutions} thirst`,
      "at least one resolution of each",
    ),

    createResult(
      "resource-theft-outcomes",

      "Authored resource theft exercises attempts and successes",
      metrics.survival.foodTheftAttempts > 0 &&
        metrics.survival.foodTheftSuccesses > 0 &&
        metrics.survival.waterTheftAttempts > 0 &&
        metrics.survival.waterTheftSuccesses > 0,
      `${metrics.survival.foodTheftSuccesses}/` +
        `${metrics.survival.foodTheftAttempts} food; ` +
        `${metrics.survival.waterTheftSuccesses}/` +
        `${metrics.survival.waterTheftAttempts} water`,
      "at least one attempt and success for each need",
    ),

    createResult(
      "legacy-resource-inventory",

      "Legacy food and water inventory remains absent",
      metrics.survival.legacyFoodWaterAcquisitions === 0,
      String(metrics.survival.legacyFoodWaterAcquisitions),
      "0 acquisitions",
    ),

    createResult(
      "automatic-deprivation-fatalities",

      "No automatic starvation or dehydration deaths occur",
      metrics.survival.automaticDeprivationFatalities === 0,
      String(metrics.survival.automaticDeprivationFatalities),
      "0 fatalities",
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
