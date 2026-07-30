import {
  EVENT_DISTRIBUTION_GAME_SIZE_IDS,
  EVENT_DISTRIBUTION_POOL_IDS,
  EVENT_PARTICIPANT_SHAPES,
  type EventDistributionEventMetric,
  type EventDistributionMetrics,
  type EventDistributionPoolMetric,
  type EventParticipantShape,
} from "./event-distribution-metrics";

const SHAPE_LABELS = {
  solo: "Solo",
  pair: "Pair",
  trio: "Trio",
  "group-four-plus": "Four-plus",
} as const satisfies Record<EventParticipantShape, string>;

function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function formatRate(value: number): string {
  return `${formatNumber(value * 100, 1)}%`;
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|");
}

function formatDefinitionIdList(definitionIds: readonly string[]): string[] {
  if (definitionIds.length === 0) {
    return ["- None"];
  }

  return definitionIds.map((definitionId) => `- \`${definitionId}\``);
}

function formatEventRow(event: EventDistributionEventMetric): string {
  return [
    `\`${escapeTableCell(event.definitionId)}\``,
    escapeTableCell(event.familyLabels.join(", ")),
    event.selections,
    event.gamesWithEvent,
    formatRate(event.appearanceRate),
    formatRate(event.selectionShare),
    formatNumber(event.averageSelectionsPerGame),
    event.fatalSelections,
    event.eliminations,
    event.participantShapes.solo,
    event.participantShapes.pair,
    event.participantShapes.trio,
    event.participantShapes["group-four-plus"],
  ].join(" | ");
}

function createPoolSection(pool: EventDistributionPoolMetric): string[] {
  const overlap = pool.consecutiveGameOverlap;

  return [
    `### ${pool.label}`,
    "",
    `- Total selections: ${pool.totalSelections}`,
    `- Average selections per game: ${formatNumber(pool.averageSelectionsPerGame)}`,
    `- Non-solo share: ${formatRate(pool.nonSoloShare)}`,
    `- Consecutive-game overlap: average ${formatNumber(
      overlap.average,
    )}, median ${formatNumber(overlap.median)}, P90 ${formatNumber(
      overlap.percentile90,
    )}, maximum ${formatNumber(overlap.maximum)} across ${overlap.comparisons} comparisons`,
    `- Top five event share: ${formatRate(pool.concentration.topFiveSelectionShare)}`,
    `- Top ten event share: ${formatRate(pool.concentration.topTenSelectionShare)}`,
    "",
    "#### Participant shape",
    "",
    "| Shape | Selections | Share |",
    "| --- | ---: | ---: |",
    ...EVENT_PARTICIPANT_SHAPES.map((shape) => {
      const metric = pool.participantShapes[shape];

      return `| ${SHAPE_LABELS[shape]} | ${metric.selections} | ${formatRate(metric.share)} |`;
    }),
    "",
    "#### Catalogue family",
    "",
    "| Family | Selections | Games containing | Appearance | Pool share |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...(pool.families.length > 0
      ? pool.families.map(
          (family) =>
            `| ${escapeTableCell(family.label)} | ${family.selections} | ${family.gamesWithEvent} | ${formatRate(
              family.appearanceRate,
            )} | ${formatRate(family.selectionShare)} |`,
        )
      : ["| _No selections_ | 0 | 0 | 0.0% | 0.0% |"]),
    "",
    "#### Event definitions",
    "",
    "| Event | Family | Selections | Games containing | Appearance | Pool share | Avg/game | Fatal selections | Eliminations | Solo | Pair | Trio | Four-plus |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...(pool.events.length > 0
      ? pool.events.map((event) => `| ${formatEventRow(event)} |`)
      : ["| _No selections_ | — | 0 | 0 | 0.0% | 0.0% | 0.00 | 0 | 0 | 0 | 0 | 0 | 0 |"]),
    "",
    "#### High-frequency definitions",
    "",
    "Appearing in at least 75% of games:",
    "",
    ...formatDefinitionIdList(pool.concentration.appearsInAtLeast75PercentOfGames),
    "",
    "Appearing in at least 50% of games:",
    "",
    ...formatDefinitionIdList(pool.concentration.appearsInAtLeast50PercentOfGames),
    "",
    "Appearing in at least 25% of games:",
    "",
    ...formatDefinitionIdList(pool.concentration.appearsInAtLeast25PercentOfGames),
    "",
    "#### Never selected",
    "",
    ...formatDefinitionIdList(pool.neverSelectedEventIds),
    "",
  ];
}

export function createEventDistributionReport(metrics: EventDistributionMetrics): string {
  const lines = [
    "# Event Distribution Baseline",
    "",
    "This deterministic report measures primary authored event selections. Preparation, aftermath, and status-resolution history entries are excluded so they do not distort catalogue repetition.",
    "",
    "## Sample",
    "",
    `- Total games: ${metrics.sample.totalGames}`,
    `- Half Games: ${metrics.sample.halfGames}`,
    `- Full Games: ${metrics.sample.fullGames}`,
    `- Excluded non-primary history entries: ${metrics.excludedHistoryEntries.nonPrimary}`,
    `- Unclassified Day 1 primary entries: ${metrics.excludedHistoryEntries.unclassifiedPrimary}`,
    "",
  ];

  if (metrics.excludedHistoryEntries.unclassifiedPrimaryDefinitionIds.length > 0) {
    lines.push(
      "Unclassified Day 1 definitions:",
      "",
      ...formatDefinitionIdList(metrics.excludedHistoryEntries.unclassifiedPrimaryDefinitionIds),
      "",
    );
  }

  lines.push(
    "## Interpretation notes",
    "",
    "- Appearance is the percentage of games containing a definition at least once.",
    "- Pool share is the percentage of all selections in the same game-size and period pool.",
    "- Consecutive-game overlap counts distinct definition IDs shared by adjacent seeded simulations.",
    "- Never-selected lists are based on catalogue membership and declared periods; they do not prove that every definition was eligible in the sampled games.",
    "",
  );

  for (const gameSizeId of EVENT_DISTRIBUTION_GAME_SIZE_IDS) {
    const gameSize = metrics.gameSizes[gameSizeId];

    lines.push(`## ${gameSize.label}`, "", `Games: ${gameSize.games}`, "");

    for (const poolId of EVENT_DISTRIBUTION_POOL_IDS) {
      lines.push(...createPoolSection(gameSize.pools[poolId]));
    }
  }

  return `${lines.join("\n").trim()}\n`;
}
