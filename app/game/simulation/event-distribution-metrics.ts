import {
  BLOODBATH_EVENT_CATALOGUE_FAMILIES,
  ORDINARY_EVENT_CATALOGUE_FAMILIES,
} from "~/game/events/catalogue/catalogue-families";

import {
  EVENT_PARTICIPANT_SHAPES,
  getParticipantShapeForTributeIds,
  type EventParticipantShape,
} from "~/game/events/event-participant-shape";
import type { EventDefinition } from "~/game/events/event-schema";

import type { ResolvedEvent } from "~/game/types/game-state";

export { EVENT_PARTICIPANT_SHAPES };
export type { EventParticipantShape };

import type { SimulationRun } from "./simulation-runner";

export const EVENT_DISTRIBUTION_GAME_SIZE_IDS = ["half-game", "full-game"] as const;

export type EventDistributionGameSizeId = (typeof EVENT_DISTRIBUTION_GAME_SIZE_IDS)[number];

export const EVENT_DISTRIBUTION_POOL_IDS = [
  "bloodbath-cornucopia",
  "bloodbath-flee",
  "later-day",
  "night",
] as const;

export type EventDistributionPoolId = (typeof EVENT_DISTRIBUTION_POOL_IDS)[number];

export interface NumberDistribution {
  comparisons: number;
  minimum: number;
  average: number;
  median: number;
  percentile90: number;
  maximum: number;
}

export interface EventDistributionShapeMetric {
  selections: number;
  share: number;
}

export interface EventDistributionEventMetric {
  definitionId: string;
  familyIds: readonly string[];
  familyLabels: readonly string[];

  selections: number;
  gamesWithEvent: number;
  appearanceRate: number;
  selectionShare: number;
  averageSelectionsPerGame: number;

  fatalSelections: number;
  eliminations: number;

  participantShapes: Readonly<Record<EventParticipantShape, number>>;
}

export interface EventDistributionFamilyMetric {
  id: string;
  label: string;

  selections: number;
  gamesWithEvent: number;
  appearanceRate: number;
  selectionShare: number;
}

export interface EventDistributionPoolMetric {
  id: EventDistributionPoolId;
  label: string;

  games: number;
  totalSelections: number;
  averageSelectionsPerGame: number;

  participantShapes: Readonly<Record<EventParticipantShape, EventDistributionShapeMetric>>;
  nonSoloShare: number;

  consecutiveGameOverlap: NumberDistribution;

  concentration: {
    topFiveSelectionShare: number;
    topTenSelectionShare: number;
    appearsInAtLeast25PercentOfGames: readonly string[];
    appearsInAtLeast50PercentOfGames: readonly string[];
    appearsInAtLeast75PercentOfGames: readonly string[];
  };

  families: readonly EventDistributionFamilyMetric[];
  events: readonly EventDistributionEventMetric[];
  neverSelectedEventIds: readonly string[];
}

export interface EventDistributionGameSizeMetric {
  id: EventDistributionGameSizeId;
  label: string;
  games: number;
  pools: Readonly<Record<EventDistributionPoolId, EventDistributionPoolMetric>>;
}

export interface EventDistributionMetrics {
  sample: {
    totalGames: number;
    halfGames: number;
    fullGames: number;
  };

  excludedHistoryEntries: {
    nonPrimary: number;
    unclassifiedPrimary: number;
    unclassifiedPrimaryDefinitionIds: readonly string[];
  };

  gameSizes: Readonly<Record<EventDistributionGameSizeId, EventDistributionGameSizeMetric>>;
}

interface CatalogueDefinitionMetadata {
  familyIds: Set<string>;
  familyLabels: Set<string>;
  expectedPools: Set<EventDistributionPoolId>;
}

interface FamilyMetadata {
  id: string;
  label: string;
}

interface MutableEventMetric {
  definitionId: string;
  familyIds: readonly string[];
  familyLabels: readonly string[];

  selections: number;
  gamesWithEvent: number;
  fatalSelections: number;
  eliminations: number;

  participantShapes: Record<EventParticipantShape, number>;
}

interface MutableFamilyMetric {
  id: string;
  label: string;
  selections: number;
  gamesWithEvent: number;
}

const GAME_SIZE_LABELS = {
  "half-game": "Half Game",
  "full-game": "Full Game",
} as const satisfies Record<EventDistributionGameSizeId, string>;

const POOL_LABELS = {
  "bloodbath-cornucopia": "Bloodbath — Cornucopia",
  "bloodbath-flee": "Bloodbath — Fleeing",
  "later-day": "Day 2+",
  night: "Night",
} as const satisfies Record<EventDistributionPoolId, string>;

const catalogueMetadataByDefinitionId = new Map<string, CatalogueDefinitionMetadata>();
const familyMetadataById = new Map<string, FamilyMetadata>();

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function createShapeCountRecord(): Record<EventParticipantShape, number> {
  return {
    solo: 0,
    pair: 0,
    trio: 0,
    "group-four-plus": 0,
  };
}

function getPercentile(values: readonly number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((first, second) => first - second);
  const index = Math.min(sorted.length - 1, Math.ceil(percentile * sorted.length) - 1);

  return sorted[index] ?? 0;
}

function createNumberDistribution(values: readonly number[]): NumberDistribution {
  if (values.length === 0) {
    return {
      comparisons: 0,
      minimum: 0,
      average: 0,
      median: 0,
      percentile90: 0,
      maximum: 0,
    };
  }

  return {
    comparisons: values.length,
    minimum: Math.min(...values),
    average: divide(
      values.reduce((total, value) => total + value, 0),
      values.length,
    ),
    median: getPercentile(values, 0.5),
    percentile90: getPercentile(values, 0.9),
    maximum: Math.max(...values),
  };
}

function registerDefinition({
  definition,
  family,
  expectedPools,
}: {
  definition: EventDefinition;
  family: FamilyMetadata;
  expectedPools: readonly EventDistributionPoolId[];
}): void {
  familyMetadataById.set(family.id, family);

  const metadata = catalogueMetadataByDefinitionId.get(definition.id) ?? {
    familyIds: new Set<string>(),
    familyLabels: new Set<string>(),
    expectedPools: new Set<EventDistributionPoolId>(),
  };

  metadata.familyIds.add(family.id);
  metadata.familyLabels.add(family.label);

  for (const pool of expectedPools) {
    metadata.expectedPools.add(pool);
  }

  catalogueMetadataByDefinitionId.set(definition.id, metadata);
}

for (const family of BLOODBATH_EVENT_CATALOGUE_FAMILIES) {
  const metadata = {
    id: `bloodbath:${family.name}`,
    label: `Bloodbath — ${family.name}`,
  };

  const expectedPool: EventDistributionPoolId =
    family.name === "flee" ? "bloodbath-flee" : "bloodbath-cornucopia";

  for (const definition of family.events as readonly EventDefinition[]) {
    registerDefinition({
      definition,
      family: metadata,
      expectedPools: [expectedPool],
    });
  }
}

for (const family of ORDINARY_EVENT_CATALOGUE_FAMILIES) {
  const metadata = {
    id: `ordinary:${family.name}`,
    label: family.name,
  };

  for (const definition of family.events as readonly EventDefinition[]) {
    const expectedPools: EventDistributionPoolId[] = [];

    if (definition.periods.includes("day")) {
      expectedPools.push("later-day");
    }

    if (definition.periods.includes("night")) {
      expectedPools.push("night");
    }

    registerDefinition({
      definition,
      family: metadata,
      expectedPools,
    });
  }
}

function getGameSizeId(run: SimulationRun): EventDistributionGameSizeId {
  return run.districtCount === 6 ? "half-game" : "full-game";
}

function classifyEventPool(event: ResolvedEvent): EventDistributionPoolId | null {
  if (event.feedGroup === "bloodbath-cornucopia") {
    return "bloodbath-cornucopia";
  }

  if (event.feedGroup === "bloodbath-flee") {
    return "bloodbath-flee";
  }

  if (event.round.period === "night") {
    return "night";
  }

  if (event.round.day >= 2) {
    return "later-day";
  }

  return null;
}

function getEliminationCount(event: ResolvedEvent): number {
  return event.changes.filter((change) => change.type === "eliminate-tribute").length;
}

function getFamilyIds(definitionId: string): readonly string[] {
  const familyIds = catalogueMetadataByDefinitionId.get(definitionId)?.familyIds;

  return familyIds && familyIds.size > 0 ? [...familyIds].sort() : ["uncatalogued"];
}

function getFamilyLabels(definitionId: string): readonly string[] {
  const familyLabels = catalogueMetadataByDefinitionId.get(definitionId)?.familyLabels;

  return familyLabels && familyLabels.size > 0 ? [...familyLabels].sort() : ["Uncatalogued"];
}

function getPrimaryFamily(definitionId: string): FamilyMetadata {
  const familyId = getFamilyIds(definitionId)[0] ?? "uncatalogued";

  return (
    familyMetadataById.get(familyId) ?? {
      id: "uncatalogued",
      label: "Uncatalogued",
    }
  );
}

function getExpectedDefinitionIds(poolId: EventDistributionPoolId): string[] {
  return [...catalogueMetadataByDefinitionId.entries()]
    .filter(([, metadata]) => metadata.expectedPools.has(poolId))
    .map(([definitionId]) => definitionId)
    .sort();
}

function getOverlapCount(
  firstDefinitionIds: ReadonlySet<string>,
  secondDefinitionIds: ReadonlySet<string>,
): number {
  let overlap = 0;

  for (const definitionId of firstDefinitionIds) {
    if (secondDefinitionIds.has(definitionId)) {
      overlap += 1;
    }
  }

  return overlap;
}

function createPoolMetric(
  runs: readonly SimulationRun[],
  poolId: EventDistributionPoolId,
): EventDistributionPoolMetric {
  const eventMetrics = new Map<string, MutableEventMetric>();
  const familyMetrics = new Map<string, MutableFamilyMetric>();
  const definitionIdsByRun: Set<string>[] = [];

  let totalSelections = 0;
  const totalShapeCounts = createShapeCountRecord();

  for (const run of runs) {
    const events = run.state.eventHistory.filter(
      (event) => event.kind === "primary" && classifyEventPool(event) === poolId,
    );

    const seenDefinitionIds = new Set<string>();
    const seenFamilyIds = new Set<string>();

    for (const event of events) {
      totalSelections += 1;

      const participantShape = getParticipantShapeForTributeIds(event.participantTributeIds);
      totalShapeCounts[participantShape] += 1;

      const eliminationCount = getEliminationCount(event);
      const existingEventMetric = eventMetrics.get(event.definitionId) ?? {
        definitionId: event.definitionId,
        familyIds: getFamilyIds(event.definitionId),
        familyLabels: getFamilyLabels(event.definitionId),
        selections: 0,
        gamesWithEvent: 0,
        fatalSelections: 0,
        eliminations: 0,
        participantShapes: createShapeCountRecord(),
      };

      existingEventMetric.selections += 1;
      existingEventMetric.eliminations += eliminationCount;
      existingEventMetric.participantShapes[participantShape] += 1;

      if (eliminationCount > 0) {
        existingEventMetric.fatalSelections += 1;
      }

      eventMetrics.set(event.definitionId, existingEventMetric);
      seenDefinitionIds.add(event.definitionId);

      const primaryFamily = getPrimaryFamily(event.definitionId);
      const existingFamilyMetric = familyMetrics.get(primaryFamily.id) ?? {
        ...primaryFamily,
        selections: 0,
        gamesWithEvent: 0,
      };

      existingFamilyMetric.selections += 1;
      familyMetrics.set(primaryFamily.id, existingFamilyMetric);
      seenFamilyIds.add(primaryFamily.id);
    }

    for (const definitionId of seenDefinitionIds) {
      const eventMetric = eventMetrics.get(definitionId);

      if (eventMetric) {
        eventMetric.gamesWithEvent += 1;
      }
    }

    for (const familyId of seenFamilyIds) {
      const familyMetric = familyMetrics.get(familyId);

      if (familyMetric) {
        familyMetric.gamesWithEvent += 1;
      }
    }

    definitionIdsByRun.push(seenDefinitionIds);
  }

  const overlapCounts = definitionIdsByRun
    .slice(1)
    .map((definitionIds, index) =>
      getOverlapCount(definitionIdsByRun[index] ?? new Set(), definitionIds),
    );

  const events = [...eventMetrics.values()]
    .map((event): EventDistributionEventMetric => ({
      definitionId: event.definitionId,
      familyIds: event.familyIds,
      familyLabels: event.familyLabels,
      selections: event.selections,
      gamesWithEvent: event.gamesWithEvent,
      appearanceRate: divide(event.gamesWithEvent, runs.length),
      selectionShare: divide(event.selections, totalSelections),
      averageSelectionsPerGame: divide(event.selections, runs.length),
      fatalSelections: event.fatalSelections,
      eliminations: event.eliminations,
      participantShapes: event.participantShapes,
    }))
    .sort(
      (first, second) =>
        second.selections - first.selections ||
        first.definitionId.localeCompare(second.definitionId),
    );

  const families = [...familyMetrics.values()]
    .map((family): EventDistributionFamilyMetric => ({
      id: family.id,
      label: family.label,
      selections: family.selections,
      gamesWithEvent: family.gamesWithEvent,
      appearanceRate: divide(family.gamesWithEvent, runs.length),
      selectionShare: divide(family.selections, totalSelections),
    }))
    .sort(
      (first, second) => second.selections - first.selections || first.id.localeCompare(second.id),
    );

  const selectedDefinitionIds = new Set(events.map((event) => event.definitionId));
  const neverSelectedEventIds = getExpectedDefinitionIds(poolId).filter(
    (definitionId) => !selectedDefinitionIds.has(definitionId),
  );

  const topSelectionShare = (count: number): number =>
    divide(
      events.slice(0, count).reduce((total, event) => total + event.selections, 0),
      totalSelections,
    );

  const idsAtAppearanceRate = (minimumRate: number): string[] =>
    events
      .filter((event) => event.appearanceRate >= minimumRate)
      .map((event) => event.definitionId)
      .sort();

  const participantShapes = Object.fromEntries(
    EVENT_PARTICIPANT_SHAPES.map((shape) => [
      shape,
      {
        selections: totalShapeCounts[shape],
        share: divide(totalShapeCounts[shape], totalSelections),
      },
    ]),
  ) as Record<EventParticipantShape, EventDistributionShapeMetric>;

  return {
    id: poolId,
    label: POOL_LABELS[poolId],
    games: runs.length,
    totalSelections,
    averageSelectionsPerGame: divide(totalSelections, runs.length),
    participantShapes,
    nonSoloShare: divide(totalSelections - totalShapeCounts.solo, totalSelections),
    consecutiveGameOverlap: createNumberDistribution(overlapCounts),
    concentration: {
      topFiveSelectionShare: topSelectionShare(5),
      topTenSelectionShare: topSelectionShare(10),
      appearsInAtLeast25PercentOfGames: idsAtAppearanceRate(0.25),
      appearsInAtLeast50PercentOfGames: idsAtAppearanceRate(0.5),
      appearsInAtLeast75PercentOfGames: idsAtAppearanceRate(0.75),
    },
    families,
    events,
    neverSelectedEventIds,
  };
}

function createGameSizeMetric(
  runs: readonly SimulationRun[],
  id: EventDistributionGameSizeId,
): EventDistributionGameSizeMetric {
  return {
    id,
    label: GAME_SIZE_LABELS[id],
    games: runs.length,
    pools: Object.fromEntries(
      EVENT_DISTRIBUTION_POOL_IDS.map((poolId) => [poolId, createPoolMetric(runs, poolId)]),
    ) as Record<EventDistributionPoolId, EventDistributionPoolMetric>,
  };
}

export function collectEventDistributionMetrics(
  runs: readonly SimulationRun[],
): EventDistributionMetrics {
  if (runs.length === 0) {
    throw new Error("Cannot collect event-distribution metrics from an empty simulation sample.");
  }

  const runsByGameSize = {
    "half-game": runs.filter((run) => getGameSizeId(run) === "half-game"),
    "full-game": runs.filter((run) => getGameSizeId(run) === "full-game"),
  } satisfies Record<EventDistributionGameSizeId, SimulationRun[]>;

  let nonPrimary = 0;
  let unclassifiedPrimary = 0;
  const unclassifiedPrimaryDefinitionIds = new Set<string>();

  for (const run of runs) {
    for (const event of run.state.eventHistory) {
      if (event.kind !== "primary") {
        nonPrimary += 1;
        continue;
      }

      if (classifyEventPool(event) === null) {
        unclassifiedPrimary += 1;
        unclassifiedPrimaryDefinitionIds.add(event.definitionId);
      }
    }
  }

  return {
    sample: {
      totalGames: runs.length,
      halfGames: runsByGameSize["half-game"].length,
      fullGames: runsByGameSize["full-game"].length,
    },
    excludedHistoryEntries: {
      nonPrimary,
      unclassifiedPrimary,
      unclassifiedPrimaryDefinitionIds: [...unclassifiedPrimaryDefinitionIds].sort(),
    },
    gameSizes: {
      "half-game": createGameSizeMetric(runsByGameSize["half-game"], "half-game"),
      "full-game": createGameSizeMetric(runsByGameSize["full-game"], "full-game"),
    },
  };
}
