import {
  BLOODBATH_EVENT_CATALOGUE_FAMILIES,
  ORDINARY_EVENT_CATALOGUE_FAMILIES,
} from "~/game/events/catalogue/catalogue-families";
import { POISONOUS_BERRIES_JOINT_VICTORY_EVENT } from "~/game/events/catalogue/relationships/romantic-events";
import { getEventAuditSpecificityBreakdown } from "~/game/events/event-specificity";
import type { EventDefinition } from "~/game/events/event-schema";
import type {
  EventDistributionGameSizeId,
  EventDistributionPoolId,
} from "~/game/simulation/event-distribution-metrics";
import {
  EVENT_SELECTION_REJECTION_REASONS,
  type EventSelectionDiagnosticStage,
  type EventSelectionRejectionReason,
} from "~/game/simulation/event-selection-diagnostics";
import {
  createEventSelectionOpportunityId,
  type EventSelectionOpportunityRecord,
} from "~/game/simulation/event-selection-opportunity";
import type { SimulationRun } from "~/game/simulation/simulation-runner";
import { PREPARED_CAVE_NIGHT_DEFINITION_ID } from "~/game/survival/night-rest-coverage";
import type { ResolvedEvent } from "~/game/types/game-state";

export const EVENT_SELECTION_FUNNEL_SCHEMA_VERSION = "event-selection-funnel-v1";

const POST_DRAW_REJECTION_REASONS = new Set<EventSelectionRejectionReason>([
  "post-draw-item-conflict",
  "post-draw-fatality-overshoot",
  "post-draw-resolution-rejected",
]);

const FORCED_TRUCE_SEPARATION_PREFIX = "amicable-truce-separation-";

function isLifecyclePrimaryDefinition(definitionId: string): boolean {
  return (
    definitionId.startsWith(FORCED_TRUCE_SEPARATION_PREFIX) ||
    definitionId === POISONOUS_BERRIES_JOINT_VICTORY_EVENT.id ||
    definitionId === PREPARED_CAVE_NIGHT_DEFINITION_ID
  );
}

interface MutableDefinitionMetric {
  gameSize: EventDistributionGameSizeId;
  poolId: EventDistributionPoolId;
  stage: EventSelectionDiagnosticStage;
  definitionId: string;
  games: number;
  eligibleGames: Set<string>;
  stateFeasibleGames: Set<string>;
  opportunityFeasibleGames: Set<string>;
  weightedPoolGames: Set<string>;
  drawnGames: Set<string>;
  selectedGames: Set<string>;
  eligibleRounds: Set<string>;
  selectedRounds: Set<string>;
  eligibleOpportunities: number;
  stateFeasibleOpportunities: number;
  opportunityFeasibleOpportunities: number;
  plannerAdmittedOpportunities: number;
  weightedPoolOpportunities: number;
  weightedPoolEntries: number;
  uniformExpectedSelections: number;
  drawAttempts: number;
  rejectedDraws: number;
  acceptedSelections: number;
  rejectionCounts: Record<EventSelectionRejectionReason, number>;
}

export interface EventSelectionFunnelDefinitionMetric {
  gameSize: EventDistributionGameSizeId;
  poolId: EventDistributionPoolId;
  stage: EventSelectionDiagnosticStage;
  definitionId: string;
  games: number;
  broadEvent: boolean | null;
  auditSpecificityScore: number | null;
  authoredSpecificityScore: number | null;
  structuralSpecificityScore: number | null;
  specificityReasons: readonly string[];
  distinctGamesEligible: number;
  distinctGamesStateFeasible: number;
  distinctGamesOpportunityFeasible: number;
  distinctGamesWeightedPool: number;
  distinctGamesDrawn: number;
  distinctGamesSelected: number;
  eligibleOpportunities: number;
  stateFeasibleOpportunities: number;
  opportunityFeasibleOpportunities: number;
  plannerAdmittedOpportunities: number;
  weightedPoolOpportunities: number;
  weightedPoolEntries: number;
  uniformExpectedSelections: number;
  drawAttempts: number;
  rejectedDraws: number;
  acceptedSelections: number;
  eligibleRounds: number;
  selectedRounds: number;
  stateFeasibilityConversion: number;
  opportunityFeasibilityConversion: number;
  weightedPoolConversion: number;
  drawToAcceptanceConversion: number;
  eligibleRoundConversion: number;
  observedRouteShare: number;
  theoreticalUniformRouteShare: number;
  normalizedExposure: number;
  rejectionCounts: Readonly<Record<EventSelectionRejectionReason, number>>;
}

export interface EventSelectionFunnelPoolExposureMetric {
  informationalOnly: true;
  gameSize: EventDistributionGameSizeId;
  poolId: EventDistributionPoolId;
  definitionId: string;
  acceptedSelections: number;
  uniformExpectedSelections: number;
  observedPoolShare: number;
  theoreticalUniformPoolShare: number;
  normalizedExposure: number;
}

export interface EventSelectionFunnelRouteMetric {
  gameSize: EventDistributionGameSizeId;
  poolId: EventDistributionPoolId;
  stage: EventSelectionDiagnosticStage;
  games: number;
  opportunities: number;
  definitions: number;
  eligibleDefinitionOpportunities: number;
  stateFeasibleDefinitionOpportunities: number;
  opportunityFeasibleDefinitionOpportunities: number;
  plannerAdmittedDefinitionOpportunities: number;
  weightedPoolDefinitionOpportunities: number;
  weightedPoolEntries: number;
  uniformExpectedSelections: number;
  drawAttempts: number;
  rejectedDraws: number;
  acceptedSelections: number;
  eventHistorySelections: number;
  reconciliationPassed: boolean;
}

export interface EventSelectionFunnelReconciliationRoute {
  gameSize: EventDistributionGameSizeId;
  poolId: EventDistributionPoolId;
  stage: EventSelectionDiagnosticStage;
  acceptedRows: number;
  aggregateDiagnosticSelections: number;
  passed: boolean;
}

export interface EventSelectionFunnelReconciliation {
  passed: boolean;
  opportunityRows: number;
  opportunities: number;
  drawAttempts: number;
  rejectedDraws: number;
  acceptedRows: number;
  aggregateDiagnosticSelections: number;
  eventHistorySelections: number;
  failures: readonly string[];
  routes: readonly EventSelectionFunnelReconciliationRoute[];
}

export interface EventSelectionFunnelReport {
  schemaVersion: typeof EVENT_SELECTION_FUNNEL_SCHEMA_VERSION;
  definitions: readonly EventSelectionFunnelDefinitionMetric[];
  poolExposure: readonly EventSelectionFunnelPoolExposureMetric[];
  routes: readonly EventSelectionFunnelRouteMetric[];
  reconciliation: EventSelectionFunnelReconciliation;
}

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function createRejectionCounts(): Record<EventSelectionRejectionReason, number> {
  return Object.fromEntries(
    EVENT_SELECTION_REJECTION_REASONS.map((reason) => [reason, 0]),
  ) as Record<EventSelectionRejectionReason, number>;
}

function getGameSize(run: SimulationRun): EventDistributionGameSizeId {
  return run.districtCount === 6 ? "half-game" : "full-game";
}

function classifyHistoryPool(event: ResolvedEvent): EventDistributionPoolId | null {
  if (event.kind !== "primary") {
    return null;
  }

  if (event.feedGroup === "bloodbath-cornucopia") {
    return "bloodbath-cornucopia";
  }

  if (event.feedGroup === "bloodbath-flee") {
    return "bloodbath-flee";
  }

  if (event.round.period === "night") {
    return "night";
  }

  return event.round.day >= 2 ? "later-day" : null;
}

function createDefinitionKey(
  gameSize: EventDistributionGameSizeId,
  poolId: EventDistributionPoolId,
  stage: EventSelectionDiagnosticStage,
  definitionId: string,
): string {
  return [gameSize, poolId, stage, definitionId].join("\u0000");
}

function createRouteKey(
  gameSize: EventDistributionGameSizeId,
  poolId: EventDistributionPoolId,
  stage: EventSelectionDiagnosticStage,
): string {
  return [gameSize, poolId, stage].join("\u0000");
}

function createPoolDefinitionKey(
  gameSize: EventDistributionGameSizeId,
  poolId: EventDistributionPoolId,
  definitionId: string,
): string {
  return [gameSize, poolId, definitionId].join("\u0000");
}

function createRunDefinitionKey(
  seed: string,
  poolId: EventDistributionPoolId,
  definitionId: string,
): string {
  return [seed, poolId, definitionId].join("\u0000");
}

function createRunRouteDefinitionKey(
  seed: string,
  poolId: EventDistributionPoolId,
  stage: EventSelectionDiagnosticStage,
  definitionId: string,
): string {
  return [seed, poolId, stage, definitionId].join("\u0000");
}

function createRoundKey(row: EventSelectionOpportunityRecord): string {
  return [row.gameSeed, row.roundSequence].join("\u0000");
}

function sortedOpportunityRows(runs: readonly SimulationRun[]): Array<
  EventSelectionOpportunityRecord & {
    gameSize: EventDistributionGameSizeId;
  }
> {
  return runs
    .flatMap((run) => {
      const gameSize = getGameSize(run);

      return (run.selectionDiagnostics?.opportunities ?? []).map((row) => ({
        ...row,
        gameSize,
      }));
    })
    .sort(
      (first, second) =>
        first.gameSeed.localeCompare(second.gameSeed) ||
        first.roundSequence - second.roundSequence ||
        first.poolId.localeCompare(second.poolId) ||
        first.stage.localeCompare(second.stage) ||
        first.opportunityIndex - second.opportunityIndex ||
        first.definitionId.localeCompare(second.definitionId),
    );
}

function getActiveDefinitions(): Map<string, EventDefinition> {
  const definitions = new Map<string, EventDefinition>();

  for (const family of BLOODBATH_EVENT_CATALOGUE_FAMILIES) {
    for (const definition of family.events as readonly EventDefinition[]) {
      definitions.set(definition.id, definition);
    }
  }

  for (const family of ORDINARY_EVENT_CATALOGUE_FAMILIES) {
    for (const definition of family.events as readonly EventDefinition[]) {
      definitions.set(definition.id, definition);
    }
  }

  return definitions;
}

function countMapValue(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function createReconciliation(
  runs: readonly SimulationRun[],
  rows: ReturnType<typeof sortedOpportunityRows>,
): EventSelectionFunnelReconciliation {
  const failures: string[] = [];
  const opportunityContexts = new Map<
    string,
    {
      signature: string;
      definitionIds: Set<string>;
      accepted: number;
    }
  >();
  const acceptedByRunDefinition = new Map<string, number>();
  const historyByRunDefinition = new Map<string, number>();
  const acceptedByRunRouteDefinition = new Map<string, number>();
  const aggregateByRunRouteDefinition = new Map<string, number>();
  const instrumentedDefinitionsByRunPool = new Map<string, Set<string>>();

  for (const row of rows) {
    const expectedOpportunityId = createEventSelectionOpportunityId(row);

    if (row.opportunityId !== expectedOpportunityId) {
      failures.push(
        `Opportunity identity mismatch for ${row.gameSeed}/${row.poolId}/${row.stage}/${row.definitionId}.`,
      );
    }

    if (row.stateFeasible !== row.hardFeasible) {
      failures.push(
        `State-feasibility alias mismatch for ${row.opportunityId}/${row.definitionId}.`,
      );
    }

    if (row.opportunityFeasible && !row.hardFeasible) {
      failures.push(
        `Opportunity-feasible row is not state-feasible: ${row.opportunityId}/${row.definitionId}.`,
      );
    }

    if (row.plannerAdmitted && !row.opportunityFeasible) {
      failures.push(
        `Planner-admitted row is not opportunity-feasible: ${row.opportunityId}/${row.definitionId}.`,
      );
    }

    if (row.finalWeightedPool && (!row.plannerAdmitted || row.weightedPoolEntryCount <= 0)) {
      failures.push(
        `Weighted-pool row did not pass preceding stages: ${row.opportunityId}/${row.definitionId}.`,
      );
    }

    if (row.drawn && (!row.finalWeightedPool || row.drawAttemptCount <= 0)) {
      failures.push(
        `Drawn row lacks weighted-pool evidence: ${row.opportunityId}/${row.definitionId}.`,
      );
    }

    if (row.resolvedAccepted && (!row.drawn || row.rejectionReason !== null)) {
      failures.push(`Accepted row lacks a clean draw: ${row.opportunityId}/${row.definitionId}.`);
    }

    if (
      row.drawn &&
      !row.resolvedAccepted &&
      (!row.rejectionReason || !POST_DRAW_REJECTION_REASONS.has(row.rejectionReason))
    ) {
      failures.push(
        `Rejected draw lacks a post-draw reason: ${row.opportunityId}/${row.definitionId}.`,
      );
    }

    const signature = [
      row.gameSeed,
      row.roundSequence,
      row.roundPeriod,
      row.roundDay,
      row.poolId,
      row.stage,
      row.opportunityIndex,
    ].join("\u0000");
    const opportunity = opportunityContexts.get(row.opportunityId) ?? {
      signature,
      definitionIds: new Set<string>(),
      accepted: 0,
    };

    if (opportunity.signature !== signature) {
      failures.push(`Opportunity ${row.opportunityId} has inconsistent context.`);
    }

    if (opportunity.definitionIds.has(row.definitionId)) {
      failures.push(`Opportunity ${row.opportunityId} repeats definition ${row.definitionId}.`);
    }

    opportunity.definitionIds.add(row.definitionId);
    opportunity.accepted += row.resolvedAccepted ? 1 : 0;
    opportunityContexts.set(row.opportunityId, opportunity);

    if (row.resolvedAccepted) {
      countMapValue(
        acceptedByRunDefinition,
        createRunDefinitionKey(row.gameSeed, row.poolId, row.definitionId),
      );
      countMapValue(
        acceptedByRunRouteDefinition,
        createRunRouteDefinitionKey(row.gameSeed, row.poolId, row.stage, row.definitionId),
      );
    }

    const runPoolKey = [row.gameSeed, row.poolId].join("\u0000");
    const instrumented = instrumentedDefinitionsByRunPool.get(runPoolKey) ?? new Set<string>();
    instrumented.add(row.definitionId);
    instrumentedDefinitionsByRunPool.set(runPoolKey, instrumented);
  }

  for (const [opportunityId, opportunity] of opportunityContexts) {
    if (opportunity.accepted > 1) {
      failures.push(`Opportunity ${opportunityId} accepted more than one definition.`);
    }
  }

  for (const run of runs) {
    if (!run.selectionDiagnostics) {
      failures.push(`Simulation ${run.seed} lacks selection diagnostics.`);
      continue;
    }

    for (const stage of run.selectionDiagnostics.stages) {
      for (const definition of stage.definitions) {
        const key = createRunRouteDefinitionKey(
          run.seed,
          stage.poolId,
          stage.stage,
          definition.definitionId,
        );
        aggregateByRunRouteDefinition.set(
          key,
          (aggregateByRunRouteDefinition.get(key) ?? 0) + definition.selected,
        );
      }
    }

    for (const event of run.state.eventHistory) {
      const poolId = classifyHistoryPool(event);

      if (!poolId) {
        continue;
      }

      const instrumented = instrumentedDefinitionsByRunPool.get([run.seed, poolId].join("\u0000"));

      if (
        isLifecyclePrimaryDefinition(event.definitionId) ||
        !instrumented?.has(event.definitionId)
      ) {
        continue;
      }

      countMapValue(
        historyByRunDefinition,
        createRunDefinitionKey(run.seed, poolId, event.definitionId),
      );
    }
  }

  for (const key of new Set([
    ...acceptedByRunDefinition.keys(),
    ...historyByRunDefinition.keys(),
  ])) {
    const accepted = acceptedByRunDefinition.get(key) ?? 0;
    const history = historyByRunDefinition.get(key) ?? 0;

    if (accepted !== history) {
      failures.push(
        `Accepted/history mismatch for ${key.replaceAll("\u0000", "/")}: ${accepted} versus ${history}.`,
      );
    }
  }

  for (const key of new Set([
    ...acceptedByRunRouteDefinition.keys(),
    ...aggregateByRunRouteDefinition.keys(),
  ])) {
    const accepted = acceptedByRunRouteDefinition.get(key) ?? 0;
    const aggregate = aggregateByRunRouteDefinition.get(key) ?? 0;

    if (accepted !== aggregate) {
      failures.push(
        `Opportunity/aggregate mismatch for ${key.replaceAll("\u0000", "/")}: ${accepted} versus ${aggregate}.`,
      );
    }
  }

  const routeKeys = new Set<string>();

  for (const row of rows) {
    routeKeys.add(createRouteKey(row.gameSize, row.poolId, row.stage));
  }

  const routes = [...routeKeys]
    .map((key): EventSelectionFunnelReconciliationRoute => {
      const [gameSize, poolId, stage] = key.split("\u0000") as [
        EventDistributionGameSizeId,
        EventDistributionPoolId,
        EventSelectionDiagnosticStage,
      ];
      const acceptedRows = rows.filter(
        (row) =>
          row.gameSize === gameSize &&
          row.poolId === poolId &&
          row.stage === stage &&
          row.resolvedAccepted,
      ).length;
      const aggregateDiagnosticSelections = runs
        .filter((run) => getGameSize(run) === gameSize)
        .reduce(
          (total, run) =>
            total +
            (run.selectionDiagnostics?.stages ?? [])
              .filter((candidate) => candidate.poolId === poolId && candidate.stage === stage)
              .reduce(
                (stageTotal, candidate) =>
                  stageTotal +
                  candidate.definitions.reduce(
                    (definitionTotal, definition) => definitionTotal + definition.selected,
                    0,
                  ),
                0,
              ),
          0,
        );

      return {
        gameSize,
        poolId,
        stage,
        acceptedRows,
        aggregateDiagnosticSelections,
        passed: acceptedRows === aggregateDiagnosticSelections,
      };
    })
    .sort(
      (first, second) =>
        first.gameSize.localeCompare(second.gameSize) ||
        first.poolId.localeCompare(second.poolId) ||
        first.stage.localeCompare(second.stage),
    );

  const drawAttempts = rows.reduce((total, row) => total + row.drawAttemptCount, 0);
  const acceptedRows = rows.filter((row) => row.resolvedAccepted).length;
  const aggregateDiagnosticSelections = routes.reduce(
    (total, route) => total + route.aggregateDiagnosticSelections,
    0,
  );
  const eventHistorySelections = [...historyByRunDefinition.values()].reduce(
    (total, count) => total + count,
    0,
  );

  return {
    passed:
      failures.length === 0 &&
      routes.every((route) => route.passed) &&
      acceptedRows === aggregateDiagnosticSelections &&
      acceptedRows === eventHistorySelections,
    opportunityRows: rows.length,
    opportunities: opportunityContexts.size,
    drawAttempts,
    rejectedDraws: drawAttempts - acceptedRows,
    acceptedRows,
    aggregateDiagnosticSelections,
    eventHistorySelections,
    failures,
    routes,
  };
}

export function createEventSelectionFunnelReport(
  runs: readonly SimulationRun[],
): EventSelectionFunnelReport {
  const rows = sortedOpportunityRows(runs);
  const activeDefinitions = getActiveDefinitions();
  const gamesBySize = new Map<EventDistributionGameSizeId, number>();

  for (const run of runs) {
    const gameSize = getGameSize(run);
    gamesBySize.set(gameSize, (gamesBySize.get(gameSize) ?? 0) + 1);
  }

  const mutableByKey = new Map<string, MutableDefinitionMetric>();

  for (const row of rows) {
    const key = createDefinitionKey(row.gameSize, row.poolId, row.stage, row.definitionId);
    const mutable = mutableByKey.get(key) ?? {
      gameSize: row.gameSize,
      poolId: row.poolId,
      stage: row.stage,
      definitionId: row.definitionId,
      games: gamesBySize.get(row.gameSize) ?? 0,
      eligibleGames: new Set<string>(),
      stateFeasibleGames: new Set<string>(),
      opportunityFeasibleGames: new Set<string>(),
      weightedPoolGames: new Set<string>(),
      drawnGames: new Set<string>(),
      selectedGames: new Set<string>(),
      eligibleRounds: new Set<string>(),
      selectedRounds: new Set<string>(),
      eligibleOpportunities: 0,
      stateFeasibleOpportunities: 0,
      opportunityFeasibleOpportunities: 0,
      plannerAdmittedOpportunities: 0,
      weightedPoolOpportunities: 0,
      weightedPoolEntries: 0,
      uniformExpectedSelections: 0,
      drawAttempts: 0,
      rejectedDraws: 0,
      acceptedSelections: 0,
      rejectionCounts: createRejectionCounts(),
    };

    if (row.eligible) {
      mutable.eligibleGames.add(row.gameSeed);
      mutable.eligibleOpportunities += 1;

      if (row.poolId === "later-day" || row.poolId === "night") {
        mutable.eligibleRounds.add(createRoundKey(row));
      }
    }

    if (row.hardFeasible) {
      mutable.stateFeasibleGames.add(row.gameSeed);
      mutable.stateFeasibleOpportunities += 1;
    }

    if (row.opportunityFeasible) {
      mutable.opportunityFeasibleGames.add(row.gameSeed);
      mutable.opportunityFeasibleOpportunities += 1;
    }

    if (row.plannerAdmitted) {
      mutable.plannerAdmittedOpportunities += 1;
    }

    if (row.finalWeightedPool) {
      mutable.weightedPoolGames.add(row.gameSeed);
      mutable.weightedPoolOpportunities += 1;
    }

    if (row.drawn) {
      mutable.drawnGames.add(row.gameSeed);
    }

    if (row.resolvedAccepted) {
      mutable.selectedGames.add(row.gameSeed);
      mutable.acceptedSelections += 1;

      if (row.poolId === "later-day" || row.poolId === "night") {
        mutable.selectedRounds.add(createRoundKey(row));
      }
    }

    mutable.weightedPoolEntries += row.weightedPoolEntryCount;
    mutable.uniformExpectedSelections += row.uniformExpectedSelections;
    mutable.drawAttempts += row.drawAttemptCount;
    mutable.rejectedDraws += row.drawAttemptCount - (row.resolvedAccepted ? 1 : 0);

    if (row.rejectionReason) {
      mutable.rejectionCounts[row.rejectionReason] += 1;
    }

    mutableByKey.set(key, mutable);
  }

  const routeTotals = new Map<
    string,
    { acceptedSelections: number; uniformExpectedSelections: number }
  >();

  for (const mutable of mutableByKey.values()) {
    const key = createRouteKey(mutable.gameSize, mutable.poolId, mutable.stage);
    const totals = routeTotals.get(key) ?? {
      acceptedSelections: 0,
      uniformExpectedSelections: 0,
    };

    totals.acceptedSelections += mutable.acceptedSelections;
    totals.uniformExpectedSelections += mutable.uniformExpectedSelections;
    routeTotals.set(key, totals);
  }

  const definitions = [...mutableByKey.values()]
    .map((mutable): EventSelectionFunnelDefinitionMetric => {
      const definition = activeDefinitions.get(mutable.definitionId);
      const specificity = definition ? getEventAuditSpecificityBreakdown(definition) : null;
      const route = routeTotals.get(
        createRouteKey(mutable.gameSize, mutable.poolId, mutable.stage),
      ) ?? {
        acceptedSelections: 0,
        uniformExpectedSelections: 0,
      };
      const observedRouteShare = divide(mutable.acceptedSelections, route.acceptedSelections);
      const theoreticalUniformRouteShare = divide(
        mutable.uniformExpectedSelections,
        route.uniformExpectedSelections,
      );

      return {
        gameSize: mutable.gameSize,
        poolId: mutable.poolId,
        stage: mutable.stage,
        definitionId: mutable.definitionId,
        games: mutable.games,
        broadEvent: specificity?.broadEvent ?? null,
        auditSpecificityScore: specificity?.score ?? null,
        authoredSpecificityScore: specificity?.authoredScore ?? null,
        structuralSpecificityScore: specificity?.structuralScore ?? null,
        specificityReasons: specificity?.reasons ?? [],
        distinctGamesEligible: mutable.eligibleGames.size,
        distinctGamesStateFeasible: mutable.stateFeasibleGames.size,
        distinctGamesOpportunityFeasible: mutable.opportunityFeasibleGames.size,
        distinctGamesWeightedPool: mutable.weightedPoolGames.size,
        distinctGamesDrawn: mutable.drawnGames.size,
        distinctGamesSelected: mutable.selectedGames.size,
        eligibleOpportunities: mutable.eligibleOpportunities,
        stateFeasibleOpportunities: mutable.stateFeasibleOpportunities,
        opportunityFeasibleOpportunities: mutable.opportunityFeasibleOpportunities,
        plannerAdmittedOpportunities: mutable.plannerAdmittedOpportunities,
        weightedPoolOpportunities: mutable.weightedPoolOpportunities,
        weightedPoolEntries: mutable.weightedPoolEntries,
        uniformExpectedSelections: mutable.uniformExpectedSelections,
        drawAttempts: mutable.drawAttempts,
        rejectedDraws: mutable.rejectedDraws,
        acceptedSelections: mutable.acceptedSelections,
        eligibleRounds: mutable.eligibleRounds.size,
        selectedRounds: mutable.selectedRounds.size,
        stateFeasibilityConversion: divide(
          mutable.stateFeasibleOpportunities,
          mutable.eligibleOpportunities,
        ),
        opportunityFeasibilityConversion: divide(
          mutable.opportunityFeasibleOpportunities,
          mutable.stateFeasibleOpportunities,
        ),
        weightedPoolConversion: divide(
          mutable.weightedPoolOpportunities,
          mutable.opportunityFeasibleOpportunities,
        ),
        drawToAcceptanceConversion: divide(mutable.acceptedSelections, mutable.drawAttempts),
        eligibleRoundConversion: divide(mutable.selectedRounds.size, mutable.eligibleRounds.size),
        observedRouteShare,
        theoreticalUniformRouteShare,
        normalizedExposure: divide(observedRouteShare, theoreticalUniformRouteShare),
        rejectionCounts: { ...mutable.rejectionCounts },
      };
    })
    .sort(
      (first, second) =>
        first.gameSize.localeCompare(second.gameSize) ||
        first.poolId.localeCompare(second.poolId) ||
        first.stage.localeCompare(second.stage) ||
        first.definitionId.localeCompare(second.definitionId),
    );

  const poolMutable = new Map<
    string,
    {
      gameSize: EventDistributionGameSizeId;
      poolId: EventDistributionPoolId;
      definitionId: string;
      acceptedSelections: number;
      uniformExpectedSelections: number;
    }
  >();

  for (const definition of definitions) {
    const key = createPoolDefinitionKey(
      definition.gameSize,
      definition.poolId,
      definition.definitionId,
    );
    const mutable = poolMutable.get(key) ?? {
      gameSize: definition.gameSize,
      poolId: definition.poolId,
      definitionId: definition.definitionId,
      acceptedSelections: 0,
      uniformExpectedSelections: 0,
    };

    mutable.acceptedSelections += definition.acceptedSelections;
    mutable.uniformExpectedSelections += definition.uniformExpectedSelections;
    poolMutable.set(key, mutable);
  }

  const poolTotals = new Map<
    string,
    { acceptedSelections: number; uniformExpectedSelections: number }
  >();

  for (const mutable of poolMutable.values()) {
    const key = [mutable.gameSize, mutable.poolId].join("\u0000");
    const totals = poolTotals.get(key) ?? {
      acceptedSelections: 0,
      uniformExpectedSelections: 0,
    };

    totals.acceptedSelections += mutable.acceptedSelections;
    totals.uniformExpectedSelections += mutable.uniformExpectedSelections;
    poolTotals.set(key, totals);
  }

  const poolExposure = [...poolMutable.values()]
    .map((mutable): EventSelectionFunnelPoolExposureMetric => {
      const totals = poolTotals.get([mutable.gameSize, mutable.poolId].join("\u0000")) ?? {
        acceptedSelections: 0,
        uniformExpectedSelections: 0,
      };
      const observedPoolShare = divide(mutable.acceptedSelections, totals.acceptedSelections);
      const theoreticalUniformPoolShare = divide(
        mutable.uniformExpectedSelections,
        totals.uniformExpectedSelections,
      );

      return {
        informationalOnly: true,
        gameSize: mutable.gameSize,
        poolId: mutable.poolId,
        definitionId: mutable.definitionId,
        acceptedSelections: mutable.acceptedSelections,
        uniformExpectedSelections: mutable.uniformExpectedSelections,
        observedPoolShare,
        theoreticalUniformPoolShare,
        normalizedExposure: divide(observedPoolShare, theoreticalUniformPoolShare),
      };
    })
    .sort(
      (first, second) =>
        first.gameSize.localeCompare(second.gameSize) ||
        first.poolId.localeCompare(second.poolId) ||
        first.definitionId.localeCompare(second.definitionId),
    );

  const reconciliation = createReconciliation(runs, rows);
  const historyByGameRoute = new Map<string, number>();

  for (const run of runs) {
    const gameSize = getGameSize(run);
    const acceptedDefinitionsByPool = new Map<EventDistributionPoolId, Set<string>>();

    for (const row of rows.filter((candidate) => candidate.gameSeed === run.seed)) {
      const definitions = acceptedDefinitionsByPool.get(row.poolId) ?? new Set<string>();
      definitions.add(row.definitionId);
      acceptedDefinitionsByPool.set(row.poolId, definitions);
    }

    for (const event of run.state.eventHistory) {
      const poolId = classifyHistoryPool(event);

      if (
        !poolId ||
        isLifecyclePrimaryDefinition(event.definitionId) ||
        !acceptedDefinitionsByPool.get(poolId)?.has(event.definitionId)
      ) {
        continue;
      }

      const acceptedRow = rows.find(
        (row) =>
          row.gameSeed === run.seed &&
          row.poolId === poolId &&
          row.definitionId === event.definitionId &&
          row.resolvedAccepted,
      );

      if (acceptedRow) {
        countMapValue(historyByGameRoute, createRouteKey(gameSize, poolId, acceptedRow.stage));
      }
    }
  }

  const routeKeys = new Set(
    definitions.map((definition) =>
      createRouteKey(definition.gameSize, definition.poolId, definition.stage),
    ),
  );

  const routes = [...routeKeys]
    .map((key): EventSelectionFunnelRouteMetric => {
      const [gameSize, poolId, stage] = key.split("\u0000") as [
        EventDistributionGameSizeId,
        EventDistributionPoolId,
        EventSelectionDiagnosticStage,
      ];
      const routeRows = rows.filter(
        (row) => row.gameSize === gameSize && row.poolId === poolId && row.stage === stage,
      );
      const routeDefinitions = definitions.filter(
        (definition) =>
          definition.gameSize === gameSize &&
          definition.poolId === poolId &&
          definition.stage === stage,
      );
      const acceptedSelections = routeDefinitions.reduce(
        (total, definition) => total + definition.acceptedSelections,
        0,
      );
      const eventHistorySelections = historyByGameRoute.get(key) ?? 0;

      return {
        gameSize,
        poolId,
        stage,
        games: gamesBySize.get(gameSize) ?? 0,
        opportunities: new Set(routeRows.map((row) => row.opportunityId)).size,
        definitions: routeDefinitions.length,
        eligibleDefinitionOpportunities: routeDefinitions.reduce(
          (total, definition) => total + definition.eligibleOpportunities,
          0,
        ),
        stateFeasibleDefinitionOpportunities: routeDefinitions.reduce(
          (total, definition) => total + definition.stateFeasibleOpportunities,
          0,
        ),
        opportunityFeasibleDefinitionOpportunities: routeDefinitions.reduce(
          (total, definition) => total + definition.opportunityFeasibleOpportunities,
          0,
        ),
        plannerAdmittedDefinitionOpportunities: routeDefinitions.reduce(
          (total, definition) => total + definition.plannerAdmittedOpportunities,
          0,
        ),
        weightedPoolDefinitionOpportunities: routeDefinitions.reduce(
          (total, definition) => total + definition.weightedPoolOpportunities,
          0,
        ),
        weightedPoolEntries: routeDefinitions.reduce(
          (total, definition) => total + definition.weightedPoolEntries,
          0,
        ),
        uniformExpectedSelections: routeDefinitions.reduce(
          (total, definition) => total + definition.uniformExpectedSelections,
          0,
        ),
        drawAttempts: routeDefinitions.reduce(
          (total, definition) => total + definition.drawAttempts,
          0,
        ),
        rejectedDraws: routeDefinitions.reduce(
          (total, definition) => total + definition.rejectedDraws,
          0,
        ),
        acceptedSelections,
        eventHistorySelections,
        reconciliationPassed: acceptedSelections === eventHistorySelections,
      };
    })
    .sort(
      (first, second) =>
        first.gameSize.localeCompare(second.gameSize) ||
        first.poolId.localeCompare(second.poolId) ||
        first.stage.localeCompare(second.stage),
    );

  return {
    schemaVersion: EVENT_SELECTION_FUNNEL_SCHEMA_VERSION,
    definitions,
    poolExposure,
    routes,
    reconciliation,
  };
}

function sanitizeTsv(value: string): string {
  return value.replaceAll("\t", " ").replaceAll("\r", " ").replaceAll("\n", " ");
}

export function createEventSelectionFunnelTsv(runs: readonly SimulationRun[]): string {
  const header = [
    "seed",
    "game_size",
    "round_sequence",
    "round_period",
    "round_day",
    "pool",
    "route",
    "opportunity_index",
    "opportunity_id",
    "definition_id",
    "considered",
    "eligible",
    "state_feasible",
    "opportunity_feasible",
    "planner_admitted",
    "final_weighted_pool",
    "weighted_pool_entry_count",
    "uniform_expected_selections",
    "draw_attempt_count",
    "drawn",
    "rejected_draw_attempts",
    "resolved_accepted",
    "rejection_reason",
  ];

  const rows = sortedOpportunityRows(runs).map((row) =>
    [
      row.gameSeed,
      row.gameSize,
      row.roundSequence,
      row.roundPeriod,
      row.roundDay,
      row.poolId,
      row.stage,
      row.opportunityIndex,
      row.opportunityId,
      row.definitionId,
      row.considered,
      row.eligible,
      row.hardFeasible,
      row.opportunityFeasible,
      row.plannerAdmitted,
      row.finalWeightedPool,
      row.weightedPoolEntryCount,
      row.uniformExpectedSelections,
      row.drawAttemptCount,
      row.drawn,
      row.drawAttemptCount - (row.resolvedAccepted ? 1 : 0),
      row.resolvedAccepted,
      row.rejectionReason ?? "",
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

export function createEventSelectionFunnelSummaryTsv(report: EventSelectionFunnelReport): string {
  const header = [
    "game_size",
    "pool",
    "route",
    "definition_id",
    "broad_event",
    "audit_specificity_score",
    "authored_specificity_score",
    "structural_specificity_score",
    "specificity_reasons",
    "games",
    "games_eligible",
    "games_state_feasible",
    "games_opportunity_feasible",
    "games_weighted_pool",
    "games_drawn",
    "games_selected",
    "eligible_opportunities",
    "state_feasible_opportunities",
    "opportunity_feasible_opportunities",
    "planner_admitted_opportunities",
    "weighted_pool_opportunities",
    "weighted_pool_entries",
    "uniform_expected_selections",
    "draw_attempts",
    "rejected_draws",
    "accepted_selections",
    "eligible_rounds",
    "selected_rounds",
    "state_feasibility_conversion",
    "opportunity_feasibility_conversion",
    "weighted_pool_conversion",
    "draw_to_acceptance_conversion",
    "eligible_round_conversion",
    "observed_route_share",
    "theoretical_uniform_route_share",
    "normalized_exposure",
    ...EVENT_SELECTION_REJECTION_REASONS.map((reason) => `rejected_${reason}`),
  ];

  const rows = report.definitions.map((definition) =>
    [
      definition.gameSize,
      definition.poolId,
      definition.stage,
      definition.definitionId,
      definition.broadEvent ?? "",
      definition.auditSpecificityScore ?? "",
      definition.authoredSpecificityScore ?? "",
      definition.structuralSpecificityScore ?? "",
      definition.specificityReasons.join(","),
      definition.games,
      definition.distinctGamesEligible,
      definition.distinctGamesStateFeasible,
      definition.distinctGamesOpportunityFeasible,
      definition.distinctGamesWeightedPool,
      definition.distinctGamesDrawn,
      definition.distinctGamesSelected,
      definition.eligibleOpportunities,
      definition.stateFeasibleOpportunities,
      definition.opportunityFeasibleOpportunities,
      definition.plannerAdmittedOpportunities,
      definition.weightedPoolOpportunities,
      definition.weightedPoolEntries,
      definition.uniformExpectedSelections,
      definition.drawAttempts,
      definition.rejectedDraws,
      definition.acceptedSelections,
      definition.eligibleRounds,
      definition.selectedRounds,
      definition.stateFeasibilityConversion,
      definition.opportunityFeasibilityConversion,
      definition.weightedPoolConversion,
      definition.drawToAcceptanceConversion,
      definition.eligibleRoundConversion,
      definition.observedRouteShare,
      definition.theoreticalUniformRouteShare,
      definition.normalizedExposure,
      ...EVENT_SELECTION_REJECTION_REASONS.map((reason) => definition.rejectionCounts[reason]),
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

export function createEventSelectionFunnelMarkdown(report: EventSelectionFunnelReport): string[] {
  return [
    "## Opportunity-level selection funnel",
    "",
    `- Funnel schema: \`${report.schemaVersion}\``,
    `- Opportunity rows: ${report.reconciliation.opportunityRows}`,
    `- Distinct selector opportunities: ${report.reconciliation.opportunities}`,
    `- Draw attempts: ${report.reconciliation.drawAttempts}`,
    `- Rejected draws: ${report.reconciliation.rejectedDraws}`,
    `- Accepted selections: ${report.reconciliation.acceptedRows}`,
    `- Reconciliation: ${report.reconciliation.passed ? "passed" : "FAILED"}`,
    "",
    "| Game size | Pool | Route | Opportunities | State-feasible rows | Opportunity-feasible rows | Weighted-pool rows | Draws | Rejected draws | Accepted | History | Reconciled |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.routes.map(
      (route) =>
        `| ${route.gameSize} | ${route.poolId} | ${route.stage} | ${route.opportunities} | ${route.stateFeasibleDefinitionOpportunities} | ${route.opportunityFeasibleDefinitionOpportunities} | ${route.weightedPoolDefinitionOpportunities} | ${route.drawAttempts} | ${route.rejectedDraws} | ${route.acceptedSelections} | ${route.eventHistorySelections} | ${route.reconciliationPassed ? "yes" : "NO"} |`,
    ),
    "",
    "Route-level definition metrics, conditional conversions, broad-event classification, uniform expected share, and normalized exposure are written to `event-frequency-selection-funnel-summary.tsv`. Pool-level exposure is retained in JSON as informational aggregation only.",
    "",
    ...(report.reconciliation.failures.length === 0
      ? []
      : [
          "### Funnel reconciliation failures",
          "",
          ...report.reconciliation.failures.map((failure) => `- ${failure}`),
          "",
        ]),
  ];
}
