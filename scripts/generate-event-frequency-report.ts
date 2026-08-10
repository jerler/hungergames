import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  BLOODBATH_EVENT_CATALOGUE_FAMILIES,
  ORDINARY_EVENT_CATALOGUE_FAMILIES,
} from "~/game/events/catalogue/catalogue-families";
import { POISONOUS_BERRIES_JOINT_VICTORY_EVENT } from "~/game/events/catalogue/relationships/romantic-events";
import type { EventDefinition } from "~/game/events/event-schema";
import { ITEM_CATALOGUE } from "~/game/items/item-catalogue";
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
  createEventSelectionFunnelMarkdown,
  createEventSelectionFunnelReport,
  createEventSelectionFunnelSummaryTsv,
  createEventSelectionFunnelTsv,
  type EventSelectionFunnelReport,
} from "~/game/simulation/event-selection-funnel-report";
import {
  collectPrerequisiteLifecycleEvidence,
  createItemLifecycleByGameTsv,
  createItemPrerequisiteAvailabilityTsv,
  createPrerequisiteLifecycleEvidenceMarkdown,
  createStatusLifecycleByGameTsv,
  createStatusPreparationRemovalTsv,
  createStatusPrerequisiteAvailabilityTsv,
  createTruceLifecycleTsv,
  createTrucePrerequisiteAvailabilityTsv,
  type PrerequisiteLifecycleEvidenceReport,
} from "~/game/simulation/prerequisite-lifecycle-evidence";
import {
  collectRosterStrategyEvidence,
  createBloodbathStrategyByGameTsv,
  createBloodbathStrategyByStatTsv,
  createFocusedStatGateTsv,
  createRosterStatsByGameTsv,
  createRosterStrategyEvidenceMarkdown,
  createStatGatedSelectionTsv,
  type RosterStrategyEvidenceReport,
} from "~/game/simulation/roster-strategy-evidence";
import {
  simulateGameBatch,
  type SimulationBatchDefinition,
  type SimulationRun,
} from "~/game/simulation/simulation-runner";
import { STATUS_CATALOGUE } from "~/game/statuses/status-catalogue";
import { PREPARED_CAVE_NIGHT_DEFINITION_ID } from "~/game/survival/night-rest-coverage";
import type { GameChange, ResolvedEvent } from "~/game/types/game-state";

import {
  claimReportOutputDirectory,
  createEventFrequencyReportProvenance,
  type EventFrequencyReportProvenance,
} from "./event-frequency-report-provenance";

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

const EVENT_CLASS_IDS = [
  "weighted-authored",
  "lifecycle-primary",
  "automatic-preparation",
  "automatic-aftermath",
  "automatic-status-resolution",
  "uncatalogued-primary",
  "unclassified",
] as const;

type EventClassId = (typeof EVENT_CLASS_IDS)[number];

const EVENT_CLASS_LABELS = {
  "weighted-authored": "Weighted authored",
  "lifecycle-primary": "Lifecycle primary",
  "automatic-preparation": "Automatic preparation",
  "automatic-aftermath": "Automatic aftermath",
  "automatic-status-resolution": "Automatic status resolution",
  "uncatalogued-primary": "Uncatalogued primary",
  unclassified: "Unclassified",
} as const satisfies Record<EventClassId, string>;

const FORCED_TRUCE_SEPARATION_PREFIX = "forced-oversized-truce-separation-";
const KNOWN_LIFECYCLE_PRIMARY_IDS = new Set<string>([
  POISONOUS_BERRIES_JOINT_VICTORY_EVENT.id,
  PREPARED_CAVE_NIGHT_DEFINITION_ID,
]);

interface ReportConfiguration {
  halfGames: number;
  fullGames: number;
  seedPrefix: string;
  outputDirectory: string;
  overwrite: boolean;
  allowDirty: boolean;
}

interface CatalogueDefinitionMetadata {
  definitionId: string;
  expectedPools: Set<EventDistributionPoolId>;
  familyLabels: Set<string>;
}

interface MutableDiagnosticTotals {
  considered: number;
  eligible: number;
  feasible: number;
  selected: number;
  rejectionCounts: Record<EventSelectionRejectionReason, number>;
  stages: Set<string>;
}

interface MutableOutcomeMetric {
  key: string;
  normalizedText: string;
  coreEffectSignature: string;
  sampleFullEffectSignature: string;
  sampleText: string;
  selections: number;
  gamesWithOutcome: number;
  maximumSelectionsInGame: number;
  fullEffectSignatures: Set<string>;
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
  diagnosticGamesSelected: number;
  gamesConsidered: number;
  gamesEligible: number;
  gamesFeasible: number;
  gamesEligibleAndSelected: number;
  gamesFeasibleAndSelected: number;
  gamesEligibleButNotSelected: number;
  gamesFeasibleButNotSelected: number;
  outcomesByKey: Map<string, MutableOutcomeMetric>;
}

interface PerGameEventMetric {
  seed: string;
  gameSize: EventDistributionGameSizeId;
  poolId: AuditPoolId;
  eventClass: EventClassId;
  definitionId: string;
  selections: number;
}

interface PerGameOutcomeMetric extends PerGameEventMetric {
  normalizedText: string;
  coreEffectSignature: string;
  fullEffectSignatures: readonly string[];
}

interface PerGameDiagnosticMetric {
  seed: string;
  gameSize: EventDistributionGameSizeId;
  poolId: EventDistributionPoolId;
  eventClass: EventClassId;
  definitionId: string;
  actualSelections: number;
  considered: number;
  eligible: number;
  feasible: number;
  diagnosticSelected: number;
  rejectionCounts: Readonly<Record<EventSelectionRejectionReason, number>>;
  stages: readonly string[];
}

interface EventOutcomeMetric {
  key: string;
  normalizedText: string;
  coreEffectSignature: string;
  sampleFullEffectSignature: string;
  distinctFullEffectSignatures: number;
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
  eventClass: EventClassId;
  eventClassLabel: string;
  diagnosticsApplicable: boolean;
  definitionId: string;
  expectedPools: readonly EventDistributionPoolId[];
  familyLabels: readonly string[];
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
  diagnosticGamesSelected: number;
  gamesConsidered: number;
  gamesEligible: number;
  gamesFeasible: number;
  gamesEligibleAndSelected: number;
  gamesFeasibleAndSelected: number;
  gamesEligibleButNotSelected: number;
  gamesFeasibleButNotSelected: number;
  eligibilityRateWhenConsidered: number;
  feasibilityRateWhenEligible: number;
  opportunitySelectionRateWhenFeasible: number;
  gameSelectionRateWhenEligible: number;
  gameSelectionRateWhenFeasible: number;
  rejectionCounts: Readonly<Record<EventSelectionRejectionReason, number>>;
  stages: readonly string[];
  flags: readonly string[];
  outcomes: readonly EventOutcomeMetric[];
}

interface DefinitionFrequencyMetric {
  gameSize: EventDistributionGameSizeId;
  definitionId: string;
  eventClass: EventClassId;
  eventClassLabel: string;
  inActiveCatalogue: boolean;
  familyLabels: readonly string[];
  expectedPools: readonly EventDistributionPoolId[];
  auditedPools: readonly AuditPoolId[];
  observedPools: readonly AuditPoolId[];
  poolRows: number;
  games: number;
  selections: number;
  gamesWithDefinition: number;
  appearanceRate: number;
  averageSelectionsPerGame: number;
  maximumSelectionsInGame: number;
  fatalSelections: number;
  eliminations: number;
  considered: number;
  eligible: number;
  feasible: number;
  diagnosticSelected: number;
  gamesEligible: number;
  gamesFeasible: number;
  gamesEligibleButNotSelected: number;
  gamesFeasibleButNotSelected: number;
  gameSelectionRateWhenEligible: number;
  gameSelectionRateWhenFeasible: number;
  flags: readonly string[];
}

interface CatalogueCoverageMetric {
  gameSize: EventDistributionGameSizeId;
  activeCatalogueDefinitions: number;
  activeCataloguePoolRows: number;
  auditedCataloguePoolRows: number;
  selectedCatalogueDefinitions: number;
  neverSelectedCatalogueDefinitions: readonly string[];
  feasibleNeverSelectedCatalogueDefinitions: readonly string[];
  eligibleNeverFeasibleCatalogueDefinitions: readonly string[];
  missingCataloguePoolRows: readonly {
    definitionId: string;
    poolId: EventDistributionPoolId;
  }[];
  selectedOutsideActiveCatalogue: readonly string[];
}

interface FrequencyReportData {
  generatedAt: string;
  provenance: EventFrequencyReportProvenance;
  configuration: ReportConfiguration;
  methodology: {
    selectionFrequency: string;
    eligibility: string;
    lifecycleSeparation: string;
    outcomeGrouping: string;
    catalogueCoverage: string;
    selectionFunnel: string;
    rosterStrategyEvidence: string;
    prerequisiteLifecycleEvidence: string;
  };
  distributionMetrics: EventDistributionMetrics;
  selectionFunnel: EventSelectionFunnelReport;
  rosterStrategyEvidence: RosterStrategyEvidenceReport;
  prerequisiteLifecycleEvidence: PrerequisiteLifecycleEvidenceReport;
  catalogueCoverage: readonly CatalogueCoverageMetric[];
  definitions: readonly DefinitionFrequencyMetric[];
  events: readonly EventFrequencyMetric[];
}

interface MutableRunOutcomeCount {
  metricKey: string;
  outcomeKey: string;
  count: number;
  fullEffectSignatures: Set<string>;
}

const catalogueMetadataByDefinitionId = new Map<string, CatalogueDefinitionMetadata>();

function registerCatalogueDefinition({
  definition,
  familyLabel,
  expectedPools,
}: {
  definition: EventDefinition;
  familyLabel: string;
  expectedPools: readonly EventDistributionPoolId[];
}): void {
  const metadata = catalogueMetadataByDefinitionId.get(definition.id) ?? {
    definitionId: definition.id,
    expectedPools: new Set<EventDistributionPoolId>(),
    familyLabels: new Set<string>(),
  };

  for (const poolId of expectedPools) {
    metadata.expectedPools.add(poolId);
  }

  metadata.familyLabels.add(familyLabel);
  catalogueMetadataByDefinitionId.set(definition.id, metadata);
}

for (const family of BLOODBATH_EVENT_CATALOGUE_FAMILIES) {
  const poolId: EventDistributionPoolId =
    family.name === "flee" ? "bloodbath-flee" : "bloodbath-cornucopia";

  for (const definition of family.events as readonly EventDefinition[]) {
    registerCatalogueDefinition({
      definition,
      familyLabel: `Bloodbath — ${family.name}`,
      expectedPools: [poolId],
    });
  }
}

for (const family of ORDINARY_EVENT_CATALOGUE_FAMILIES) {
  for (const definition of family.events as readonly EventDefinition[]) {
    const expectedPools: EventDistributionPoolId[] = [];

    if (definition.periods.includes("day")) {
      expectedPools.push("later-day");
    }

    if (definition.periods.includes("night")) {
      expectedPools.push("night");
    }

    registerCatalogueDefinition({
      definition,
      familyLabel: family.name,
      expectedPools,
    });
  }
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

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
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
    overwrite: hasFlag("overwrite"),
    allowDirty: hasFlag("allow-dirty"),
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
  console.log(`Usage: tsx scripts/generate-event-frequency-report.ts [options]

Options:
  --half-games <count>       Half Games to simulate (default: ${DEFAULT_HALF_GAMES})
  --full-games <count>       Full Games to simulate (default: ${DEFAULT_FULL_GAMES})
  --seed-prefix <prefix>     Deterministic seed prefix
  --output-directory <path>  Report directory (default: ${DEFAULT_OUTPUT_DIRECTORY})
  --overwrite                Explicitly replace a nonempty report directory
  --allow-dirty               Permit a non-baseline smoke audit from a dirty tree
  --help                     Show this help
`);
}

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function sortedCopy<T>(
  values: readonly T[],
  compareFunction?: (first: T, second: T) => number,
): T[] {
  const copy = Array.from(values);

  copy.sort(compareFunction);

  return copy;
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

function isLifecyclePrimaryDefinition(definitionId: string): boolean {
  return (
    definitionId.startsWith(FORCED_TRUCE_SEPARATION_PREFIX) ||
    KNOWN_LIFECYCLE_PRIMARY_IDS.has(definitionId)
  );
}

function classifyEventClass({
  poolId,
  definitionId,
  kinds,
}: {
  poolId: AuditPoolId;
  definitionId: string;
  kinds?: ReadonlySet<ResolvedEvent["kind"]> | readonly ResolvedEvent["kind"][];
}): EventClassId {
  if (poolId === "automatic-preparation") {
    return "automatic-preparation";
  }

  if (poolId === "automatic-aftermath") {
    return "automatic-aftermath";
  }

  if (poolId === "automatic-status-resolution") {
    return "automatic-status-resolution";
  }

  if (isLifecyclePrimaryDefinition(definitionId)) {
    return "lifecycle-primary";
  }

  if (catalogueMetadataByDefinitionId.has(definitionId)) {
    return "weighted-authored";
  }

  const kindValues = kinds ? [...kinds] : [];

  if (kindValues.includes("primary")) {
    return "uncatalogued-primary";
  }

  return poolId === "unclassified" ? "unclassified" : "uncatalogued-primary";
}

function createMetricKey(
  gameSize: EventDistributionGameSizeId,
  poolId: AuditPoolId,
  definitionId: string,
): string {
  return [gameSize, poolId, definitionId].join("\u0000");
}

function createDefinitionKey(gameSize: EventDistributionGameSizeId, definitionId: string): string {
  return [gameSize, definitionId].join("\u0000");
}

function createDefinitionGameKey(
  gameSize: EventDistributionGameSizeId,
  definitionId: string,
  seed: string,
): string {
  return [gameSize, definitionId, seed].join("\u0000");
}

function createOutcomeKey(normalizedText: string, coreEffectSignature: string): string {
  return `${normalizedText}\u0000${coreEffectSignature}`;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceWholeTermCaseInsensitive(text: string, value: string, replacement: string): string {
  if (value.length === 0) {
    return text;
  }

  const escapedValue = escapeRegularExpression(value);

  return text.replace(
    new RegExp(`(?<![\\p{L}\\p{N}])${escapedValue}(?![\\p{L}\\p{N}])`, "giu"),
    replacement,
  );
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
    normalized = replaceWholeTermCaseInsensitive(
      normalized,
      replacement.value,
      replacement.replacement,
    );
  }

  for (const label of ITEM_LABELS) {
    normalized = replaceWholeTermCaseInsensitive(normalized, label, "{item}");
  }

  for (const label of STATUS_LABELS) {
    normalized = replaceWholeTermCaseInsensitive(normalized, label, "{status}");
  }

  for (const pronoun of PRONOUN_WORDS) {
    normalized = replaceWholeTermCaseInsensitive(normalized, pronoun, "{pronoun}");
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

function createFullEffectSignature(
  event: ResolvedEvent,
  itemDefinitionByInstanceId: ReadonlyMap<string, string>,
): string {
  const descriptions = event.changes.map((change) =>
    describeChange(change, itemDefinitionByInstanceId),
  );

  return descriptions.length === 0 ? "no-changes" : descriptions.sort().join("; ");
}

function isIncidentalCoreChange(
  change: GameChange,
  eliminatedTributeIds: ReadonlySet<string>,
): boolean {
  if (change.type === "increment-statistic") {
    return true;
  }

  if (change.type === "remove-status" && eliminatedTributeIds.has(change.tributeId)) {
    return true;
  }

  if (change.type === "transfer-item" && eliminatedTributeIds.has(change.fromTributeId)) {
    return true;
  }

  if (change.type === "destroy-item" && eliminatedTributeIds.has(change.tributeId)) {
    return true;
  }

  return false;
}

function createCoreEffectSignature(
  event: ResolvedEvent,
  itemDefinitionByInstanceId: ReadonlyMap<string, string>,
): string {
  const eliminatedTributeIds = new Set(
    event.changes.flatMap((change) =>
      change.type === "eliminate-tribute" ? [change.tributeId] : [],
    ),
  );
  const descriptions = event.changes
    .filter((change) => !isIncidentalCoreChange(change, eliminatedTributeIds))
    .map((change) => describeChange(change, itemDefinitionByInstanceId))
    .sort();

  return descriptions.length === 0 ? "no-core-changes" : descriptions.join("; ");
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
    diagnosticGamesSelected: 0,
    gamesConsidered: 0,
    gamesEligible: 0,
    gamesFeasible: 0,
    gamesEligibleAndSelected: 0,
    gamesFeasibleAndSelected: 0,
    gamesEligibleButNotSelected: 0,
    gamesFeasibleButNotSelected: 0,
    outcomesByKey: new Map<string, MutableOutcomeMetric>(),
    ...createDiagnosticTotals(),
  };

  metricsByKey.set(key, created);
  return created;
}

function seedActiveCatalogueMetrics(
  metricsByKey: Map<string, MutableEventMetric>,
  configuration: ReportConfiguration,
): void {
  const activeGameSizes = EVENT_DISTRIBUTION_GAME_SIZE_IDS.filter(
    (gameSize) =>
      (gameSize === "half-game" ? configuration.halfGames : configuration.fullGames) > 0,
  );

  for (const gameSize of activeGameSizes) {
    for (const metadata of catalogueMetadataByDefinitionId.values()) {
      for (const poolId of metadata.expectedPools) {
        getOrCreateEventMetric(metricsByKey, gameSize, poolId, metadata.definitionId);
      }
    }
  }
}

function addRunEvents(
  metricsByKey: Map<string, MutableEventMetric>,
  poolSelectionsByKey: Map<string, number>,
  perGameEvents: PerGameEventMetric[],
  perGameOutcomes: PerGameOutcomeMetric[],
  run: SimulationRun,
): Map<string, number> {
  const gameSize = getGameSize(run);
  const itemDefinitionByInstanceId = createItemDefinitionLookup(run);
  const eventCounts = new Map<string, number>();
  const outcomeCounts = new Map<string, MutableRunOutcomeCount>();

  for (const event of run.state.eventHistory) {
    const poolId = classifyEventPool(event);
    const metricKey = createMetricKey(gameSize, poolId, event.definitionId);
    const metric = getOrCreateEventMetric(metricsByKey, gameSize, poolId, event.definitionId);
    const poolKey = `${gameSize}\u0000${poolId}`;
    const eliminationCount = event.changes.filter(
      (change) => change.type === "eliminate-tribute",
    ).length;
    const normalizedText = normalizeEventText(run, event);
    const coreEffectSignature = createCoreEffectSignature(event, itemDefinitionByInstanceId);
    const fullEffectSignature = createFullEffectSignature(event, itemDefinitionByInstanceId);
    const outcomeKey = createOutcomeKey(normalizedText, coreEffectSignature);
    const mutableOutcome = metric.outcomesByKey.get(outcomeKey) ?? {
      key: outcomeKey,
      normalizedText,
      coreEffectSignature,
      sampleFullEffectSignature: fullEffectSignature,
      sampleText: event.text,
      selections: 0,
      gamesWithOutcome: 0,
      maximumSelectionsInGame: 0,
      fullEffectSignatures: new Set<string>(),
    };

    metric.kinds.add(event.kind);
    metric.selections += 1;
    metric.eliminations += eliminationCount;

    if (eliminationCount > 0) {
      metric.fatalSelections += 1;
    }

    mutableOutcome.selections += 1;
    mutableOutcome.fullEffectSignatures.add(fullEffectSignature);
    metric.outcomesByKey.set(outcomeKey, mutableOutcome);

    eventCounts.set(metricKey, (eventCounts.get(metricKey) ?? 0) + 1);

    const runOutcomeKey = `${metricKey}\u0000${outcomeKey}`;
    const runOutcome = outcomeCounts.get(runOutcomeKey) ?? {
      metricKey,
      outcomeKey,
      count: 0,
      fullEffectSignatures: new Set<string>(),
    };

    runOutcome.count += 1;
    runOutcome.fullEffectSignatures.add(fullEffectSignature);
    outcomeCounts.set(runOutcomeKey, runOutcome);
    poolSelectionsByKey.set(poolKey, (poolSelectionsByKey.get(poolKey) ?? 0) + 1);
  }

  for (const [metricKey, count] of eventCounts) {
    const eventMetric = metricsByKey.get(metricKey);

    if (eventMetric === undefined) {
      continue;
    }

    eventMetric.gamesWithEvent += 1;
    eventMetric.maximumSelectionsInGame = Math.max(eventMetric.maximumSelectionsInGame, count);

    perGameEvents.push({
      seed: run.seed,
      gameSize: eventMetric.gameSize,
      poolId: eventMetric.poolId,
      eventClass: classifyEventClass({
        poolId: eventMetric.poolId,
        definitionId: eventMetric.definitionId,
        kinds: eventMetric.kinds,
      }),
      definitionId: eventMetric.definitionId,
      selections: count,
    });
  }

  for (const runOutcome of outcomeCounts.values()) {
    const eventMetric = metricsByKey.get(runOutcome.metricKey);

    if (eventMetric === undefined) {
      continue;
    }

    const outcomeMetric = eventMetric.outcomesByKey.get(runOutcome.outcomeKey);

    if (outcomeMetric === undefined) {
      continue;
    }

    outcomeMetric.gamesWithOutcome += 1;
    outcomeMetric.maximumSelectionsInGame = Math.max(
      outcomeMetric.maximumSelectionsInGame,
      runOutcome.count,
    );

    perGameOutcomes.push({
      seed: run.seed,
      gameSize: eventMetric.gameSize,
      poolId: eventMetric.poolId,
      eventClass: classifyEventClass({
        poolId: eventMetric.poolId,
        definitionId: eventMetric.definitionId,
        kinds: eventMetric.kinds,
      }),
      definitionId: eventMetric.definitionId,
      selections: runOutcome.count,
      normalizedText: outcomeMetric.normalizedText,
      coreEffectSignature: outcomeMetric.coreEffectSignature,
      fullEffectSignatures: sortedCopy([...runOutcome.fullEffectSignatures]),
    });
  }

  return eventCounts;
}

function addRunDiagnostics(
  metricsByKey: Map<string, MutableEventMetric>,
  perGameDiagnostics: PerGameDiagnosticMetric[],
  actualSelectionsByMetricKey: ReadonlyMap<string, number>,
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

    const typedGameSize = gameSizeId as EventDistributionGameSizeId;
    const typedPoolId = poolId as EventDistributionPoolId;
    const metric = getOrCreateEventMetric(metricsByKey, typedGameSize, typedPoolId, definitionId);
    const actualSelections = actualSelectionsByMetricKey.get(metricKey) ?? 0;
    const selectedInGame = actualSelections > 0;

    metric.considered += runTotals.considered;
    metric.eligible += runTotals.eligible;
    metric.feasible += runTotals.feasible;
    metric.selected += runTotals.selected;

    if (runTotals.considered > 0) {
      metric.gamesConsidered += 1;
    }

    if (runTotals.eligible > 0) {
      metric.gamesEligible += 1;

      if (selectedInGame) {
        metric.gamesEligibleAndSelected += 1;
      } else {
        metric.gamesEligibleButNotSelected += 1;
      }
    }

    if (runTotals.feasible > 0) {
      metric.gamesFeasible += 1;

      if (selectedInGame) {
        metric.gamesFeasibleAndSelected += 1;
      } else {
        metric.gamesFeasibleButNotSelected += 1;
      }
    }

    if (runTotals.selected > 0) {
      metric.diagnosticGamesSelected += 1;
    }

    for (const reason of EVENT_SELECTION_REJECTION_REASONS) {
      metric.rejectionCounts[reason] += runTotals.rejectionCounts[reason];
    }

    for (const stage of runTotals.stages) {
      metric.stages.add(stage);
    }

    perGameDiagnostics.push({
      seed: run.seed,
      gameSize: typedGameSize,
      poolId: typedPoolId,
      eventClass: classifyEventClass({
        poolId: typedPoolId,
        definitionId,
        kinds: metric.kinds,
      }),
      definitionId,
      actualSelections,
      considered: runTotals.considered,
      eligible: runTotals.eligible,
      feasible: runTotals.feasible,
      diagnosticSelected: runTotals.selected,
      rejectionCounts: { ...runTotals.rejectionCounts },
      stages: [...runTotals.stages].sort(),
    });
  }
}

function getEventFlags(metric: Omit<EventFrequencyMetric, "flags" | "outcomes">): string[] {
  if (!metric.diagnosticsApplicable) {
    return [];
  }

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

  if (metric.gamesFeasible >= 50 && metric.gameSelectionRateWhenFeasible < 0.02) {
    flags.push("very-low-game-selection-conversion");
  }

  if (metric.feasible >= 100 && metric.opportunitySelectionRateWhenFeasible < 0.01) {
    flags.push("very-low-opportunity-selection-conversion");
  }

  if (metric.poolSelectionShare >= 0.05) {
    flags.push("high-pool-share");
  }

  if (metric.appearanceRate >= 0.5 && metric.poolSelectionShare >= 0.05) {
    flags.push("high-game-appearance");
  }

  if (metric.selections !== metric.diagnosticSelected) {
    flags.push("diagnostic-selection-mismatch");
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
      const eventClass = classifyEventClass({
        poolId: metric.poolId,
        definitionId: metric.definitionId,
        kinds: metric.kinds,
      });
      const diagnosticsApplicable = eventClass === "weighted-authored";
      const catalogueMetadata = catalogueMetadataByDefinitionId.get(metric.definitionId);
      const baseMetric = {
        gameSize: metric.gameSize,
        poolId: metric.poolId,
        poolLabel: AUDIT_POOL_LABELS[metric.poolId],
        eventClass,
        eventClassLabel: EVENT_CLASS_LABELS[eventClass],
        diagnosticsApplicable,
        definitionId: metric.definitionId,
        expectedPools: catalogueMetadata ? [...catalogueMetadata.expectedPools].sort() : [],
        familyLabels: catalogueMetadata ? [...catalogueMetadata.familyLabels].sort() : [],
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
        diagnosticGamesSelected: metric.diagnosticGamesSelected,
        gamesConsidered: metric.gamesConsidered,
        gamesEligible: metric.gamesEligible,
        gamesFeasible: metric.gamesFeasible,
        gamesEligibleAndSelected: metric.gamesEligibleAndSelected,
        gamesFeasibleAndSelected: metric.gamesFeasibleAndSelected,
        gamesEligibleButNotSelected: metric.gamesEligibleButNotSelected,
        gamesFeasibleButNotSelected: metric.gamesFeasibleButNotSelected,
        eligibilityRateWhenConsidered: divide(metric.eligible, metric.considered),
        feasibilityRateWhenEligible: divide(metric.feasible, metric.eligible),
        opportunitySelectionRateWhenFeasible: divide(metric.selected, metric.feasible),
        gameSelectionRateWhenEligible: divide(
          metric.gamesEligibleAndSelected,
          metric.gamesEligible,
        ),
        gameSelectionRateWhenFeasible: divide(
          metric.gamesFeasibleAndSelected,
          metric.gamesFeasible,
        ),
        rejectionCounts: { ...metric.rejectionCounts },
        stages: [...metric.stages].sort(),
      };
      const outcomes = [...metric.outcomesByKey.values()]
        .map((outcome): EventOutcomeMetric => ({
          key: outcome.key,
          normalizedText: outcome.normalizedText,
          coreEffectSignature: outcome.coreEffectSignature,
          sampleFullEffectSignature: outcome.sampleFullEffectSignature,
          distinctFullEffectSignatures: outcome.fullEffectSignatures.size,
          sampleText: outcome.sampleText,
          selections: outcome.selections,
          gamesWithOutcome: outcome.gamesWithOutcome,
          appearanceRate: divide(outcome.gamesWithOutcome, games),
          eventSelectionShare: divide(outcome.selections, metric.selections),
          maximumSelectionsInGame: outcome.maximumSelectionsInGame,
        }))
        .sort(
          (first, second) =>
            second.selections - first.selections ||
            first.normalizedText.localeCompare(second.normalizedText),
        );

      return {
        ...baseMetric,
        flags: getEventFlags(baseMetric),
        outcomes,
      };
    })
    .sort(
      (first, second) =>
        first.gameSize.localeCompare(second.gameSize) ||
        AUDIT_POOL_IDS.indexOf(first.poolId) - AUDIT_POOL_IDS.indexOf(second.poolId) ||
        first.eventClass.localeCompare(second.eventClass) ||
        second.selections - first.selections ||
        first.definitionId.localeCompare(second.definitionId),
    );
}

function getDefinitionFlags(metric: Omit<DefinitionFrequencyMetric, "flags">): string[] {
  const flags: string[] = [];

  if (metric.selections === 0) {
    flags.push("never-selected");
  }

  if (metric.feasible > 0 && metric.selections === 0) {
    flags.push("feasible-never-selected");
  }

  if (metric.eligible > 0 && metric.feasible === 0) {
    flags.push("eligible-never-feasible");
  }

  if (metric.considered > 0 && metric.eligible === 0) {
    flags.push("never-eligible");
  }

  if (!metric.inActiveCatalogue) {
    flags.push("outside-active-catalogue");
  }

  return flags;
}

function chooseDefinitionEventClass(events: readonly EventFrequencyMetric[]): EventClassId {
  for (const eventClass of EVENT_CLASS_IDS) {
    if (events.some((event) => event.eventClass === eventClass)) {
      return eventClass;
    }
  }

  return "unclassified";
}

function createDefinitionMetrics({
  configuration,
  events,
  perGameEvents,
  perGameDiagnostics,
}: {
  configuration: ReportConfiguration;
  events: readonly EventFrequencyMetric[];
  perGameEvents: readonly PerGameEventMetric[];
  perGameDiagnostics: readonly PerGameDiagnosticMetric[];
}): DefinitionFrequencyMetric[] {
  const gamesBySize = {
    "half-game": configuration.halfGames,
    "full-game": configuration.fullGames,
  } satisfies Record<EventDistributionGameSizeId, number>;
  const eventRowsByDefinitionKey = new Map<string, EventFrequencyMetric[]>();
  const selectionCountsByDefinitionGameKey = new Map<string, number>();
  const eligibleGamesByDefinitionKey = new Map<string, Set<string>>();
  const feasibleGamesByDefinitionKey = new Map<string, Set<string>>();

  for (const event of events) {
    const key = createDefinitionKey(event.gameSize, event.definitionId);
    const rows = eventRowsByDefinitionKey.get(key) ?? [];

    rows.push(event);
    eventRowsByDefinitionKey.set(key, rows);
  }

  for (const event of perGameEvents) {
    const key = createDefinitionGameKey(event.gameSize, event.definitionId, event.seed);

    selectionCountsByDefinitionGameKey.set(
      key,
      (selectionCountsByDefinitionGameKey.get(key) ?? 0) + event.selections,
    );
  }

  for (const diagnostic of perGameDiagnostics) {
    const definitionKey = createDefinitionKey(diagnostic.gameSize, diagnostic.definitionId);

    if (diagnostic.eligible > 0) {
      const eligibleSeeds = eligibleGamesByDefinitionKey.get(definitionKey) ?? new Set<string>();

      eligibleSeeds.add(diagnostic.seed);
      eligibleGamesByDefinitionKey.set(definitionKey, eligibleSeeds);
    }

    if (diagnostic.feasible > 0) {
      const feasibleSeeds = feasibleGamesByDefinitionKey.get(definitionKey) ?? new Set<string>();

      feasibleSeeds.add(diagnostic.seed);
      feasibleGamesByDefinitionKey.set(definitionKey, feasibleSeeds);
    }
  }

  return [...eventRowsByDefinitionKey.entries()]
    .map(([definitionKey, definitionEvents]): DefinitionFrequencyMetric => {
      const firstEvent = definitionEvents[0];

      if (!firstEvent) {
        throw new Error(`Missing event rows for definition key "${definitionKey}".`);
      }

      const games = gamesBySize[firstEvent.gameSize];
      const selectedGameCounts = [...selectionCountsByDefinitionGameKey.entries()]
        .filter(([key]) => key.startsWith(`${definitionKey}\u0000`))
        .map(([, count]) => count);
      const selectedSeeds = new Set(
        [...selectionCountsByDefinitionGameKey.keys()]
          .filter((key) => key.startsWith(`${definitionKey}\u0000`))
          .map((key) => key.slice(definitionKey.length + 1)),
      );
      const eligibleSeeds = eligibleGamesByDefinitionKey.get(definitionKey) ?? new Set<string>();
      const feasibleSeeds = feasibleGamesByDefinitionKey.get(definitionKey) ?? new Set<string>();
      const catalogueMetadata = catalogueMetadataByDefinitionId.get(firstEvent.definitionId);
      const eventClass = chooseDefinitionEventClass(definitionEvents);
      const baseMetric = {
        gameSize: firstEvent.gameSize,
        definitionId: firstEvent.definitionId,
        eventClass,
        eventClassLabel: EVENT_CLASS_LABELS[eventClass],
        inActiveCatalogue: catalogueMetadata !== undefined,
        familyLabels: catalogueMetadata ? [...catalogueMetadata.familyLabels].sort() : [],
        expectedPools: catalogueMetadata ? [...catalogueMetadata.expectedPools].sort() : [],
        auditedPools: [...new Set(definitionEvents.map((event) => event.poolId))].sort(),
        observedPools: [
          ...new Set(
            definitionEvents.filter((event) => event.selections > 0).map((event) => event.poolId),
          ),
        ].sort(),
        poolRows: definitionEvents.length,
        games,
        selections: definitionEvents.reduce((total, event) => total + event.selections, 0),
        gamesWithDefinition: selectedSeeds.size,
        appearanceRate: divide(selectedSeeds.size, games),
        averageSelectionsPerGame: divide(
          definitionEvents.reduce((total, event) => total + event.selections, 0),
          games,
        ),
        maximumSelectionsInGame:
          selectedGameCounts.length === 0 ? 0 : Math.max(...selectedGameCounts),
        fatalSelections: definitionEvents.reduce(
          (total, event) => total + event.fatalSelections,
          0,
        ),
        eliminations: definitionEvents.reduce((total, event) => total + event.eliminations, 0),
        considered: definitionEvents.reduce((total, event) => total + event.considered, 0),
        eligible: definitionEvents.reduce((total, event) => total + event.eligible, 0),
        feasible: definitionEvents.reduce((total, event) => total + event.feasible, 0),
        diagnosticSelected: definitionEvents.reduce(
          (total, event) => total + event.diagnosticSelected,
          0,
        ),
        gamesEligible: eligibleSeeds.size,
        gamesFeasible: feasibleSeeds.size,
        gamesEligibleButNotSelected: [...eligibleSeeds].filter((seed) => !selectedSeeds.has(seed))
          .length,
        gamesFeasibleButNotSelected: [...feasibleSeeds].filter((seed) => !selectedSeeds.has(seed))
          .length,
        gameSelectionRateWhenEligible: divide(
          [...eligibleSeeds].filter((seed) => selectedSeeds.has(seed)).length,
          eligibleSeeds.size,
        ),
        gameSelectionRateWhenFeasible: divide(
          [...feasibleSeeds].filter((seed) => selectedSeeds.has(seed)).length,
          feasibleSeeds.size,
        ),
      };

      return {
        ...baseMetric,
        flags: getDefinitionFlags(baseMetric),
      };
    })
    .sort(
      (first, second) =>
        first.gameSize.localeCompare(second.gameSize) ||
        first.eventClass.localeCompare(second.eventClass) ||
        second.selections - first.selections ||
        first.definitionId.localeCompare(second.definitionId),
    );
}

function createCatalogueCoverage(
  definitions: readonly DefinitionFrequencyMetric[],
  events: readonly EventFrequencyMetric[],
): CatalogueCoverageMetric[] {
  const activeGameSizes = EVENT_DISTRIBUTION_GAME_SIZE_IDS.filter((gameSize) =>
    definitions.some((definition) => definition.gameSize === gameSize),
  );

  return activeGameSizes.map((gameSize): CatalogueCoverageMetric => {
    const gameDefinitions = definitions.filter((definition) => definition.gameSize === gameSize);
    const gameEvents = events.filter((event) => event.gameSize === gameSize);
    const catalogueDefinitions = gameDefinitions.filter(
      (definition) => definition.inActiveCatalogue,
    );
    const missingCataloguePoolRows = [...catalogueMetadataByDefinitionId.values()].flatMap(
      (metadata) =>
        [...metadata.expectedPools].flatMap((poolId) =>
          gameEvents.some(
            (event) => event.definitionId === metadata.definitionId && event.poolId === poolId,
          )
            ? []
            : [
                {
                  definitionId: metadata.definitionId,
                  poolId,
                },
              ],
        ),
    );

    return {
      gameSize,
      activeCatalogueDefinitions: catalogueMetadataByDefinitionId.size,
      activeCataloguePoolRows: [...catalogueMetadataByDefinitionId.values()].reduce(
        (total, metadata) => total + metadata.expectedPools.size,
        0,
      ),
      auditedCataloguePoolRows: gameEvents.filter(
        (event) =>
          catalogueMetadataByDefinitionId
            .get(event.definitionId)
            ?.expectedPools.has(event.poolId as EventDistributionPoolId) ?? false,
      ).length,
      selectedCatalogueDefinitions: catalogueDefinitions.filter(
        (definition) => definition.selections > 0,
      ).length,
      neverSelectedCatalogueDefinitions: catalogueDefinitions
        .filter((definition) => definition.selections === 0)
        .map((definition) => definition.definitionId)
        .sort(),
      feasibleNeverSelectedCatalogueDefinitions: catalogueDefinitions
        .filter((definition) => definition.feasible > 0 && definition.selections === 0)
        .map((definition) => definition.definitionId)
        .sort(),
      eligibleNeverFeasibleCatalogueDefinitions: catalogueDefinitions
        .filter(
          (definition) =>
            definition.eligible > 0 && definition.feasible === 0 && definition.selections === 0,
        )
        .map((definition) => definition.definitionId)
        .sort(),
      missingCataloguePoolRows: missingCataloguePoolRows.sort(
        (first, second) =>
          first.poolId.localeCompare(second.poolId) ||
          first.definitionId.localeCompare(second.definitionId),
      ),
      selectedOutsideActiveCatalogue: gameDefinitions
        .filter((definition) => !definition.inActiveCatalogue && definition.selections > 0)
        .map((definition) => definition.definitionId)
        .sort(),
    };
  });
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

function formatDefinitionIdList(definitionIds: readonly string[]): string[] {
  return definitionIds.length === 0
    ? ["- None"]
    : definitionIds.map((definitionId) => `- \`${definitionId}\``);
}

function createUniqueDefinitionSummary(
  definitions: readonly DefinitionFrequencyMetric[],
): string[] {
  const selected = definitions.filter((definition) => definition.selections > 0);
  const neverSelected = definitions.filter((definition) => definition.selections === 0);
  const feasibleNeverSelected = definitions.filter(
    (definition) => definition.feasible > 0 && definition.selections === 0,
  );
  const highAppearance = definitions.filter((definition) => definition.appearanceRate >= 0.5);

  return [
    "### Unique-definition summary",
    "",
    `- Unique definition IDs audited: ${definitions.length}`,
    `- Selected at least once: ${selected.length}`,
    `- Never selected: ${neverSelected.length}`,
    `- Feasible at least once but never selected: ${feasibleNeverSelected.length}`,
    `- Appeared in at least half of games: ${highAppearance.length}`,
    "",
    "| Event class | Unique IDs | Selected IDs | Selections |",
    "| --- | ---: | ---: | ---: |",
    ...EVENT_CLASS_IDS.flatMap((eventClass) => {
      const classDefinitions = definitions.filter(
        (definition) => definition.eventClass === eventClass,
      );

      return classDefinitions.length === 0
        ? []
        : [
            `| ${EVENT_CLASS_LABELS[eventClass]} | ${classDefinitions.length} | ${
              classDefinitions.filter((definition) => definition.selections > 0).length
            } | ${classDefinitions.reduce(
              (total, definition) => total + definition.selections,
              0,
            )} |`,
          ];
    }),
    "",
  ];
}

function createCatalogueCoverageSection(coverage: CatalogueCoverageMetric): string[] {
  return [
    "### Active catalogue coverage",
    "",
    "This section validates the definitions exported through the active catalogue families. It cannot discover dormant definitions that exist in source files but are not exported by those families.",
    "",
    `- Active catalogue definitions: ${coverage.activeCatalogueDefinitions}`,
    `- Expected catalogue pool rows: ${coverage.activeCataloguePoolRows}`,
    `- Audited catalogue pool rows: ${coverage.auditedCataloguePoolRows}`,
    `- Catalogue definitions selected at least once: ${coverage.selectedCatalogueDefinitions}`,
    `- Catalogue definitions never selected: ${coverage.neverSelectedCatalogueDefinitions.length}`,
    `- Catalogue definitions feasible but never selected: ${coverage.feasibleNeverSelectedCatalogueDefinitions.length}`,
    `- Catalogue definitions eligible but never feasible: ${coverage.eligibleNeverFeasibleCatalogueDefinitions.length}`,
    `- Missing expected catalogue pool rows: ${coverage.missingCataloguePoolRows.length}`,
    "",
    ...(coverage.missingCataloguePoolRows.length > 0
      ? [
          "Missing expected catalogue pool rows:",
          "",
          ...coverage.missingCataloguePoolRows.map(
            (row) => `- \`${row.definitionId}\` in \`${row.poolId}\``,
          ),
          "",
        ]
      : []),
    "Selected definitions outside the active authored catalogue:",
    "",
    ...formatDefinitionIdList(coverage.selectedOutsideActiveCatalogue),
    "",
  ];
}

function createWeightedEventTable(events: readonly EventFrequencyMetric[]): string[] {
  return [
    "| Event | Selected | Games | Appearance | Pool share | Eligible games | Feasible games | Feasible but not selected | Game selected/feasible | Opportunity selected/feasible | Flags |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...(events.length > 0
      ? events.map(
          (event) =>
            `| \`${escapeMarkdownCell(event.definitionId)}\` | ${event.selections} | ${
              event.gamesWithEvent
            } | ${formatRate(event.appearanceRate)} | ${formatRate(
              event.poolSelectionShare,
            )} | ${event.gamesEligible} | ${event.gamesFeasible} | ${
              event.gamesFeasibleButNotSelected
            } | ${formatRate(event.gameSelectionRateWhenFeasible)} | ${formatRate(
              event.opportunitySelectionRateWhenFeasible,
            )} | ${event.flags.length > 0 ? event.flags.join(", ") : "—"} |`,
        )
      : ["| _No weighted events_ | 0 | 0 | 0.0% | 0.0% | 0 | 0 | 0 | 0.0% | 0.0% | — |"]),
    "",
  ];
}

function createLifecycleEventTable(events: readonly EventFrequencyMetric[]): string[] {
  return [
    "| Event | Pool | Selected | Games | Appearance | Avg/game | Max/game | Event class |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...(events.length > 0
      ? events.map(
          (event) =>
            `| \`${escapeMarkdownCell(event.definitionId)}\` | ${event.poolLabel} | ${
              event.selections
            } | ${event.gamesWithEvent} | ${formatRate(
              event.appearanceRate,
            )} | ${formatNumber(event.averageSelectionsPerGame)} | ${
              event.maximumSelectionsInGame
            } | ${event.eventClassLabel} |`,
        )
      : ["| _No lifecycle events_ | — | 0 | 0 | 0.0% | 0.00 | 0 | — |"]),
    "",
  ];
}

function createDiagnosticBottleneckTable(events: readonly EventFrequencyMetric[]): string[] {
  const flaggedEvents = events.filter(
    (event) =>
      event.flags.includes("never-eligible") ||
      event.flags.includes("eligible-never-feasible") ||
      event.flags.includes("feasible-never-selected") ||
      event.flags.includes("very-low-game-selection-conversion") ||
      event.flags.includes("very-low-opportunity-selection-conversion") ||
      event.flags.includes("diagnostic-selection-mismatch"),
  );

  return [
    "#### Selection bottlenecks",
    "",
    "| Event | Considered | Eligible | Feasible | Actual selected | Diagnostic selected | Eligible games | Feasible games | Game conversion | Top rejection | Flags |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...(flaggedEvents.length > 0
      ? flaggedEvents.map(
          (event) =>
            `| \`${escapeMarkdownCell(event.definitionId)}\` | ${event.considered} | ${
              event.eligible
            } | ${event.feasible} | ${event.selections} | ${event.diagnosticSelected} | ${
              event.gamesEligible
            } | ${event.gamesFeasible} | ${formatRate(
              event.gameSelectionRateWhenFeasible,
            )} | ${escapeMarkdownCell(getTopRejection(event))} | ${event.flags.join(", ")} |`,
        )
      : [
          "| _No bottlenecks detected by the default thresholds_ | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0% | — | — |",
        ]),
    "",
  ];
}

function createOutcomeSections(events: readonly EventFrequencyMetric[]): string[] {
  const multipleOutcomeEvents = events.filter((event) => event.outcomes.length > 1);

  if (multipleOutcomeEvents.length === 0) {
    return ["#### Multiple observed core outcomes", "", "None observed.", ""];
  }

  return [
    "#### Multiple observed core outcomes",
    "",
    "Core variants use whole-term-safe normalized wording plus a mechanical signature that omits routine statistic increments, status cleanup on eliminated tributes, and death-loot transfer/destruction. The full resolved signatures remain counted so state-dependent permutations are still visible without splitting the core outcome.",
    "",
    ...multipleOutcomeEvents.flatMap((event) => [
      `##### \`${event.definitionId}\``,
      "",
      "| Variant | Selections | Event share | Games | Full-effect permutations | Core effects | Normalized wording |",
      "| ---: | ---: | ---: | ---: | ---: | --- | --- |",
      ...event.outcomes.map(
        (outcome, index) =>
          `| ${index + 1} | ${outcome.selections} | ${formatRate(
            outcome.eventSelectionShare,
          )} | ${outcome.gamesWithOutcome} | ${outcome.distinctFullEffectSignatures} | ${escapeMarkdownCell(
            truncate(outcome.coreEffectSignature, 180),
          )} | ${escapeMarkdownCell(truncate(outcome.normalizedText, 260))} |`,
      ),
      "",
    ]),
  ];
}

function createPoolDiagnosticsSummary(
  metrics: EventDistributionMetrics,
  gameSize: EventDistributionGameSizeId,
  poolId: EventDistributionPoolId,
  weightedEvents: readonly EventFrequencyMetric[],
  lifecycleEvents: readonly EventFrequencyMetric[],
): string[] {
  const pool = metrics.gameSizes[gameSize].pools[poolId];
  const diagnostics = pool.selectionDiagnostics;

  return [
    `- Total primary selections: ${pool.totalSelections}`,
    `- Weighted authored selections in this audit: ${weightedEvents.reduce(
      (total, event) => total + event.selections,
      0,
    )}`,
    `- Lifecycle-primary selections kept separate: ${lifecycleEvents.reduce(
      (total, event) => total + event.selections,
      0,
    )}`,
    `- Average primary selections per game: ${formatNumber(pool.averageSelectionsPerGame)}`,
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
    "- **Unique definitions:** counts definition IDs once per game size even when an ordinary definition belongs to both Day and Night pools.",
    "- **Pool rows:** retains separate Day, Night, Cornucopia, and Flee measurements for the same definition.",
    "- **Appearance:** percentage of games containing the event at least once.",
    "- **Eligible:** the event passed definition-level eligibility during a selector opportunity.",
    "- **Feasible:** eligible participants and required items could be selected at that opportunity.",
    "- **Game selected/feasible:** games containing the event divided by games where it was feasible at least once.",
    "- **Opportunity selected/feasible:** weighted selector choices divided by feasible selector opportunities.",
    "- **Lifecycle primary:** forced or derived primary events are counted but kept outside weighted-selector conversion flags.",
    "- **Automatic events:** preparation, aftermath, and status-resolution events remain visible in dedicated sections.",
    "- **Core outcome variant:** whole-term-safe normalized wording plus core mechanical effects; incidental cleanup is tracked separately as full-effect permutations.",
    "",
    "## Suggested interpretation",
    "",
    "- `never-eligible` usually means the sample never created the event's required state.",
    "- `eligible-never-feasible` points to participant, relationship, or item constraints.",
    "- `feasible-never-selected` and low conversion flags point to weighting, repeat-cycle, planner-stage, reservation, or catalogue-concentration pressure.",
    "- `diagnostic-selection-mismatch` means actual event-history selections and selector-recorded selections disagree for a weighted definition and should be investigated before balancing it.",
    "- Lifecycle and automatic events may be frequent by design and are not assigned ordinary overexposure or selector-conversion flags.",
    "- Full Games naturally contain more event opportunities; pool share and selector conversion should be considered alongside game appearance.",
    "- Rare outcomes need enough total selections before their percentages are meaningful.",
    "",
    ...createEventSelectionFunnelMarkdown(data.selectionFunnel),
    ...createRosterStrategyEvidenceMarkdown(data.rosterStrategyEvidence),
    ...createPrerequisiteLifecycleEvidenceMarkdown(data.prerequisiteLifecycleEvidence),
  ];

  for (const gameSize of EVENT_DISTRIBUTION_GAME_SIZE_IDS) {
    const gameSizeEvents = data.events.filter((event) => event.gameSize === gameSize);
    const gameSizeDefinitions = data.definitions.filter(
      (definition) => definition.gameSize === gameSize,
    );
    const gameSizeLabel = data.distributionMetrics.gameSizes[gameSize].label;
    const coverage = data.catalogueCoverage.find((entry) => entry.gameSize === gameSize);

    if (gameSizeDefinitions.length === 0) {
      continue;
    }

    lines.push(`## ${gameSizeLabel}`, "", ...createUniqueDefinitionSummary(gameSizeDefinitions));

    if (coverage) {
      lines.push(...createCatalogueCoverageSection(coverage));
    }

    lines.push("### Weighted authored events", "");

    for (const poolId of EVENT_DISTRIBUTION_POOL_IDS) {
      const poolEvents = gameSizeEvents.filter((event) => event.poolId === poolId);
      const weightedEvents = poolEvents.filter((event) => event.eventClass === "weighted-authored");
      const lifecycleEvents = poolEvents.filter(
        (event) => event.eventClass === "lifecycle-primary",
      );

      if (weightedEvents.length === 0 && lifecycleEvents.length === 0) {
        continue;
      }

      lines.push(
        `#### ${AUDIT_POOL_LABELS[poolId]}`,
        "",
        ...createPoolDiagnosticsSummary(
          data.distributionMetrics,
          gameSize,
          poolId,
          weightedEvents,
          lifecycleEvents,
        ),
        ...createWeightedEventTable(weightedEvents),
        ...createDiagnosticBottleneckTable(weightedEvents),
        ...createOutcomeSections(weightedEvents),
      );
    }

    const lifecycleEvents = gameSizeEvents.filter(
      (event) => event.eventClass === "lifecycle-primary",
    );

    lines.push(
      "### Lifecycle primary events",
      "",
      "These events remain part of the simulation and event history, but their forced or derived selection routes make ordinary weighted-selector conversion misleading.",
      "",
      ...createLifecycleEventTable(lifecycleEvents),
      ...createOutcomeSections(lifecycleEvents),
    );

    for (const poolId of AUTOMATIC_POOL_IDS) {
      const automaticEvents = gameSizeEvents.filter((event) => event.poolId === poolId);

      if (automaticEvents.length === 0) {
        continue;
      }

      lines.push(
        `### ${AUDIT_POOL_LABELS[poolId]}`,
        "",
        ...createLifecycleEventTable(automaticEvents),
        ...createOutcomeSections(automaticEvents),
      );
    }

    const uncataloguedEvents = gameSizeEvents.filter(
      (event) => event.eventClass === "uncatalogued-primary" || event.eventClass === "unclassified",
    );

    if (uncataloguedEvents.length > 0) {
      lines.push(
        "### Uncatalogued or unclassified events",
        "",
        ...createLifecycleEventTable(uncataloguedEvents),
        ...createOutcomeSections(uncataloguedEvents),
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
    "event_class",
    "diagnostics_applicable",
    "definition_id",
    "expected_pools",
    "family_labels",
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
    "diagnostic_games_selected",
    "games_considered",
    "games_eligible",
    "games_feasible",
    "games_eligible_and_selected",
    "games_feasible_and_selected",
    "games_eligible_but_not_selected",
    "games_feasible_but_not_selected",
    "eligibility_rate_when_considered",
    "feasibility_rate_when_eligible",
    "opportunity_selection_rate_when_feasible",
    "game_selection_rate_when_eligible",
    "game_selection_rate_when_feasible",
    "top_rejection",
    "flags",
    "observed_core_outcome_variants",
    "observed_full_effect_permutations",
  ];

  const rows = events.map((event) =>
    [
      event.gameSize,
      event.poolId,
      event.eventClass,
      event.diagnosticsApplicable,
      event.definitionId,
      event.expectedPools.join(","),
      event.familyLabels.join(","),
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
      event.diagnosticGamesSelected,
      event.gamesConsidered,
      event.gamesEligible,
      event.gamesFeasible,
      event.gamesEligibleAndSelected,
      event.gamesFeasibleAndSelected,
      event.gamesEligibleButNotSelected,
      event.gamesFeasibleButNotSelected,
      event.eligibilityRateWhenConsidered,
      event.feasibilityRateWhenEligible,
      event.opportunitySelectionRateWhenFeasible,
      event.gameSelectionRateWhenEligible,
      event.gameSelectionRateWhenFeasible,
      getTopRejection(event),
      event.flags.join(","),
      event.outcomes.length,
      event.outcomes.reduce((total, outcome) => total + outcome.distinctFullEffectSignatures, 0),
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

function createDefinitionTsv(definitions: readonly DefinitionFrequencyMetric[]): string {
  const header = [
    "game_size",
    "definition_id",
    "event_class",
    "in_active_catalogue",
    "family_labels",
    "expected_pools",
    "audited_pools",
    "observed_pools",
    "pool_rows",
    "games",
    "selections",
    "games_with_definition",
    "appearance_rate",
    "average_selections_per_game",
    "maximum_selections_in_game",
    "fatal_selections",
    "eliminations",
    "considered",
    "eligible",
    "feasible",
    "diagnostic_selected",
    "games_eligible",
    "games_feasible",
    "games_eligible_but_not_selected",
    "games_feasible_but_not_selected",
    "game_selection_rate_when_eligible",
    "game_selection_rate_when_feasible",
    "flags",
  ];

  const rows = definitions.map((definition) =>
    [
      definition.gameSize,
      definition.definitionId,
      definition.eventClass,
      definition.inActiveCatalogue,
      definition.familyLabels.join(","),
      definition.expectedPools.join(","),
      definition.auditedPools.join(","),
      definition.observedPools.join(","),
      definition.poolRows,
      definition.games,
      definition.selections,
      definition.gamesWithDefinition,
      definition.appearanceRate,
      definition.averageSelectionsPerGame,
      definition.maximumSelectionsInGame,
      definition.fatalSelections,
      definition.eliminations,
      definition.considered,
      definition.eligible,
      definition.feasible,
      definition.diagnosticSelected,
      definition.gamesEligible,
      definition.gamesFeasible,
      definition.gamesEligibleButNotSelected,
      definition.gamesFeasibleButNotSelected,
      definition.gameSelectionRateWhenEligible,
      definition.gameSelectionRateWhenFeasible,
      definition.flags.join(","),
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

function createPerGameEventTsv(events: readonly PerGameEventMetric[]): string {
  const header = ["seed", "game_size", "pool", "event_class", "definition_id", "selections"];
  const rows = sortedCopy(
    events,
    (first, second) =>
      first.seed.localeCompare(second.seed) ||
      first.poolId.localeCompare(second.poolId) ||
      first.definitionId.localeCompare(second.definitionId),
  ).map((event) =>
    [
      event.seed,
      event.gameSize,
      event.poolId,
      event.eventClass,
      event.definitionId,
      event.selections,
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

function createPerGameDiagnosticTsv(diagnostics: readonly PerGameDiagnosticMetric[]): string {
  const header = [
    "seed",
    "game_size",
    "pool",
    "event_class",
    "definition_id",
    "actual_selections",
    "considered",
    "eligible",
    "feasible",
    "diagnostic_selected",
    "stages",
    ...EVENT_SELECTION_REJECTION_REASONS.map((reason) => `rejected_${reason}`),
  ];
  const rows = sortedCopy(
    diagnostics,
    (first, second) =>
      first.seed.localeCompare(second.seed) ||
      first.poolId.localeCompare(second.poolId) ||
      first.definitionId.localeCompare(second.definitionId),
  ).map((diagnostic) =>
    [
      diagnostic.seed,
      diagnostic.gameSize,
      diagnostic.poolId,
      diagnostic.eventClass,
      diagnostic.definitionId,
      diagnostic.actualSelections,
      diagnostic.considered,
      diagnostic.eligible,
      diagnostic.feasible,
      diagnostic.diagnosticSelected,
      diagnostic.stages.join(","),
      ...EVENT_SELECTION_REJECTION_REASONS.map((reason) => diagnostic.rejectionCounts[reason]),
    ]
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
    "event_class",
    "definition_id",
    "selections",
    "core_effect_signature",
    "full_effect_signatures",
    "normalized_text",
  ];
  const rows = sortedCopy(
    outcomes,
    (first, second) =>
      first.seed.localeCompare(second.seed) ||
      first.poolId.localeCompare(second.poolId) ||
      first.definitionId.localeCompare(second.definitionId) ||
      first.normalizedText.localeCompare(second.normalizedText),
  ).map((outcome) =>
    [
      outcome.seed,
      outcome.gameSize,
      outcome.poolId,
      outcome.eventClass,
      outcome.definitionId,
      outcome.selections,
      outcome.coreEffectSignature,
      outcome.fullEffectSignatures.join(" || "),
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
    "event_class",
    "definition_id",
    "variant_index",
    "selections",
    "games_with_outcome",
    "appearance_rate",
    "event_selection_share",
    "maximum_selections_in_game",
    "distinct_full_effect_signatures",
    "core_effect_signature",
    "sample_full_effect_signature",
    "normalized_text",
    "sample_text",
  ];

  const rows = events.flatMap((event) =>
    event.outcomes.map((outcome, index) =>
      [
        event.gameSize,
        event.poolId,
        event.eventClass,
        event.definitionId,
        index + 1,
        outcome.selections,
        outcome.gamesWithOutcome,
        outcome.appearanceRate,
        outcome.eventSelectionShare,
        outcome.maximumSelectionsInGame,
        outcome.distinctFullEffectSignatures,
        outcome.coreEffectSignature,
        outcome.sampleFullEffectSignature,
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
const outputClaim = await claimReportOutputDirectory(
  configuration.outputDirectory,
  configuration.overwrite,
);
const outputDirectory = outputClaim.outputDirectory;

try {
  const provenance = await createEventFrequencyReportProvenance({
    allowDirty: configuration.allowDirty,
  });
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
  const selectionFunnel = createEventSelectionFunnelReport(runs);
  const rosterStrategyEvidence = collectRosterStrategyEvidence(runs);
  const prerequisiteLifecycleEvidence = collectPrerequisiteLifecycleEvidence(runs);

  if (!selectionFunnel.reconciliation.passed) {
    throw new Error(
      "Event-selection funnel reconciliation failed:\n" +
        selectionFunnel.reconciliation.failures.join("\n"),
    );
  }

  if (!prerequisiteLifecycleEvidence.reconciliation.passed) {
    throw new Error(
      "Phase 3 prerequisite lifecycle reconciliation failed:\n" +
        prerequisiteLifecycleEvidence.reconciliation.failures.join("\n"),
    );
  }

  const metricsByKey = new Map<string, MutableEventMetric>();
  const poolSelectionsByKey = new Map<string, number>();
  const perGameEvents: PerGameEventMetric[] = [];
  const perGameOutcomes: PerGameOutcomeMetric[] = [];
  const perGameDiagnostics: PerGameDiagnosticMetric[] = [];

  seedActiveCatalogueMetrics(metricsByKey, configuration);

  for (const run of runs) {
    const actualSelectionsByMetricKey = addRunEvents(
      metricsByKey,
      poolSelectionsByKey,
      perGameEvents,
      perGameOutcomes,
      run,
    );

    addRunDiagnostics(metricsByKey, perGameDiagnostics, actualSelectionsByMetricKey, run);
  }

  const events = createFrequencyMetrics(configuration, metricsByKey, poolSelectionsByKey);
  const definitions = createDefinitionMetrics({
    configuration,
    events,
    perGameEvents,
    perGameDiagnostics,
  });
  const catalogueCoverage = createCatalogueCoverage(definitions, events);
  const data: FrequencyReportData = {
    generatedAt: new Date().toISOString(),
    provenance,
    configuration,
    methodology: {
      selectionFrequency:
        "Counts resolved event-history entries by game size, pool, definition, and game, then separately aggregates unique definition IDs across pools.",
      eligibility:
        "Uses selector diagnostics. Eligible means definition-level eligibility passed; feasible means participants and required items could be selected. Game-level conversion uses actual event-history selection in the same game and pool.",
      lifecycleSeparation:
        "Forced or derived lifecycle primary events and automatic preparation, aftermath, and status-resolution events remain counted but are separated from weighted authored definitions and do not receive ordinary selector-conversion flags.",
      outcomeGrouping:
        "Groups observed core variants by whole-term-safe normalized wording plus a core mechanical signature. Routine statistic increments, eliminated-tribute status cleanup, and death-loot transfer/destruction are excluded from the core key but retained as counted full-effect permutations.",
      catalogueCoverage:
        "Validates definitions exported by active catalogue families and their expected pools. It does not discover dormant source definitions that are not exported through those families.",
      selectionFunnel:
        "Records deterministic definition-level rows for every concrete selector opportunity, then aggregates state feasibility, reservation-aware opportunity feasibility, planner admission, weighted-pool exposure, draws, rejected resolutions, accepted selections, route-normalized exposure, and reconciliation against aggregate diagnostics and event history.",
      rosterStrategyEvidence:
        "Counts initial shuffled DEFAULT_TRIBUTES stats, deterministically replays Day 1 Cornucopia-versus-Flee assignments with the production strategy function and round seed, records selected participant stat values against typed Phase 1B thresholds, and separates roster availability and strategy assignment from hard feasibility, weighted-pool exposure, and selection for the two focused Cornucopia definitions.",
      prerequisiteLifecycleEvidence:
        "Reconstructs the selector-visible state after automatic round preparation; reconciles item acquisitions and transactions, status transitions, and truce lifecycles against event history and game state; and measures exact typed item, status, and truce prerequisite availability independently from full definition feasibility.",
    },
    distributionMetrics,
    selectionFunnel,
    rosterStrategyEvidence,
    prerequisiteLifecycleEvidence,
    catalogueCoverage,
    definitions,
    events,
  };

  const markdownPath = resolve(outputDirectory, "event-frequency-report.md");
  const jsonPath = resolve(outputDirectory, "event-frequency-report.json");
  const eventTsvPath = resolve(outputDirectory, "event-frequency-events.tsv");
  const definitionTsvPath = resolve(outputDirectory, "event-frequency-definitions.tsv");
  const outcomeTsvPath = resolve(outputDirectory, "event-frequency-outcomes.tsv");
  const perGameEventTsvPath = resolve(outputDirectory, "event-frequency-by-game.tsv");
  const perGameDiagnosticTsvPath = resolve(
    outputDirectory,
    "event-frequency-diagnostics-by-game.tsv",
  );
  const perGameOutcomeTsvPath = resolve(outputDirectory, "event-frequency-outcomes-by-game.tsv");
  const selectionFunnelTsvPath = resolve(outputDirectory, "event-frequency-selection-funnel.tsv");
  const selectionFunnelSummaryTsvPath = resolve(
    outputDirectory,
    "event-frequency-selection-funnel-summary.tsv",
  );
  const rosterStatsByGameTsvPath = resolve(
    outputDirectory,
    "event-frequency-roster-stats-by-game.tsv",
  );
  const bloodbathStrategyByGameTsvPath = resolve(
    outputDirectory,
    "event-frequency-bloodbath-strategy-by-game.tsv",
  );
  const bloodbathStrategyByStatTsvPath = resolve(
    outputDirectory,
    "event-frequency-bloodbath-strategy-by-stat.tsv",
  );
  const statGatedSelectionsTsvPath = resolve(
    outputDirectory,
    "event-frequency-stat-gated-selections.tsv",
  );
  const focusedStatGatesTsvPath = resolve(
    outputDirectory,
    "event-frequency-focused-stat-gates.tsv",
  );
  const itemLifecycleByGameTsvPath = resolve(
    outputDirectory,
    "event-frequency-item-lifecycle-by-game.tsv",
  );
  const itemPrerequisiteAvailabilityTsvPath = resolve(
    outputDirectory,
    "event-frequency-item-prerequisite-availability.tsv",
  );
  const statusLifecycleByGameTsvPath = resolve(
    outputDirectory,
    "event-frequency-status-lifecycle-by-game.tsv",
  );
  const statusPrerequisiteAvailabilityTsvPath = resolve(
    outputDirectory,
    "event-frequency-status-prerequisite-availability.tsv",
  );
  const statusPreparationRemovalTsvPath = resolve(
    outputDirectory,
    "event-frequency-status-preparation-removals.tsv",
  );
  const truceLifecycleTsvPath = resolve(outputDirectory, "event-frequency-truce-lifecycle.tsv");
  const trucePrerequisiteAvailabilityTsvPath = resolve(
    outputDirectory,
    "event-frequency-truce-prerequisite-availability.tsv",
  );

  await Promise.all([
    writeFile(markdownPath, createMarkdownReport(data), "utf8"),
    writeFile(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf8"),
    writeFile(eventTsvPath, createEventTsv(events), "utf8"),
    writeFile(definitionTsvPath, createDefinitionTsv(definitions), "utf8"),
    writeFile(outcomeTsvPath, createOutcomeTsv(events), "utf8"),
    writeFile(perGameEventTsvPath, createPerGameEventTsv(perGameEvents), "utf8"),
    writeFile(perGameDiagnosticTsvPath, createPerGameDiagnosticTsv(perGameDiagnostics), "utf8"),
    writeFile(perGameOutcomeTsvPath, createPerGameOutcomeTsv(perGameOutcomes), "utf8"),
    writeFile(selectionFunnelTsvPath, createEventSelectionFunnelTsv(runs), "utf8"),
    writeFile(
      selectionFunnelSummaryTsvPath,
      createEventSelectionFunnelSummaryTsv(selectionFunnel),
      "utf8",
    ),
    writeFile(rosterStatsByGameTsvPath, createRosterStatsByGameTsv(rosterStrategyEvidence), "utf8"),
    writeFile(
      bloodbathStrategyByGameTsvPath,
      createBloodbathStrategyByGameTsv(rosterStrategyEvidence),
      "utf8",
    ),
    writeFile(
      bloodbathStrategyByStatTsvPath,
      createBloodbathStrategyByStatTsv(rosterStrategyEvidence),
      "utf8",
    ),
    writeFile(
      statGatedSelectionsTsvPath,
      createStatGatedSelectionTsv(rosterStrategyEvidence),
      "utf8",
    ),
    writeFile(focusedStatGatesTsvPath, createFocusedStatGateTsv(rosterStrategyEvidence), "utf8"),
    writeFile(
      itemLifecycleByGameTsvPath,
      createItemLifecycleByGameTsv(prerequisiteLifecycleEvidence),
      "utf8",
    ),
    writeFile(
      itemPrerequisiteAvailabilityTsvPath,
      createItemPrerequisiteAvailabilityTsv(prerequisiteLifecycleEvidence),
      "utf8",
    ),
    writeFile(
      statusLifecycleByGameTsvPath,
      createStatusLifecycleByGameTsv(prerequisiteLifecycleEvidence),
      "utf8",
    ),
    writeFile(
      statusPrerequisiteAvailabilityTsvPath,
      createStatusPrerequisiteAvailabilityTsv(prerequisiteLifecycleEvidence),
      "utf8",
    ),
    writeFile(
      statusPreparationRemovalTsvPath,
      createStatusPreparationRemovalTsv(prerequisiteLifecycleEvidence),
      "utf8",
    ),
    writeFile(
      truceLifecycleTsvPath,
      createTruceLifecycleTsv(prerequisiteLifecycleEvidence),
      "utf8",
    ),
    writeFile(
      trucePrerequisiteAvailabilityTsvPath,
      createTrucePrerequisiteAvailabilityTsv(prerequisiteLifecycleEvidence),
      "utf8",
    ),
  ]);

  const generatedPaths = [
    markdownPath,
    jsonPath,
    eventTsvPath,
    definitionTsvPath,
    outcomeTsvPath,
    perGameEventTsvPath,
    perGameDiagnosticTsvPath,
    perGameOutcomeTsvPath,
    selectionFunnelTsvPath,
    selectionFunnelSummaryTsvPath,
    rosterStatsByGameTsvPath,
    bloodbathStrategyByGameTsvPath,
    bloodbathStrategyByStatTsvPath,
    statGatedSelectionsTsvPath,
    focusedStatGatesTsvPath,
    itemLifecycleByGameTsvPath,
    itemPrerequisiteAvailabilityTsvPath,
    statusLifecycleByGameTsvPath,
    statusPrerequisiteAvailabilityTsvPath,
    statusPreparationRemovalTsvPath,
    truceLifecycleTsvPath,
    trucePrerequisiteAvailabilityTsvPath,
  ];
  const checksumManifest = {
    schemaVersion: provenance.schemaVersion,
    commitSha: provenance.commitSha,
    generator: {
      path: provenance.generatorPath,
      version: provenance.generatorVersion,
      sha256: provenance.generatorSha256,
    },
    source: {
      worktreeState: provenance.worktreeState,
      worktreeStatusSha256: provenance.worktreeStatusSha256,
      sourceTreeSha256: provenance.sourceTreeSha256,
      sourceFileCount: provenance.sourceFileCount,
    },
    files: Object.fromEntries(
      await Promise.all(
        generatedPaths.map(async (path) => {
          const contents = await readFile(path);
          return [
            path.slice(outputDirectory.length + 1).replaceAll("\\", "/"),
            createHash("sha256").update(contents).digest("hex"),
          ] as const;
        }),
      ),
    ),
  };
  const checksumManifestPath = resolve(outputDirectory, "checksums.sha256.json");
  await writeFile(checksumManifestPath, `${JSON.stringify(checksumManifest, null, 2)}\n`, "utf8");
  await outputClaim.commit();

  console.log(`Event frequency Markdown written to ${markdownPath}`);
  console.log(`Event frequency JSON written to ${jsonPath}`);
  console.log(`Pool-level event TSV written to ${eventTsvPath}`);
  console.log(`Unique-definition TSV written to ${definitionTsvPath}`);
  console.log(`Outcome TSV written to ${outcomeTsvPath}`);
  console.log(`Per-game event TSV written to ${perGameEventTsvPath}`);
  console.log(`Per-game diagnostic TSV written to ${perGameDiagnosticTsvPath}`);
  console.log(`Per-game outcome TSV written to ${perGameOutcomeTsvPath}`);
  console.log(`Selection-funnel TSV written to ${selectionFunnelTsvPath}`);
  console.log(`Selection-funnel summary TSV written to ${selectionFunnelSummaryTsvPath}`);
  console.log(`Roster-stat TSV written to ${rosterStatsByGameTsvPath}`);
  console.log(`Bloodbath strategy-by-game TSV written to ${bloodbathStrategyByGameTsvPath}`);
  console.log(`Bloodbath strategy-by-stat TSV written to ${bloodbathStrategyByStatTsvPath}`);
  console.log(`Stat-gated selection TSV written to ${statGatedSelectionsTsvPath}`);
  console.log(`Focused stat-gate TSV written to ${focusedStatGatesTsvPath}`);
  console.log(`Item lifecycle TSV written to ${itemLifecycleByGameTsvPath}`);
  console.log(`Item prerequisite TSV written to ${itemPrerequisiteAvailabilityTsvPath}`);
  console.log(`Status lifecycle TSV written to ${statusLifecycleByGameTsvPath}`);
  console.log(`Status prerequisite TSV written to ${statusPrerequisiteAvailabilityTsvPath}`);
  console.log(`Status preparation-removal TSV written to ${statusPreparationRemovalTsvPath}`);
  console.log(`Truce lifecycle TSV written to ${truceLifecycleTsvPath}`);
  console.log(`Truce prerequisite TSV written to ${trucePrerequisiteAvailabilityTsvPath}`);
  console.log(
    `Simulated ${configuration.halfGames} Half Games and ${configuration.fullGames} Full Games.`,
  );

  for (const gameSize of EVENT_DISTRIBUTION_GAME_SIZE_IDS) {
    const gameSizeEvents = events.filter((event) => event.gameSize === gameSize);
    const gameSizeDefinitions = definitions.filter(
      (definition) => definition.gameSize === gameSize,
    );
    if (gameSizeDefinitions.length === 0) {
      continue;
    }

    const selectedDefinitions = gameSizeDefinitions.filter(
      (definition) => definition.selections > 0,
    ).length;
    const neverSelectedDefinitions = gameSizeDefinitions.filter(
      (definition) => definition.selections === 0,
    ).length;
    const feasibleNeverSelectedDefinitions = gameSizeDefinitions.filter(
      (definition) => definition.feasible > 0 && definition.selections === 0,
    ).length;
    const lifecycleDefinitions = gameSizeDefinitions.filter(
      (definition) => definition.eventClass !== "weighted-authored" && definition.selections > 0,
    ).length;

    console.log(
      `${gameSize}: ${gameSizeDefinitions.length} unique definitions across ` +
        `${gameSizeEvents.length} pool rows; ${selectedDefinitions} selected; ` +
        `${neverSelectedDefinitions} never selected; ` +
        `${feasibleNeverSelectedDefinitions} feasible but never selected; ` +
        `${lifecycleDefinitions} lifecycle/automatic definitions observed.`,
    );
  }
} catch (error) {
  await outputClaim.rollback();
  throw error;
}
