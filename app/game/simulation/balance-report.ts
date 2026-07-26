import { getItemDefinition } from "~/game/items/item-catalogue";

import { getStatusDefinition } from "~/game/statuses/status-catalogue";

import type { BalanceGuardrailResult } from "./balance-guardrails";

import type { BalanceMetrics, StatValueBalanceMetric } from "./balance-metrics";

function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function formatRate(value: number): string {
  return `${formatNumber(value * 100, 1)}%`;
}

function formatRecordRows(
  counts: Record<string, number>,
  formatLabel: (id: string) => string = (id) => id,
): string[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(
      ([firstId, firstCount], [secondId, secondCount]) =>
        secondCount - firstCount || firstId.localeCompare(secondId),
    )
    .map(([id, count]) => `| ${formatLabel(id)} | ${count} |`);
}

function formatStatRows(values: readonly StatValueBalanceMetric[]): string[] {
  return values.map(
    ({ value, appearances, victories, victoryRate }) =>
      `| ${value} | ${appearances} | ${victories} | ${formatRate(victoryRate)} |`,
  );
}

export function createBalanceReport(
  metrics: BalanceMetrics,
  guardrails: readonly BalanceGuardrailResult[],
): string {
  const failedGuardrails = guardrails.filter((guardrail) => !guardrail.passed);

  const halfGame = metrics.gameSizes["half-game"];

  const fullGame = metrics.gameSizes["full-game"];

  const mostAcquiredItems = formatRecordRows(
    metrics.inventory.acquisitionsByItem,

    (itemId) => getItemDefinition(itemId as Parameters<typeof getItemDefinition>[0]).label,
  ).slice(0, 15);

  const mostConsumedItems = formatRecordRows(
    metrics.inventory.consumedUsesByItem,

    (itemId) => getItemDefinition(itemId as Parameters<typeof getItemDefinition>[0]).label,
  ).slice(0, 15);

  const statusApplicationRows = formatRecordRows(
    metrics.statuses.applicationsByStatus,

    (statusId) => getStatusDefinition(statusId as Parameters<typeof getStatusDefinition>[0]).label,
  );

  const statusFatalityRows = formatRecordRows(
    metrics.statuses.fatalitiesByStatus,

    (statusId) => getStatusDefinition(statusId as Parameters<typeof getStatusDefinition>[0]).label,
  );

  return [
    "# Status and Inventory Balance Report",

    "",

    "This report is generated from deterministic complete-game simulations. It is a diagnostic baseline rather than a claim that the game is perfectly balanced.",

    "",

    "## Sample",

    "",

    `- Total games: ${metrics.sample.totalGames}`,
    `- Half Games: ${metrics.sample.halfGames}`,
    `- Full Games: ${metrics.sample.fullGames}`,

    "",

    "## Guardrails",

    "",

    `Overall result: **${failedGuardrails.length === 0 ? "PASS" : "FAIL"}**`,

    "",

    "| Check | Result | Actual | Expected |",
    "| --- | --- | ---: | --- |",

    ...guardrails.map(
      (guardrail) =>
        `| ${guardrail.label} | ${
          guardrail.passed ? "PASS" : "FAIL"
        } | ${guardrail.actual} | ${guardrail.expected} |`,
    ),

    "",

    "## Game length",

    "",

    "| Size | Games | Completion | Average | Median | P90 | Minimum | Maximum | Avg. primary events | Avg. eliminations |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",

    `| Half Game | ${halfGame.games} | ${formatRate(halfGame.completionRate)} | ${formatNumber(
      halfGame.rounds.average,
    )} | ${formatNumber(halfGame.rounds.median)} | ${formatNumber(
      halfGame.rounds.percentile90,
    )} | ${halfGame.rounds.minimum} | ${halfGame.rounds.maximum} | ${formatNumber(
      halfGame.averagePrimaryEvents,
    )} | ${formatNumber(halfGame.averageEliminations)} |`,

    `| Full Game | ${fullGame.games} | ${formatRate(fullGame.completionRate)} | ${formatNumber(
      fullGame.rounds.average,
    )} | ${formatNumber(fullGame.rounds.median)} | ${formatNumber(
      fullGame.rounds.percentile90,
    )} | ${fullGame.rounds.minimum} | ${fullGame.rounds.maximum} | ${formatNumber(
      fullGame.averagePrimaryEvents,
    )} | ${formatNumber(fullGame.averageEliminations)} |`,

    "",

    "## Victory and eliminations",

    "",

    `- Sole victories: ${metrics.victories.sole} (${formatRate(metrics.victories.soleRate)})`,

    `- Joint victories: ${metrics.victories.joint} (${formatRate(metrics.victories.jointRate)})`,

    `- Total eliminations: ${metrics.eliminations.total}`,

    `- Day 1 eliminations: ${metrics.eliminations.dayOne} (${formatRate(
      metrics.eliminations.dayOneShare,
    )})`,

    "",

    "| Elimination source | Count |",
    "| --- | ---: |",

    ...formatRecordRows(metrics.eliminations.bySource),

    "",

    "## Combat",

    "",

    `- Direct attacks: ${metrics.combat.directAttempts}`,
    `- Direct successes: ${metrics.combat.directSuccesses}`,
    `- Direct failures: ${metrics.combat.directFailures}`,
    `- Direct success rate: ${formatRate(metrics.combat.directSuccessRate)}`,
    `- Tactical attempts: ${metrics.combat.tacticalAttempts}`,
    `- Tactical connections: ${metrics.combat.tacticalConnections}`,
    `- Tactical connection rate: ${formatRate(metrics.combat.tacticalConnectionRate)}`,
    `- Low-Brawn tactical attempts: ${metrics.combat.lowBrawnTacticalAttempts}`,
    `- Delayed attributed fatalities: ${metrics.combat.delayedAttributedFatalities}`,
    `- Safety resolutions: ${metrics.combat.safetyResolutions}`,

    "",

    "## Preparation",

    "",

    `- Total preparation events: ${metrics.preparation.totalEvents}`,
    `- Borrowed-item preparation events: ${metrics.preparation.borrowedItemEvents}`,

    "",

    "| Mechanic | Events |",
    "| --- | ---: |",

    ...formatRecordRows(metrics.preparation.byMechanic),

    "",

    "### Rest quality",

    "",

    (() => {
      const totalRest =
        metrics.preparation.restQuality.comfortable +
        metrics.preparation.restQuality.sheltered +
        metrics.preparation.restQuality.unsheltered;

      return `- Total recorded outcomes: ${totalRest}`;
    })(),

    (() => {
      const totalRest =
        metrics.preparation.restQuality.comfortable +
        metrics.preparation.restQuality.sheltered +
        metrics.preparation.restQuality.unsheltered;

      return (
        `- Comfortable: ${metrics.preparation.restQuality.comfortable} ` +
        `(${formatRate(
          totalRest === 0 ? 0 : metrics.preparation.restQuality.comfortable / totalRest,
        )})`
      );
    })(),

    (() => {
      const totalRest =
        metrics.preparation.restQuality.comfortable +
        metrics.preparation.restQuality.sheltered +
        metrics.preparation.restQuality.unsheltered;

      return (
        `- Sheltered: ${metrics.preparation.restQuality.sheltered} ` +
        `(${formatRate(
          totalRest === 0 ? 0 : metrics.preparation.restQuality.sheltered / totalRest,
        )})`
      );
    })(),

    (() => {
      const totalRest =
        metrics.preparation.restQuality.comfortable +
        metrics.preparation.restQuality.sheltered +
        metrics.preparation.restQuality.unsheltered;

      return (
        `- Unsheltered: ${metrics.preparation.restQuality.unsheltered} ` +
        `(${formatRate(
          totalRest === 0 ? 0 : metrics.preparation.restQuality.unsheltered / totalRest,
        )})`
      );
    })(),

    "",

    "### Camouflage",

    "",

    `- Successful: ${metrics.preparation.camouflage.successful}`,
    `- Unsuccessful: ${metrics.preparation.camouflage.unsuccessful}`,
    `- Harmful failures: ${metrics.preparation.camouflage.harmfulFailure}`,

    "",

    "## Statuses",

    "",

    `- Total applications: ${metrics.statuses.totalApplications}`,

    "",

    "### Applications",

    "",

    "| Status | Applications |",
    "| --- | ---: |",

    ...statusApplicationRows,

    "",

    "### Status fatalities",

    "",

    "| Status | Fatalities |",
    "| --- | ---: |",

    ...(statusFatalityRows.length > 0 ? statusFatalityRows : ["| None | 0 |"]),

    "",

    "## Inventory",

    "",

    `- Total acquisitions: ${metrics.inventory.totalAcquisitions}`,
    `- Average acquisitions per game: ${formatNumber(
      metrics.inventory.averageAcquisitionsPerGame,
    )}`,
    `- Total consumed uses: ${metrics.inventory.totalConsumedUses}`,
    `- Average consumed uses per game: ${formatNumber(
      metrics.inventory.averageConsumedUsesPerGame,
    )}`,
    `- Total transfers: ${metrics.inventory.totalTransfers}`,
    `- Average transfers per game: ${formatNumber(metrics.inventory.averageTransfersPerGame)}`,
    `- Distinct item definitions acquired: ${metrics.inventory.distinctItemsAcquired}`,
    `- Never acquired: ${metrics.inventory.neverAcquiredItemIds.join(", ") || "None"}`,

    "",

    "### Acquisition sources",

    "",

    "| Source | Acquisitions |",
    "| --- | ---: |",

    ...formatRecordRows(metrics.inventory.acquisitionSources),

    "",

    "### Transfer sources",

    "",

    "| Source | Transfers |",
    "| --- | ---: |",

    ...formatRecordRows(metrics.inventory.transferSources),

    "",

    "### Most acquired items",

    "",

    "| Item | Acquisitions |",
    "| --- | ---: |",

    ...mostAcquiredItems,

    "",

    "### Most consumed items",

    "",

    "| Item | Uses consumed |",
    "| --- | ---: |",

    ...(mostConsumedItems.length > 0 ? mostConsumedItems : ["| None | 0 |"]),

    "",

    "## Event-family coverage",

    "",

    "| Family | Events | Games represented | Events per game |",
    "| --- | ---: | ---: | ---: |",

    ...metrics.eventFamilies.map(
      (family) =>
        `| ${family.label} | ${family.eventCount} | ${family.gamesWithEvent} | ${formatNumber(
          family.eventsPerGame,
        )} |`,
    ),

    "",

    "## Victor stat balance",

    "",

    `- Average victor Brains: ${formatNumber(metrics.victorStats.average.brains)}`,
    `- Average victor Brawn: ${formatNumber(metrics.victorStats.average.brawn)}`,
    `- Average victor Luck: ${formatNumber(metrics.victorStats.average.luck)}`,

    "",

    "### Brains",

    "",

    "| Value | Appearances | Victories | Victory rate |",
    "| ---: | ---: | ---: | ---: |",

    ...formatStatRows(metrics.victorStats.byValue.brains),

    "",

    "### Brawn",

    "",

    "| Value | Appearances | Victories | Victory rate |",
    "| ---: | ---: | ---: | ---: |",

    ...formatStatRows(metrics.victorStats.byValue.brawn),

    "",

    "### Luck",

    "",

    "| Value | Appearances | Victories | Victory rate |",
    "| ---: | ---: | ---: | ---: |",

    ...formatStatRows(metrics.victorStats.byValue.luck),

    "",
  ].join("\n");
}
