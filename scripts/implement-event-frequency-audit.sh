#!/usr/bin/env bash
set -euo pipefail

TARGET_SCRIPT="scripts/generate-event-frequency-report.ts"
PACKAGE_JSON="package.json"
VALIDATION_SCRIPT="scripts/validate-phase-7.sh"

if [[ ! -f "$PACKAGE_JSON" || ! -d "scripts" ]]; then
  echo "Run this script from the hungergames repository root." >&2
  exit 1
fi

cat > "$TARGET_SCRIPT" <<'EVENT_FREQUENCY_TYPESCRIPT'
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  EVENT_DISTRIBUTION_GAME_SIZE_IDS,
  EVENT_DISTRIBUTION_POOL_IDS,
  collectEventDistributionMetrics,
  type EventDistributionGameSizeId,
  type EventDistributionMetrics,
  type EventDistributionPoolId,
} from "~/game/simulation/event-distribution-metrics";
import {
  EVENT_SELECTION_REJECTION_REASONS,
  type EventSelectionRejectionReason,
} from "~/game/simulation/event-selection-diagnostics";
import {
  simulateGameBatch,
  type SimulationBatchDefinition,
  type SimulationRun,
} from "~/game/simulation/simulation-runner";
import { ITEM_CATALOGUE } from "~/game/items/item-catalogue";
import { STATUS_CATALOGUE } from "~/game/statuses/status-catalogue";
import type { GameChange, ResolvedEvent } from "~/game/types/game-state";

const DEFAULT_HALF_GAMES = 500;
const DEFAULT_FULL_GAMES = 500;
const DEFAULT_SEED_PREFIX = "event-frequency";
const DEFAULT_OUTPUT_DIRECTORY = "reports/event-frequency";

const AUTOMATIC_POOL_IDS = [
  "automatic-preparation",
  "automatic-aftermath",
  "automatic-status-resolution",
] as const;

type AutomaticPoolId = (typeof AUTOMATIC_POOL_IDS)[number];
type AuditPoolId = EventDistributionPoolId | AutomaticPoolId | "unclassified";

const AUDIT_POOL_IDS = [
  ...EVENT_DISTRIBUTION_POOL_IDS,
  ...AUTOMATIC_POOL_IDS,
  "unclassified",
] as const satisfies readonly AuditPoolId[];

const AUDIT_POOL_LABELS = {
  "bloodbath-cornucopia": "Bloodbath — Cornucopia",
  "bloodbath-flee": "Bloodbath — Fleeing",
  "later-day": "Day 2+",
  night: "Night",
  "automatic-preparation": "Automatic — Preparation",
  "automatic-aftermath": "Automatic — Aftermath",
  "automatic-status-resolution": "Automatic — Status resolution",
  unclassified: "Unclassified",
} as const satisfies Record<AuditPoolId, string>;

interface ReportConfiguration {
  halfGames: number;
  fullGames: number;
  seedPrefix: string;
  outputDirectory: string;
}

interface MutableDiagnosticTotals {
  considered: number;
  eligible: number;
  feasible: number;
  selected: number;
  gamesConsidered: number;
  gamesEligible: number;
  gamesFeasible: number;
  gamesSelected: number;
  gamesEligibleButNotSelected: number;
  gamesFeasibleButNotSelected: number;
  rejectionCounts: Record<EventSelectionRejectionReason, number>;
  stages: Set<string>;
}

interface MutableOutcomeMetric {
  key: string;
  normalizedText: string;
  effectSignature: string;
  sampleText: string;
  selections: number;
  gamesWithOutcome: number;
  maximumSelectionsInGame: number;
}

interface MutableEventMetric extends MutableDiagnosticTotals {
  gameSize: EventDistributionGameSizeId;
  poolId: AuditPoolId;
  definitionId: string;
  kinds: Set<ResolvedEvent["kind"]>;
  selections: number;
  gamesWithEvent: number;
  maximumSelectionsInGame: number;
  fatalSelections: number;
  eliminations: number;
  outcomesByKey: Map<string, MutableOutcomeMetric>;
}

interface PerGameEventMetric {
  seed: string;
  gameSize: EventDistributionGameSizeId;
  poolId: AuditPoolId;
  definitionId: string;
  selections: number;
}

interface PerGameOutcomeMetric extends PerGameEventMetric {
  normalizedText: string;
  effectSignature: string;
}

interface EventOutcomeMetric {
  key: string;
  normalizedText: string;
  effectSignature: string;
  sampleText: string;
  selections: number;
  gamesWithOutcome: number;
  appearanceRate: number;
  eventSelectionShare: number;
  maximumSelectionsInGame: number;
}

interface EventFrequencyMetric {
  gameSize: EventDistributionGameSizeId;
  poolId: AuditPoolId;
  poolLabel: string;
  definitionId: string;
  kinds: readonly ResolvedEvent["kind"][];
  games: number;
  selections: number;
  gamesWithEvent: number;
  appearanceRate: number;
  averageSelectionsPerGame: number;
  maximumSelectionsInGame: number;
  poolSelectionShare: number;
  fatalSelections: number;
  eliminations: number;
  considered: number;
  eligible: number;
  feasible: number;
  diagnosticSelected: number;
  gamesConsidered: number;
  gamesEligible: number;
  gamesFeasible: number;
  gamesSelected: number;
  gamesEligibleButNotSelected: number;
  gamesFeasibleButNotSelected: number;
  eligibilityRateWhenConsidered: number;
  feasibilityRateWhenEligible: number;
  selectionRateWhenFeasible: number;
  rejectionCounts: Readonly<Record<EventSelectionRejectionReason, number>>;
  stages: readonly string[];
  flags: readonly string[];
  outcomes: readonly EventOutcomeMetric[];
}

interface FrequencyReportData {
  generatedAt: string;
  configuration: ReportConfiguration;
  methodology: {
    selectionFrequency: string;
    eligibility: string;
    outcomeGrouping: string;
  };
  distributionMetrics: EventDistributionMetrics;
  events: readonly EventFrequencyMetric[];
}

function readOption(name: string): string | undefined {
  const arguments_ = process.argv.slice(2);
  const exactPrefix = `--${name}=`;
  const exactArgument = arguments_.find((argument) => argument.startsWith(exactPrefix));

  if (exactArgument) {
    return exactArgument.slice(exactPrefix.length);
  }

  const argumentIndex = arguments_.findIndex((argument) => argument === `--${name}`);

  return argumentIndex < 0 ? undefined : arguments_[argumentIndex + 1];
}

function parseGameCount(name: string, fallback: number): number {
  const rawValue = readOption(name);

  if (rawValue === undefined) {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative integer.`);
  }

  return value;
}

function getConfiguration(): ReportConfiguration {
  const configuration = {
    halfGames: parseGameCount("half-games", DEFAULT_HALF_GAMES),
    fullGames: parseGameCount("full-games", DEFAULT_FULL_GAMES),
    seedPrefix: readOption("seed-prefix") ?? DEFAULT_SEED_PREFIX,
    outputDirectory: readOption("output-directory") ?? DEFAULT_OUTPUT_DIRECTORY,
  };

  if (configuration.halfGames + configuration.fullGames === 0) {
    throw new Error("At least one Half Game or Full Game must be requested.");
  }

  if (configuration.seedPrefix.trim().length === 0) {
    throw new Error("--seed-prefix must not be empty.");
  }

  if (configuration.outputDirectory.trim().length === 0) {
    throw new Error("--output-directory must not be empty.");
  }

  return configuration;
}

function printHelp(): void {
  console.log(`Usage: npm run event-frequency -- [options]

Options:
  --half-games <count>       Half Games to simulate (default: ${DEFAULT_HALF_GAMES})
  --full-games <count>       Full Games to simulate (default: ${DEFAULT_FULL_GAMES})
  --seed-prefix <prefix>     Deterministic seed prefix
  --output-directory <path>  Report directory (default: ${DEFAULT_OUTPUT_DIRECTORY})
  --help                     Show this help
`);
}

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function createRejectionCounts(): Record<EventSelectionRejectionReason, number> {
  return Object.fromEntries(
    EVENT_SELECTION_REJECTION_REASONS.map((reason) => [reason, 0]),
  ) as Record<EventSelectionRejectionReason, number>;
}

function createDiagnosticTotals(): MutableDiagnosticTotals {
  return {
    considered: 0,
    eligible: 0,
    feasible: 0,
    selected: 0,
    gamesConsidered: 0,
    gamesEligible: 0,
    gamesFeasible: 0,
    gamesSelected: 0,
    gamesEligibleButNotSelected: 0,
    gamesFeasibleButNotSelected: 0,
    rejectionCounts: createRejectionCounts(),
    stages: new Set<string>(),
  };
}

function getGameSize(run: SimulationRun): EventDistributionGameSizeId {
  return run.districtCount === 6 ? "half-game" : "full-game";
}

function classifyEventPool(event: ResolvedEvent): AuditPoolId {
  if (event.feedGroup === "bloodbath-cornucopia") {
    return "bloodbath-cornucopia";
  }

  if (event.feedGroup === "bloodbath-flee") {
    return "bloodbath-flee";
  }

  if (event.kind === "preparation") {
    return "automatic-preparation";
  }

  if (event.kind === "aftermath") {
    return "automatic-aftermath";
  }

  if (event.kind === "status-resolution") {
    return "automatic-status-resolution";
  }

  if (event.kind === "primary" && event.round.period === "night") {
    return "night";
  }

  if (event.kind === "primary" && event.round.day >= 2) {
    return "later-day";
  }

  return "unclassified";
}

function createMetricKey(
  gameSize: EventDistributionGameSizeId,
  poolId: AuditPoolId,
  definitionId: string,
): string {
  return [gameSize, poolId, definitionId].join("\u0000");
}

function createOutcomeKey(normalizedText: string, effectSignature: string): string {
  return `${normalizedText}\u0000${effectSignature}`;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceLiteralCaseInsensitive(text: string, value: string, replacement: string): string {
  if (value.length === 0) {
    return text;
  }

  return text.replace(new RegExp(escapeRegularExpression(value), "gi"), replacement);
}

const ITEM_LABELS = [...new Set(ITEM_CATALOGUE.map((item) => item.label))].sort(
  (first, second) => second.length - first.length,
);

const STATUS_LABELS = [...new Set(STATUS_CATALOGUE.map((status) => status.label))].sort(
  (first, second) => second.length - first.length,
);

const PRONOUN_WORDS = [
  "themselves",
  "herself",
  "himself",
  "itself",
  "theirs",
  "hers",
  "their",
  "them",
  "they",
  "she",
  "her",
  "he",
  "him",
  "his",
  "its",
  "it",
] as const;

function normalizeEventText(run: SimulationRun, event: ResolvedEvent): string {
  let normalized = event.text;
  const participantIds = [...new Set(event.participantTributeIds)];
  const replacements = participantIds
    .map((tributeId, index) => {
      const tribute = run.state.tributes.find((candidate) => candidate.id === tributeId);

      return tribute
        ? {
            value: tribute.snapshot.name,
            replacement: `{tribute-${index + 1}}`,
          }
        : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((first, second) => second.value.length - first.value.length);

  for (const replacement of replacements) {
    normalized = replaceLiteralCaseInsensitive(
      normalized,
      replacement.value,
      replacement.replacement,
    );
  }

  for (const label of ITEM_LABELS) {
    normalized = replaceLiteralCaseInsensitive(normalized, label, "{item}");
  }

  for (const label of STATUS_LABELS) {
    normalized = replaceLiteralCaseInsensitive(normalized, label, "{status}");
  }

  for (const pronoun of PRONOUN_WORDS) {
    normalized = normalized.replace(
      new RegExp(`\\b${escapeRegularExpression(pronoun)}\\b`, "gi"),
      "{pronoun}",
    );
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function getRemovedStatusDefinitionId(statusInstanceId: string): string {
  const matchingDefinition = STATUS_CATALOGUE.find((definition) =>
    statusInstanceId.endsWith(`:${definition.id}`),
  );

  return matchingDefinition?.id ?? "unknown";
}

function describeChange(
  change: GameChange,
  itemDefinitionByInstanceId: ReadonlyMap<string, string>,
): string {
  switch (change.type) {
    case "eliminate-tribute":
      return `eliminate(killers=${change.killerTributeIds.length})`;
    case "increment-statistic":
      return `stat(${change.statistic}:${change.amount})`;
    case "satisfy-survival-need":
      return `satisfy(${change.need})`;
    case "record-night-rest":
      return `rest(${change.quality})`;
    case "apply-status":
      return `status+(${change.status.definitionId}:${change.status.severity}:source=${
        change.status.sourceTributeId === null ? "none" : "tribute"
      })`;
    case "remove-status":
      return `status-(${getRemovedStatusDefinitionId(change.statusId)})`;
    case "acquire-item":
      return `item+(${change.item.definitionId}:${change.acquisitionSource})`;
    case "use-item":
      return `item-use(${itemDefinitionByInstanceId.get(change.itemInstanceId) ?? "unknown"})`;
    case "consume-item":
      return `item-consume(${itemDefinitionByInstanceId.get(change.itemInstanceId) ?? "unknown"}:${
        change.uses
      })`;
    case "destroy-item":
      return `item-destroy(${itemDefinitionByInstanceId.get(change.itemInstanceId) ?? "unknown"})`;
    case "transfer-item":
      return `item-transfer(${itemDefinitionByInstanceId.get(change.itemInstanceId) ?? "unknown"})`;
    case "form-truce":
      return `truce+(${change.truce.kind}:${change.truce.tributeIds.length})`;
    case "break-truce":
      return `truce-(${change.reason})`;
    case "form-vendetta":
      return `vendetta+(${change.vendetta.kind})`;
    case "declare-victory":
      return `victory(${change.outcome.kind})`;
  }
}

function createEffectSignature(
  event: ResolvedEvent,
  itemDefinitionByInstanceId: ReadonlyMap<string, string>,
): string {
  if (event.changes.length === 0) {
    return "no-changes";
  }

  return event.changes
    .map((change) => describeChange(change, itemDefinitionByInstanceId))
    .join("; ");
}

function createItemDefinitionLookup(run: SimulationRun): Map<string, string> {
  return new Map(
    run.state.itemTransactions.flatMap((transaction) =>
      transaction.type === "acquired"
        ? [[transaction.itemInstanceId, transaction.definitionId] as const]
        : [],
    ),
  );
}

function getOrCreateEventMetric(
  metricsByKey: Map<string, MutableEventMetric>,
  gameSize: EventDistributionGameSizeId,
  poolId: AuditPoolId,
  definitionId: string,
): MutableEventMetric {
  const key = createMetricKey(gameSize, poolId, definitionId);
  const existing = metricsByKey.get(key);

  if (existing) {
    return existing;
  }

  const created: MutableEventMetric = {
    gameSize,
    poolId,
    definitionId,
    kinds: new Set<ResolvedEvent["kind"]>(),
    selections: 0,
    gamesWithEvent: 0,
    maximumSelectionsInGame: 0,
    fatalSelections: 0,
    eliminations: 0,
    outcomesByKey: new Map<string, MutableOutcomeMetric>(),
    ...createDiagnosticTotals(),
  };

  metricsByKey.set(key, created);
  return created;
}

function addRunEvents(
  metricsByKey: Map<string, MutableEventMetric>,
  poolSelectionsByKey: Map<string, number>,
  perGameEvents: PerGameEventMetric[],
  perGameOutcomes: PerGameOutcomeMetric[],
  run: SimulationRun,
): void {
  const gameSize = getGameSize(run);
  const itemDefinitionByInstanceId = createItemDefinitionLookup(run);
  const eventCounts = new Map<string, number>();
  const outcomeCounts = new Map<string, number>();

  for (const event of run.state.eventHistory) {
    const poolId = classifyEventPool(event);
    const metricKey = createMetricKey(gameSize, poolId, event.definitionId);
    const metric = getOrCreateEventMetric(metricsByKey, gameSize, poolId, event.definitionId);
    const poolKey = `${gameSize}\u0000${poolId}`;
    const eliminationCount = event.changes.filter(
      (change) => change.type === "eliminate-tribute",
    ).length;
    const normalizedText = normalizeEventText(run, event);
    const effectSignature = createEffectSignature(event, itemDefinitionByInstanceId);
    const outcomeKey = createOutcomeKey(normalizedText, effectSignature);
    const mutableOutcome = metric.outcomesByKey.get(outcomeKey) ?? {
      key: outcomeKey,
      normalizedText,
      effectSignature,
      sampleText: event.text,
      selections: 0,
      gamesWithOutcome: 0,
      maximumSelectionsInGame: 0,
    };

    metric.kinds.add(event.kind);
    metric.selections += 1;
    metric.eliminations += eliminationCount;

    if (eliminationCount > 0) {
      metric.fatalSelections += 1;
    }

    mutableOutcome.selections += 1;
    metric.outcomesByKey.set(outcomeKey, mutableOutcome);

    eventCounts.set(metricKey, (eventCounts.get(metricKey) ?? 0) + 1);
    const outcomeCountKey = `${metricKey}\u0000${outcomeKey}`;
    outcomeCounts.set(outcomeCountKey, (outcomeCounts.get(outcomeCountKey) ?? 0) + 1);
    poolSelectionsByKey.set(poolKey, (poolSelectionsByKey.get(poolKey) ?? 0) + 1);
  }

  for (const [metricKey, count] of eventCounts) {
    const metric = metricsByKey.get(metricKey);

    if (!metric) {
      continue;
    }

    metric.gamesWithEvent += 1;
    metric.maximumSelectionsInGame = Math.max(metric.maximumSelectionsInGame, count);
    perGameEvents.push({
      seed: run.seed,
      gameSize: metric.gameSize,
      poolId: metric.poolId,
      definitionId: metric.definitionId,
      selections: count,
    });
  }

  for (const [outcomeCountKey, count] of outcomeCounts) {
    const [gameSizeId, poolId, definitionId, normalizedText, effectSignature] =
      outcomeCountKey.split("\u0000");

    if (!gameSizeId || !poolId || !definitionId || normalizedText === undefined) {
      continue;
    }

    const metric = metricsByKey.get(createMetricKey(gameSizeId as EventDistributionGameSizeId, poolId as AuditPoolId, definitionId));
    const outcome = metric?.outcomesByKey.get(createOutcomeKey(normalizedText, effectSignature ?? ""));

    if (!outcome) {
      continue;
    }

    outcome.gamesWithOutcome += 1;
    outcome.maximumSelectionsInGame = Math.max(outcome.maximumSelectionsInGame, count);
    perGameOutcomes.push({
      seed: run.seed,
      gameSize: metric.gameSize,
      poolId: metric.poolId,
      definitionId: metric.definitionId,
      selections: count,
      normalizedText: outcome.normalizedText,
      effectSignature: outcome.effectSignature,
    });
  }
}

function addRunDiagnostics(
  metricsByKey: Map<string, MutableEventMetric>,
  run: SimulationRun,
): void {
  if (!run.selectionDiagnostics) {
    return;
  }

  const gameSize = getGameSize(run);
  const perRunTotals = new Map<string, MutableDiagnosticTotals>();

  for (const stage of run.selectionDiagnostics.stages) {
    for (const definition of stage.definitions) {
      const metricKey = createMetricKey(gameSize, stage.poolId, definition.definitionId);
      const totals = perRunTotals.get(metricKey) ?? createDiagnosticTotals();

      totals.considered += definition.considered;
      totals.eligible += definition.eligible;
      totals.feasible += definition.feasible;
      totals.selected += definition.selected;
      totals.stages.add(stage.stage);

      for (const reason of EVENT_SELECTION_REJECTION_REASONS) {
        totals.rejectionCounts[reason] += definition.rejectionCounts[reason];
      }

      perRunTotals.set(metricKey, totals);
    }
  }

  for (const [metricKey, runTotals] of perRunTotals) {
    const [gameSizeId, poolId, definitionId] = metricKey.split("\u0000");

    if (!gameSizeId || !poolId || !definitionId) {
      continue;
    }

    const metric = getOrCreateEventMetric(
      metricsByKey,
      gameSizeId as EventDistributionGameSizeId,
      poolId as AuditPoolId,
      definitionId,
    );

    metric.considered += runTotals.considered;
    metric.eligible += runTotals.eligible;
    metric.feasible += runTotals.feasible;
    metric.selected += runTotals.selected;

    if (runTotals.considered > 0) {
      metric.gamesConsidered += 1;
    }

    if (runTotals.eligible > 0) {
      metric.gamesEligible += 1;
    }

    if (runTotals.feasible > 0) {
      metric.gamesFeasible += 1;
    }

    if (runTotals.selected > 0) {
      metric.gamesSelected += 1;
    }

    if (runTotals.eligible > 0 && runTotals.selected === 0) {
      metric.gamesEligibleButNotSelected += 1;
    }

    if (runTotals.feasible > 0 && runTotals.selected === 0) {
      metric.gamesFeasibleButNotSelected += 1;
    }

    for (const reason of EVENT_SELECTION_REJECTION_REASONS) {
      metric.rejectionCounts[reason] += runTotals.rejectionCounts[reason];
    }

    for (const stage of runTotals.stages) {
      metric.stages.add(stage);
    }
  }
}

function getFlags(metric: Omit<EventFrequencyMetric, "flags" | "outcomes">): string[] {
  const flags: string[] = [];

  if (metric.considered > 0 && metric.eligible === 0) {
    flags.push("never-eligible");
  }

  if (metric.eligible > 0 && metric.feasible === 0) {
    flags.push("eligible-never-feasible");
  }

  if (metric.feasible > 0 && metric.selections === 0) {
    flags.push("feasible-never-selected");
  }

  if (metric.feasible >= 100 && metric.selectionRateWhenFeasible < 0.01) {
    flags.push("very-low-selection-conversion");
  }

  if (metric.appearanceRate >= 0.5) {
    flags.push("high-game-appearance");
  }

  if (metric.poolSelectionShare >= 0.1) {
    flags.push("high-pool-share");
  }

  return flags;
}

function createFrequencyMetrics(
  configuration: ReportConfiguration,
  metricsByKey: ReadonlyMap<string, MutableEventMetric>,
  poolSelectionsByKey: ReadonlyMap<string, number>,
): EventFrequencyMetric[] {
  const gamesBySize = {
    "half-game": configuration.halfGames,
    "full-game": configuration.fullGames,
  } satisfies Record<EventDistributionGameSizeId, number>;

  return [...metricsByKey.values()]
    .map((metric): EventFrequencyMetric => {
      const games = gamesBySize[metric.gameSize];
      const poolSelections =
        poolSelectionsByKey.get(`${metric.gameSize}\u0000${metric.poolId}`) ?? 0;
      const baseMetric = {
        gameSize: metric.gameSize,
        poolId: metric.poolId,
        poolLabel: AUDIT_POOL_LABELS[metric.poolId],
        definitionId: metric.definitionId,
        kinds: [...metric.kinds].sort(),
        games,
        selections: metric.selections,
        gamesWithEvent: metric.gamesWithEvent,
        appearanceRate: divide(metric.gamesWithEvent, games),
        averageSelectionsPerGame: divide(metric.selections, games),
        maximumSelectionsInGame: metric.maximumSelectionsInGame,
        poolSelectionShare: divide(metric.selections, poolSelections),
        fatalSelections: metric.fatalSelections,
        eliminations: metric.eliminations,
        considered: metric.considered,
        eligible: metric.eligible,
        feasible: metric.feasible,
        diagnosticSelected: metric.selected,
        gamesConsidered: metric.gamesConsidered,
        gamesEligible: metric.gamesEligible,
        gamesFeasible: metric.gamesFeasible,
        gamesSelected: metric.gamesSelected,
        gamesEligibleButNotSelected: metric.gamesEligibleButNotSelected,
        gamesFeasibleButNotSelected: metric.gamesFeasibleButNotSelected,
        eligibilityRateWhenConsidered: divide(metric.eligible, metric.considered),
        feasibilityRateWhenEligible: divide(metric.feasible, metric.eligible),
        selectionRateWhenFeasible: divide(metric.selected, metric.feasible),
        rejectionCounts: { ...metric.rejectionCounts },
        stages: [...metric.stages].sort(),
      };
      const outcomes = [...metric.outcomesByKey.values()]
        .map(
          (outcome): EventOutcomeMetric => ({
            key: outcome.key,
            normalizedText: outcome.normalizedText,
            effectSignature: outcome.effectSignature,
            sampleText: outcome.sampleText,
            selections: outcome.selections,
            gamesWithOutcome: outcome.gamesWithOutcome,
            appearanceRate: divide(outcome.gamesWithOutcome, games),
            eventSelectionShare: divide(outcome.selections, metric.selections),
            maximumSelectionsInGame: outcome.maximumSelectionsInGame,
          }),
        )
        .sort(
          (first, second) =>
            second.selections - first.selections ||
            first.normalizedText.localeCompare(second.normalizedText),
        );

      return {
        ...baseMetric,
        flags: getFlags(baseMetric),
        outcomes,
      };
    })
    .sort(
      (first, second) =>
        first.gameSize.localeCompare(second.gameSize) ||
        AUDIT_POOL_IDS.indexOf(first.poolId) - AUDIT_POOL_IDS.indexOf(second.poolId) ||
        second.selections - first.selections ||
        first.definitionId.localeCompare(second.definitionId),
    );
}

function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function formatRate(value: number): string {
  return `${formatNumber(value * 100, 1)}%`;
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function truncate(value: string, maximumLength: number): string {
  return value.length <= maximumLength ? value : `${value.slice(0, maximumLength - 1)}…`;
}

function getTopRejection(metric: EventFrequencyMetric): string {
  const [reason, count] = Object.entries(metric.rejectionCounts).sort(
    ([firstReason, firstCount], [secondReason, secondCount]) =>
      secondCount - firstCount || firstReason.localeCompare(secondReason),
  )[0] ?? ["none", 0];

  return count > 0 ? `${reason} (${count})` : "—";
}

function createFrequencyBandSummary(events: readonly EventFrequencyMetric[]): string[] {
  const bands = [
    {
      label: "50%+ of games",
      count: events.filter((event) => event.appearanceRate >= 0.5).length,
    },
    {
      label: "25–49.9% of games",
      count: events.filter(
        (event) => event.appearanceRate >= 0.25 && event.appearanceRate < 0.5,
      ).length,
    },
    {
      label: "5–24.9% of games",
      count: events.filter(
        (event) => event.appearanceRate >= 0.05 && event.appearanceRate < 0.25,
      ).length,
    },
    {
      label: "Below 5% of games",
      count: events.filter((event) => event.appearanceRate > 0 && event.appearanceRate < 0.05)
        .length,
    },
    {
      label: "Never selected",
      count: events.filter((event) => event.selections === 0).length,
    },
  ];

  return [
    "| Appearance band | Event definitions |",
    "| --- | ---: |",
    ...bands.map((band) => `| ${band.label} | ${band.count} |`),
    "",
  ];
}

function createEventTable(events: readonly EventFrequencyMetric[]): string[] {
  return [
    "| Event | Selected | Games | Appearance | Avg/game | Max/game | Eligible games | Feasible games | Feasible but not selected | Selected/feasible | Pool share | Flags |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...(events.length > 0
      ? events.map(
          (event) =>
            `| \`${escapeMarkdownCell(event.definitionId)}\` | ${event.selections} | ${event.gamesWithEvent} | ${formatRate(
              event.appearanceRate,
            )} | ${formatNumber(event.averageSelectionsPerGame)} | ${
              event.maximumSelectionsInGame
            } | ${event.gamesEligible} | ${event.gamesFeasible} | ${
              event.gamesFeasibleButNotSelected
            } | ${formatRate(event.selectionRateWhenFeasible)} | ${formatRate(
              event.poolSelectionShare,
            )} | ${event.flags.length > 0 ? event.flags.join(", ") : "—"} |`,
        )
      : ["| _No events_ | 0 | 0 | 0.0% | 0.00 | 0 | 0 | 0 | 0 | 0.0% | 0.0% | — |"]),
    "",
  ];
}

function createDiagnosticBottleneckTable(events: readonly EventFrequencyMetric[]): string[] {
  const flaggedEvents = events.filter(
    (event) =>
      event.flags.includes("never-eligible") ||
      event.flags.includes("eligible-never-feasible") ||
      event.flags.includes("feasible-never-selected") ||
      event.flags.includes("very-low-selection-conversion"),
  );

  return [
    "#### Selection bottlenecks",
    "",
    "| Event | Considered | Eligible | Feasible | Selected | Eligible games | Feasible games | Top rejection | Flags |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...(flaggedEvents.length > 0
      ? flaggedEvents.map(
          (event) =>
            `| \`${escapeMarkdownCell(event.definitionId)}\` | ${event.considered} | ${
              event.eligible
            } | ${event.feasible} | ${event.diagnosticSelected} | ${event.gamesEligible} | ${
              event.gamesFeasible
            } | ${escapeMarkdownCell(getTopRejection(event))} | ${event.flags.join(", ")} |`,
        )
      : ["| _No bottlenecks detected by the default thresholds_ | 0 | 0 | 0 | 0 | 0 | 0 | — | — |"]),
    "",
  ];
}

function createOutcomeSections(events: readonly EventFrequencyMetric[]): string[] {
  const multipleOutcomeEvents = events.filter((event) => event.outcomes.length > 1);

  if (multipleOutcomeEvents.length === 0) {
    return ["#### Multiple observed outcomes", "", "None observed.", ""];
  }

  return [
    "#### Multiple observed outcomes",
    "",
    "Outcome variants are inferred from normalized player-facing wording plus the resolved mechanical changes. This distinguishes branches even when they share wording or effects, but it does not know authored labels such as `success` or `critical-failure` unless those labels are stored in resolved events.",
    "",
    ...multipleOutcomeEvents.flatMap((event) => [
      `##### \`${event.definitionId}\``,
      "",
      "| Variant | Selections | Event share | Games | Appearance | Mechanical effects | Normalized wording |",
      "| ---: | ---: | ---: | ---: | ---: | --- | --- |",
      ...event.outcomes.map(
        (outcome, index) =>
          `| ${index + 1} | ${outcome.selections} | ${formatRate(
            outcome.eventSelectionShare,
          )} | ${outcome.gamesWithOutcome} | ${formatRate(
            outcome.appearanceRate,
          )} | ${escapeMarkdownCell(truncate(outcome.effectSignature, 180))} | ${escapeMarkdownCell(
            truncate(outcome.normalizedText, 260),
          )} |`,
      ),
      "",
    ]),
  ];
}

function createPoolDiagnosticsSummary(
  metrics: EventDistributionMetrics,
  gameSize: EventDistributionGameSizeId,
  poolId: EventDistributionPoolId,
): string[] {
  const pool = metrics.gameSizes[gameSize].pools[poolId];
  const diagnostics = pool.selectionDiagnostics;

  return [
    `- Total selections: ${pool.totalSelections}`,
    `- Average selections per game: ${formatNumber(pool.averageSelectionsPerGame)}`,
    `- Top-five selection share: ${formatRate(pool.concentration.topFiveSelectionShare)}`,
    `- Top-ten selection share: ${formatRate(pool.concentration.topTenSelectionShare)}`,
    `- Selector opportunities: ${diagnostics.opportunities}`,
    `- Opportunities with no feasible candidate: ${diagnostics.noFeasibleCandidates}`,
    `- Opportunities with no feasible non-solo candidate: ${diagnostics.noNonSoloFeasible}`,
    "",
  ];
}

function createMarkdownReport(data: FrequencyReportData): string {
  const lines = [
    "# Event Frequency and Outcome Audit",
    "",
    `Generated from ${data.configuration.halfGames} Half Games and ${data.configuration.fullGames} Full Games.`,
    "",
    "## What this report measures",
    "",
    "- **Appearance:** percentage of games containing the event at least once.",
    "- **Selected:** total event-history occurrences across the sample.",
    "- **Eligible:** the event passed definition-level eligibility during a selector opportunity.",
    "- **Feasible:** eligible participants and required items could be selected at that opportunity.",
    "- **Feasible but not selected:** games where the event was feasible at least once but never chosen.",
    "- **Outcome variant:** normalized wording plus the event's mechanical change signature.",
    "- Preparation, aftermath, and fatal-status events are counted in separate automatic pools. They do not have ordinary selector eligibility diagnostics.",
    "",
    "## Suggested interpretation",
    "",
    "- `never-eligible` usually means the sample never created the event's required state.",
    "- `eligible-never-feasible` points to participant, relationship, or item constraints.",
    "- `feasible-never-selected` and `very-low-selection-conversion` point to weighting, repeat-cycle, planner-stage, reservation, or catalogue-concentration pressure.",
    "- `high-game-appearance` and `high-pool-share` are candidates for overexposure review, not automatic failures.",
    "- Rare outcomes need enough total selections before their percentages are meaningful.",
    "",
  ];

  for (const gameSize of EVENT_DISTRIBUTION_GAME_SIZE_IDS) {
    const gameSizeEvents = data.events.filter((event) => event.gameSize === gameSize);
    const gameSizeLabel = data.distributionMetrics.gameSizes[gameSize].label;

    lines.push(`## ${gameSizeLabel}`, "", ...createFrequencyBandSummary(gameSizeEvents));

    for (const poolId of AUDIT_POOL_IDS) {
      const poolEvents = gameSizeEvents.filter((event) => event.poolId === poolId);

      if (poolEvents.length === 0) {
        continue;
      }

      lines.push(`### ${AUDIT_POOL_LABELS[poolId]}`, "");

      if ((EVENT_DISTRIBUTION_POOL_IDS as readonly string[]).includes(poolId)) {
        lines.push(
          ...createPoolDiagnosticsSummary(
            data.distributionMetrics,
            gameSize,
            poolId as EventDistributionPoolId,
          ),
        );
      }

      lines.push(
        ...createEventTable(poolEvents),
        ...createDiagnosticBottleneckTable(poolEvents),
        ...createOutcomeSections(poolEvents),
      );
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

function sanitizeTsv(value: string): string {
  return value.replaceAll("\t", " ").replaceAll("\r", " ").replaceAll("\n", " ");
}

function createEventTsv(events: readonly EventFrequencyMetric[]): string {
  const header = [
    "game_size",
    "pool",
    "definition_id",
    "kinds",
    "games",
    "selections",
    "games_with_event",
    "appearance_rate",
    "average_selections_per_game",
    "maximum_selections_in_game",
    "pool_selection_share",
    "fatal_selections",
    "eliminations",
    "considered",
    "eligible",
    "feasible",
    "diagnostic_selected",
    "games_considered",
    "games_eligible",
    "games_feasible",
    "games_selected",
    "games_eligible_but_not_selected",
    "games_feasible_but_not_selected",
    "eligibility_rate_when_considered",
    "feasibility_rate_when_eligible",
    "selection_rate_when_feasible",
    "top_rejection",
    "flags",
    "observed_outcome_variants",
  ];

  const rows = events.map((event) =>
    [
      event.gameSize,
      event.poolId,
      event.definitionId,
      event.kinds.join(","),
      event.games,
      event.selections,
      event.gamesWithEvent,
      event.appearanceRate,
      event.averageSelectionsPerGame,
      event.maximumSelectionsInGame,
      event.poolSelectionShare,
      event.fatalSelections,
      event.eliminations,
      event.considered,
      event.eligible,
      event.feasible,
      event.diagnosticSelected,
      event.gamesConsidered,
      event.gamesEligible,
      event.gamesFeasible,
      event.gamesSelected,
      event.gamesEligibleButNotSelected,
      event.gamesFeasibleButNotSelected,
      event.eligibilityRateWhenConsidered,
      event.feasibilityRateWhenEligible,
      event.selectionRateWhenFeasible,
      getTopRejection(event),
      event.flags.join(","),
      event.outcomes.length,
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

function createPerGameEventTsv(events: readonly PerGameEventMetric[]): string {
  const header = ["seed", "game_size", "pool", "definition_id", "selections"];
  const rows = events
    .sort(
      (first, second) =>
        first.seed.localeCompare(second.seed) ||
        first.poolId.localeCompare(second.poolId) ||
        first.definitionId.localeCompare(second.definitionId),
    )
    .map((event) =>
      [event.seed, event.gameSize, event.poolId, event.definitionId, event.selections]
        .map((value) => sanitizeTsv(String(value)))
        .join("\t"),
    );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

function createPerGameOutcomeTsv(outcomes: readonly PerGameOutcomeMetric[]): string {
  const header = [
    "seed",
    "game_size",
    "pool",
    "definition_id",
    "selections",
    "effect_signature",
    "normalized_text",
  ];
  const rows = outcomes
    .sort(
      (first, second) =>
        first.seed.localeCompare(second.seed) ||
        first.poolId.localeCompare(second.poolId) ||
        first.definitionId.localeCompare(second.definitionId) ||
        first.normalizedText.localeCompare(second.normalizedText),
    )
    .map((outcome) =>
      [
        outcome.seed,
        outcome.gameSize,
        outcome.poolId,
        outcome.definitionId,
        outcome.selections,
        outcome.effectSignature,
        outcome.normalizedText,
      ]
        .map((value) => sanitizeTsv(String(value)))
        .join("\t"),
    );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

function createOutcomeTsv(events: readonly EventFrequencyMetric[]): string {
  const header = [
    "game_size",
    "pool",
    "definition_id",
    "variant_index",
    "selections",
    "games_with_outcome",
    "appearance_rate",
    "event_selection_share",
    "maximum_selections_in_game",
    "effect_signature",
    "normalized_text",
    "sample_text",
  ];

  const rows = events.flatMap((event) =>
    event.outcomes.map((outcome, index) =>
      [
        event.gameSize,
        event.poolId,
        event.definitionId,
        index + 1,
        outcome.selections,
        outcome.gamesWithOutcome,
        outcome.appearanceRate,
        outcome.eventSelectionShare,
        outcome.maximumSelectionsInGame,
        outcome.effectSignature,
        outcome.normalizedText,
        outcome.sampleText,
      ]
        .map((value) => sanitizeTsv(String(value)))
        .join("\t"),
    ),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

if (process.argv.includes("--help")) {
  printHelp();
  process.exit(0);
}

const configuration = getConfiguration();
const batchDefinitions: SimulationBatchDefinition[] = [
  ...(configuration.halfGames > 0
    ? [
        {
          seedPrefix: `${configuration.seedPrefix}-half-game`,
          count: configuration.halfGames,
          districtCount: 6 as const,
          captureSelectionDiagnostics: true,
        },
      ]
    : []),
  ...(configuration.fullGames > 0
    ? [
        {
          seedPrefix: `${configuration.seedPrefix}-full-game`,
          count: configuration.fullGames,
          districtCount: 12 as const,
          captureSelectionDiagnostics: true,
        },
      ]
    : []),
];

const runs = simulateGameBatch(batchDefinitions);
const distributionMetrics = collectEventDistributionMetrics(runs);
const metricsByKey = new Map<string, MutableEventMetric>();
const poolSelectionsByKey = new Map<string, number>();
const perGameEvents: PerGameEventMetric[] = [];
const perGameOutcomes: PerGameOutcomeMetric[] = [];

for (const run of runs) {
  addRunEvents(metricsByKey, poolSelectionsByKey, perGameEvents, perGameOutcomes, run);
  addRunDiagnostics(metricsByKey, run);
}

const events = createFrequencyMetrics(configuration, metricsByKey, poolSelectionsByKey);
const data: FrequencyReportData = {
  generatedAt: new Date().toISOString(),
  configuration,
  methodology: {
    selectionFrequency:
      "Counts resolved event-history entries by game size, pool, definition, and game.",
    eligibility:
      "Uses selector diagnostics. Eligible means definition-level eligibility passed; feasible means participants and required items could be selected.",
    outcomeGrouping:
      "Groups observed variants by normalized player-facing wording plus an ordered mechanical change signature. This is observational and does not expose authored success/failure labels.",
  },
  distributionMetrics,
  events,
};

const outputDirectory = resolve(process.cwd(), configuration.outputDirectory);
const markdownPath = resolve(outputDirectory, "event-frequency-report.md");
const jsonPath = resolve(outputDirectory, "event-frequency-report.json");
const eventTsvPath = resolve(outputDirectory, "event-frequency-events.tsv");
const outcomeTsvPath = resolve(outputDirectory, "event-frequency-outcomes.tsv");
const perGameEventTsvPath = resolve(outputDirectory, "event-frequency-by-game.tsv");
const perGameOutcomeTsvPath = resolve(outputDirectory, "event-frequency-outcomes-by-game.tsv");

await mkdir(outputDirectory, {
  recursive: true,
});

await Promise.all([
  writeFile(markdownPath, createMarkdownReport(data), "utf8"),
  writeFile(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf8"),
  writeFile(eventTsvPath, createEventTsv(events), "utf8"),
  writeFile(outcomeTsvPath, createOutcomeTsv(events), "utf8"),
  writeFile(perGameEventTsvPath, createPerGameEventTsv(perGameEvents), "utf8"),
  writeFile(perGameOutcomeTsvPath, createPerGameOutcomeTsv(perGameOutcomes), "utf8"),
]);

console.log(`Event frequency Markdown written to ${markdownPath}`);
console.log(`Event frequency JSON written to ${jsonPath}`);
console.log(`Event frequency event TSV written to ${eventTsvPath}`);
console.log(`Event frequency outcome TSV written to ${outcomeTsvPath}`);
console.log(`Per-game event TSV written to ${perGameEventTsvPath}`);
console.log(`Per-game outcome TSV written to ${perGameOutcomeTsvPath}`);
console.log(
  `Simulated ${configuration.halfGames} Half Games and ${configuration.fullGames} Full Games.`,
);

for (const gameSize of EVENT_DISTRIBUTION_GAME_SIZE_IDS) {
  const gameSizeEvents = events.filter((event) => event.gameSize === gameSize);
  const neverSelected = gameSizeEvents.filter((event) => event.selections === 0).length;
  const feasibleNeverSelected = gameSizeEvents.filter((event) =>
    event.flags.includes("feasible-never-selected"),
  ).length;
  const highAppearance = gameSizeEvents.filter((event) =>
    event.flags.includes("high-game-appearance"),
  ).length;

  console.log(
    `${gameSize}: ${gameSizeEvents.length} definitions observed/diagnosed; ` +
      `${neverSelected} never selected; ${feasibleNeverSelected} feasible but never selected; ` +
      `${highAppearance} appear in at least half of games.`,
  );
}
EVENT_FREQUENCY_TYPESCRIPT

node <<'NODE'
const fs = require("node:fs");
const path = "package.json";
const packageJson = JSON.parse(fs.readFileSync(path, "utf8"));

packageJson.scripts ??= {};
packageJson.scripts["event-frequency"] = "tsx scripts/generate-event-frequency-report.ts";

fs.writeFileSync(path, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
NODE

if [[ -f "$VALIDATION_SCRIPT" ]] && ! grep -q "RUN_DEEP_EVENT_FREQUENCY" "$VALIDATION_SCRIPT"; then
  python - <<'PY_PATCH'
from pathlib import Path

path = Path("scripts/validate-phase-7.sh")
text = path.read_text()
anchor = 'run_step "Phase 7 multi-seed validation" npm run phase7:validate\n'
insert = '''run_step "Phase 7 multi-seed validation" npm run phase7:validate

if [[ "${RUN_DEEP_EVENT_FREQUENCY:-0}" == "1" ]]; then
  run_step \\
    "Deep event frequency audit" \\
    npm run event-frequency -- \\
      --half-games "${EVENT_FREQUENCY_HALF_GAMES:-500}" \\
      --full-games "${EVENT_FREQUENCY_FULL_GAMES:-500}" \\
      --seed-prefix "${EVENT_FREQUENCY_SEED_PREFIX:-phase-7-frequency}" \\
      --output-directory "${EVENT_FREQUENCY_OUTPUT_DIRECTORY:-reports/phase-7-event-frequency}"
fi
'''

if anchor not in text:
    raise SystemExit(
        "Could not find the Phase 7 validation step in scripts/validate-phase-7.sh. "
        "The report script and package command were created, but the optional shell hook was not added."
    )

path.write_text(text.replace(anchor, insert, 1))
PY_PATCH
fi

npm run format
npm run typecheck
npm run lint

echo
echo "Event-frequency audit installed successfully."
echo "Run: npm run event-frequency -- --half-games 500 --full-games 500"
echo "Optional full-validation hook: RUN_DEEP_EVENT_FREQUENCY=1 npm run phase7:full"