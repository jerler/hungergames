import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { getRoundSequence } from "~/game/engine/rounds";
import {
  BLOODBATH_EVENT_CATALOGUE_FAMILIES,
  ORDINARY_EVENT_CATALOGUE_FAMILIES,
} from "~/game/events/catalogue/catalogue-families";
import { getEventAuditPrerequisiteEvidence } from "~/game/events/event-audit-prerequisites";
import type {
  EventAuditPrerequisite,
  EventAuditStatusCondition,
  EventDefinition,
} from "~/game/events/event-schema";
import { getAccessibleInventoryItems } from "~/game/items/inventory-engine";
import type { ItemAcquisitionSource, ItemDefinitionId } from "~/game/items/item-schema";
import type { EventDistributionGameSizeId } from "~/game/simulation/event-distribution-metrics";
import type { EventSelectionOpportunityRecord } from "~/game/simulation/event-selection-opportunity";
import type { SimulationRun } from "~/game/simulation/simulation-runner";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type {
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
  TruceBreakReason,
  TruceKind,
} from "~/game/types/game-state";

type ItemPrerequisite = Extract<EventAuditPrerequisite, { kind: "item-definition" | "item-tag" }>;
type StatusPrerequisite =
  | Extract<EventAuditPrerequisite, { kind: "status" }>
  | Extract<EventAuditPrerequisite, { kind: "status-any" }>;
type StatusCondition = EventAuditStatusCondition;
type TruceRelationshipPrerequisite = Extract<EventAuditPrerequisite, { kind: "relationship" }> & {
  relationship: "truce";
};

type TrucePrerequisite =
  Extract<EventAuditPrerequisite, { kind: "truce" }> | TruceRelationshipPrerequisite;

interface MutableItemLifecycle {
  seed: string;
  gameSize: EventDistributionGameSizeId;
  definitionId: ItemDefinitionId;
  acquisitionSource: ItemAcquisitionSource;
  sourceDefinitionId: string;
  acquiredInstances: number;
  useEvents: number;
  consumptionEvents: number;
  consumedUses: number;
  transferEvents: number;
  destructionEvents: number;
  retainedInstances: number;
  ownedPreparedRoundExposures: number;
  truceAccessiblePreparedRoundExposures: number;
  ownedSelectorRounds: Set<string>;
  truceAccessibleSelectorRounds: Set<string>;
}

export interface ItemLifecycleByGameMetric {
  seed: string;
  gameSize: EventDistributionGameSizeId;
  definitionId: ItemDefinitionId;
  acquisitionSource: ItemAcquisitionSource;
  sourceDefinitionId: string;
  acquiredInstances: number;
  useEvents: number;
  consumptionEvents: number;
  consumedUses: number;
  transferEvents: number;
  destructionEvents: number;
  retainedInstances: number;
  ownedPreparedRoundExposures: number;
  truceAccessiblePreparedRoundExposures: number;
  ownedSelectorRounds: number;
  truceAccessibleSelectorRounds: number;
}

interface MutableStatusLifecycle {
  seed: string;
  gameSize: EventDistributionGameSizeId;
  statusId: StatusEffectId;
  applications: number;
  creations: number;
  severityChanges: number;
  severityDelta: number;
  removals: number;
  preparationRemovals: number;
  eventRemovals: number;
  roundEndRemovals: number;
  roundStartExposures: number;
  preparedSelectorRoundExposures: number;
  retainedAtGameEnd: number;
}

export type StatusLifecycleByGameMetric = MutableStatusLifecycle;

export interface StatusPreparationRemovalMetric {
  seed: string;
  gameSize: EventDistributionGameSizeId;
  roundDay: number;
  roundPeriod: RoundReference["period"];
  preparationDefinitionId: string;
  preparationMechanic: string;
  tributeId: string;
  statusId: StatusEffectId;
  removedSeverity: number;
  remainedAbsentBeforeSelection: boolean;
  dependentDefinitionIds: readonly string[];
  dependentSelectorOpportunities: number;
}

export interface TruceLifecycleMetric {
  seed: string;
  gameSize: EventDistributionGameSizeId;
  truceId: string;
  kind: TruceKind;
  size: number;
  sourceEventId: string;
  sourceDefinitionId: string;
  createdDay: number;
  createdPeriod: RoundReference["period"];
  createdRoundSequence: number;
  breakupDay: number | null;
  breakupPeriod: RoundReference["period"] | null;
  breakupRoundSequence: number | null;
  breakupReason: TruceBreakReason | null;
  breakupEventId: string | null;
  breakupDefinitionId: string | null;
  durationRoundSequenceSteps: number;
  preparedRoundsObservedActive: number;
  activeAtGameEnd: boolean;
  duplicateBreakAttempts: number;
}

interface MutablePrerequisiteMetricBase {
  gameSize: EventDistributionGameSizeId;
  definitionId: string;
  roleId: string;
  prerequisiteKey: string;
  opportunities: number;
  gamesWithOpportunity: Set<string>;
  stateAvailableOpportunities: number;
  hardFeasibleOpportunities: number;
  opportunityFeasibleOpportunities: number;
  weightedPoolEntries: number;
  acceptedSelections: number;
}

interface MutableItemPrerequisiteMetric extends MutablePrerequisiteMetricBase {
  prerequisiteKind: ItemPrerequisite["kind"];
  requirement: string;
  access: ItemPrerequisite["access"];
  requireUsable: boolean;
  usableByRoleId: string;
  matchingCandidateTotal: number;
  ownedPathOpportunities: number;
  trucePathOpportunities: number;
}

export interface ItemPrerequisiteAvailabilityMetric {
  gameSize: EventDistributionGameSizeId;
  definitionId: string;
  roleId: string;
  prerequisiteKind: ItemPrerequisite["kind"];
  requirement: string;
  access: ItemPrerequisite["access"];
  requireUsable: boolean;
  usableByRoleId: string;
  opportunities: number;
  gamesWithOpportunity: number;
  matchingCandidateTotal: number;
  stateAvailableOpportunities: number;
  stateAvailabilityRate: number;
  ownedPathOpportunities: number;
  trucePathOpportunities: number;
  hardFeasibleOpportunities: number;
  opportunityFeasibleOpportunities: number;
  weightedPoolEntries: number;
  acceptedSelections: number;
  flags: readonly string[];
}

interface MutableStatusPrerequisiteMetric extends MutablePrerequisiteMetricBase {
  prerequisiteKind: StatusPrerequisite["kind"];
  requirement: string;
  minimumMatchingCount: number;
  matchingCandidateTotal: number;
}

export interface StatusPrerequisiteAvailabilityMetric {
  gameSize: EventDistributionGameSizeId;
  definitionId: string;
  roleId: string;
  prerequisiteKind: StatusPrerequisite["kind"];
  requirement: string;
  minimumMatchingCount: number;
  opportunities: number;
  gamesWithOpportunity: number;
  matchingCandidateTotal: number;
  stateAvailableOpportunities: number;
  stateAvailabilityRate: number;
  hardFeasibleOpportunities: number;
  opportunityFeasibleOpportunities: number;
  weightedPoolEntries: number;
  acceptedSelections: number;
  flags: readonly string[];
}

interface MutableTrucePrerequisiteMetric extends MutablePrerequisiteMetricBase {
  requirement: string;
  compatibleTruceTotal: number;
  matchingCandidateTotal: number;
}

export interface TrucePrerequisiteAvailabilityMetric {
  gameSize: EventDistributionGameSizeId;
  definitionId: string;
  roleId: string;
  requirement: string;
  opportunities: number;
  gamesWithOpportunity: number;
  compatibleTruceTotal: number;
  matchingCandidateTotal: number;
  stateAvailableOpportunities: number;
  stateAvailabilityRate: number;
  hardFeasibleOpportunities: number;
  opportunityFeasibleOpportunities: number;
  weightedPoolEntries: number;
  acceptedSelections: number;
  flags: readonly string[];
}

export interface PrerequisiteLifecycleGameSizeSummary {
  gameSize: EventDistributionGameSizeId;
  games: number;
  itemAcquisitions: number;
  itemUses: number;
  itemConsumptions: number;
  itemTransfers: number;
  itemDestructions: number;
  itemRetained: number;
  statusApplications: number;
  statusCreations: number;
  statusSeverityChanges: number;
  statusRemovals: number;
  statusPreparationRemovals: number;
  statusRetained: number;
  truceFormations: number;
  truceBreakups: number;
  trucesActiveAtGameEnd: number;
}

export interface PrerequisiteLifecycleEvidenceReport {
  reconciliation: {
    passed: boolean;
    failures: readonly string[];
  };
  gameSizeSummaries: readonly PrerequisiteLifecycleGameSizeSummary[];
  itemLifecycleByGame: readonly ItemLifecycleByGameMetric[];
  itemPrerequisites: readonly ItemPrerequisiteAvailabilityMetric[];
  statusLifecycleByGame: readonly StatusLifecycleByGameMetric[];
  statusPrerequisites: readonly StatusPrerequisiteAvailabilityMetric[];
  statusPreparationRemovals: readonly StatusPreparationRemovalMetric[];
  truceLifecycles: readonly TruceLifecycleMetric[];
  trucePrerequisites: readonly TrucePrerequisiteAvailabilityMetric[];
}

interface PreparedRoundAudit {
  round: RoundReference;
  startState: GameState;
  preparedState: GameState;
  endState: GameState;
  preparationEvents: readonly ResolvedEvent[];
  primaryEvents: readonly ResolvedEvent[];
}

interface RunAudit {
  run: SimulationRun;
  gameSize: EventDistributionGameSizeId;
  preparedRounds: ReadonlyMap<string, PreparedRoundAudit>;
  itemLifecycle: ItemLifecycleByGameMetric[];
  statusLifecycle: StatusLifecycleByGameMetric[];
  statusPreparationRemovals: StatusPreparationRemovalMetric[];
  truceLifecycles: TruceLifecycleMetric[];
}

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function getGameSize(run: SimulationRun): EventDistributionGameSizeId {
  if (run.districtCount === 6) {
    return "half-game";
  }

  if (run.districtCount === 12) {
    return "full-game";
  }

  throw new Error(`Unsupported simulation district count "${String(run.districtCount)}".`);
}

function getRoundKey(round: RoundReference): string {
  return `${round.day}:${round.period}`;
}

function roundsMatch(first: RoundReference, second: RoundReference): boolean {
  return first.day === second.day && first.period === second.period;
}

function getFinalRoundSequence(run: SimulationRun): number {
  return Math.max(0, ...run.state.eventHistory.map((event) => getRoundSequence(event.round)));
}

function getActiveDefinitions(): EventDefinition[] {
  const definitions = new Map<string, EventDefinition>();

  for (const family of [
    ...BLOODBATH_EVENT_CATALOGUE_FAMILIES,
    ...ORDINARY_EVENT_CATALOGUE_FAMILIES,
  ]) {
    for (const definition of family.events as readonly EventDefinition[]) {
      definitions.set(definition.id, definition);
    }
  }

  return [...definitions.values()];
}

const ACTIVE_DEFINITIONS = getActiveDefinitions();
const DEFINITION_BY_ID = new Map(
  ACTIVE_DEFINITIONS.map((definition) => [definition.id, definition] as const),
);

function getRoleCount(definition: EventDefinition, roleId: string): number {
  const role = definition.roles.find((candidate) => candidate.id === roleId);

  if (!role) {
    throw new Error(
      `Audit prerequisite for "${definition.id}" references missing role "${roleId}".`,
    );
  }

  return role.count;
}

function getPreparationEvents(run: SimulationRun, round: RoundReference): ResolvedEvent[] {
  return run.state.eventHistory.filter(
    (event) => event.kind === "preparation" && roundsMatch(event.round, round),
  );
}

function getPrimaryEvents(run: SimulationRun, round: RoundReference): ResolvedEvent[] {
  return run.state.eventHistory.filter(
    (event) => event.kind === "primary" && roundsMatch(event.round, round),
  );
}

function getEndStateForRound(run: SimulationRun, snapshotIndex: number): GameState {
  return run.roundSnapshots[snapshotIndex + 1]?.state ?? run.state;
}

function getStatusByKey(state: GameState): Map<
  string,
  {
    tributeId: string;
    statusId: StatusEffectId;
    instanceId: string;
    severity: number;
  }
> {
  const statuses = new Map<
    string,
    {
      tributeId: string;
      statusId: StatusEffectId;
      instanceId: string;
      severity: number;
    }
  >();

  for (const tribute of state.tributes) {
    for (const status of tribute.statuses) {
      statuses.set(`${tribute.id}:${status.definitionId}`, {
        tributeId: tribute.id,
        statusId: status.definitionId,
        instanceId: status.id,
        severity: status.severity,
      });
    }
  }

  return statuses;
}

function getStatusLifecycleRow(
  rows: Map<string, MutableStatusLifecycle>,
  seed: string,
  gameSize: EventDistributionGameSizeId,
  statusId: StatusEffectId,
): MutableStatusLifecycle {
  const key = `${seed}:${statusId}`;
  const existing = rows.get(key);

  if (existing) {
    return existing;
  }

  const created: MutableStatusLifecycle = {
    seed,
    gameSize,
    statusId,
    applications: 0,
    creations: 0,
    severityChanges: 0,
    severityDelta: 0,
    removals: 0,
    preparationRemovals: 0,
    eventRemovals: 0,
    roundEndRemovals: 0,
    roundStartExposures: 0,
    preparedSelectorRoundExposures: 0,
    retainedAtGameEnd: 0,
  };

  rows.set(key, created);
  return created;
}

interface StatusRemovalObservation {
  tributeId: string;
  statusId: StatusEffectId;
  severity: number;
}

function recordStatusDiff({
  before,
  after,
  seed,
  gameSize,
  rows,
  removalKind,
}: {
  before: GameState;
  after: GameState;
  seed: string;
  gameSize: EventDistributionGameSizeId;
  rows: Map<string, MutableStatusLifecycle>;
  removalKind: "preparation" | "event" | "round-end";
}): StatusRemovalObservation[] {
  const beforeStatuses = getStatusByKey(before);
  const afterStatuses = getStatusByKey(after);
  const removals: StatusRemovalObservation[] = [];

  for (const [key, afterStatus] of afterStatuses) {
    const beforeStatus = beforeStatuses.get(key);
    const row = getStatusLifecycleRow(rows, seed, gameSize, afterStatus.statusId);

    if (!beforeStatus || beforeStatus.instanceId !== afterStatus.instanceId) {
      row.creations += 1;
      continue;
    }

    if (beforeStatus.severity !== afterStatus.severity) {
      row.severityChanges += 1;
      row.severityDelta += afterStatus.severity - beforeStatus.severity;
    }
  }

  for (const [key, beforeStatus] of beforeStatuses) {
    const afterStatus = afterStatuses.get(key);

    if (afterStatus && afterStatus.instanceId === beforeStatus.instanceId) {
      continue;
    }

    const row = getStatusLifecycleRow(rows, seed, gameSize, beforeStatus.statusId);

    row.removals += 1;

    if (removalKind === "preparation") {
      row.preparationRemovals += 1;
    } else if (removalKind === "event") {
      row.eventRemovals += 1;
    } else {
      row.roundEndRemovals += 1;
    }

    removals.push({
      tributeId: beforeStatus.tributeId,
      statusId: beforeStatus.statusId,
      severity: beforeStatus.severity,
    });
  }

  return removals;
}
function analyzePreparedRoundsAndStatuses(
  run: SimulationRun,
  failures: string[],
): {
  preparedRounds: Map<string, PreparedRoundAudit>;
  statusLifecycle: StatusLifecycleByGameMetric[];
  statusPreparationRemovals: StatusPreparationRemovalMetric[];
} {
  const gameSize = getGameSize(run);
  const statusRows = new Map<string, MutableStatusLifecycle>();
  const preparationRemovals: StatusPreparationRemovalMetric[] = [];
  const preparedRounds = new Map<string, PreparedRoundAudit>();

  const initialStatuses = getStatusByKey(run.roundSnapshots[0]?.state ?? run.state);

  const initialCounts = new Map<StatusEffectId, number>();
  for (const status of initialStatuses.values()) {
    initialCounts.set(status.statusId, (initialCounts.get(status.statusId) ?? 0) + 1);
  }

  for (let snapshotIndex = 0; snapshotIndex < run.roundSnapshots.length; snapshotIndex += 1) {
    const snapshot = run.roundSnapshots[snapshotIndex]!;
    const round = snapshot.round;
    const startState = snapshot.state;
    const preparationEvents = getPreparationEvents(run, round);
    const primaryEvents = getPrimaryEvents(run, round);

    for (const tribute of startState.tributes) {
      for (const status of tribute.statuses) {
        getStatusLifecycleRow(
          statusRows,
          run.seed,
          gameSize,
          status.definitionId,
        ).roundStartExposures += 1;
      }
    }

    let preparedState = startState;

    for (const event of preparationEvents) {
      for (const change of event.changes) {
        if (change.type === "apply-status") {
          getStatusLifecycleRow(
            statusRows,
            run.seed,
            gameSize,
            change.status.definitionId,
          ).applications += 1;
        }
      }

      const before = preparedState;
      const after = applyResolvedEvent(before, event);
      const removed = recordStatusDiff({
        before,
        after,
        seed: run.seed,
        gameSize,
        rows: statusRows,
        removalKind: "preparation",
      });

      for (const observation of removed) {
        preparationRemovals.push({
          seed: run.seed,
          gameSize,
          roundDay: round.day,
          roundPeriod: round.period,
          preparationDefinitionId: event.definitionId,
          preparationMechanic: event.preparation?.mechanic ?? "unknown-preparation",
          tributeId: observation.tributeId,
          statusId: observation.statusId,
          removedSeverity: observation.severity,
          remainedAbsentBeforeSelection: false,
          dependentDefinitionIds: [],
          dependentSelectorOpportunities: 0,
        });
      }

      preparedState = after;
    }

    for (const tribute of preparedState.tributes) {
      for (const status of tribute.statuses) {
        getStatusLifecycleRow(
          statusRows,
          run.seed,
          gameSize,
          status.definitionId,
        ).preparedSelectorRoundExposures += 1;
      }
    }

    const endState = getEndStateForRound(run, snapshotIndex);

    preparedRounds.set(getRoundKey(round), {
      round,
      startState,
      preparedState,
      endState,
      preparationEvents,
      primaryEvents,
    });

    let replayState = preparedState;

    for (const event of primaryEvents) {
      for (const change of event.changes) {
        if (change.type === "apply-status") {
          getStatusLifecycleRow(
            statusRows,
            run.seed,
            gameSize,
            change.status.definitionId,
          ).applications += 1;
        }
      }

      const before = replayState;

      try {
        replayState = applyResolvedEvent(replayState, event);
      } catch (error) {
        failures.push(
          `Status replay failed for ${run.seed}/${event.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        replayState = before;
        continue;
      }

      recordStatusDiff({
        before,
        after: replayState,
        seed: run.seed,
        gameSize,
        rows: statusRows,
        removalKind: "event",
      });
    }

    recordStatusDiff({
      before: replayState,
      after: endState,
      seed: run.seed,
      gameSize,
      rows: statusRows,
      removalKind: "round-end",
    });
  }

  for (const event of run.state.eventHistory) {
    if (event.kind === "primary" || event.kind === "preparation") {
      continue;
    }

    for (const change of event.changes) {
      if (change.type === "apply-status") {
        getStatusLifecycleRow(
          statusRows,
          run.seed,
          gameSize,
          change.status.definitionId,
        ).applications += 1;
      }
    }
  }

  for (const tribute of run.state.tributes) {
    for (const status of tribute.statuses) {
      getStatusLifecycleRow(
        statusRows,
        run.seed,
        gameSize,
        status.definitionId,
      ).retainedAtGameEnd += 1;
    }
  }

  const finalCounts = new Map<StatusEffectId, number>();
  for (const tribute of run.state.tributes) {
    for (const status of tribute.statuses) {
      finalCounts.set(status.definitionId, (finalCounts.get(status.definitionId) ?? 0) + 1);
    }
  }

  const allStatusIds = new Set<StatusEffectId>([
    ...initialCounts.keys(),
    ...finalCounts.keys(),
    ...[...statusRows.values()].map((row) => row.statusId),
  ]);

  for (const statusId of allStatusIds) {
    const row = getStatusLifecycleRow(statusRows, run.seed, gameSize, statusId);
    const expectedFinal = (initialCounts.get(statusId) ?? 0) + row.creations - row.removals;
    const actualFinal = finalCounts.get(statusId) ?? 0;

    if (expectedFinal !== actualFinal) {
      failures.push(
        `Status reconciliation failed for ${run.seed}/${statusId}: ` +
          `initial ${initialCounts.get(statusId) ?? 0} + creations ` +
          `${row.creations} - removals ${row.removals} = ` +
          `${expectedFinal}, final active ${actualFinal}.`,
      );
    }
  }

  for (const removal of preparationRemovals) {
    const prepared = preparedRounds.get(
      `${removal.roundDay}:${removal.roundPeriod}`,
    )?.preparedState;
    const tribute = prepared?.tributes.find((candidate) => candidate.id === removal.tributeId);

    removal.remainedAbsentBeforeSelection =
      tribute?.statuses.every((status) => status.definitionId !== removal.statusId) ?? true;
  }

  return {
    preparedRounds,
    statusLifecycle: [...statusRows.values()].sort((first, second) =>
      first.statusId.localeCompare(second.statusId),
    ),
    statusPreparationRemovals: preparationRemovals,
  };
}

interface ItemAcquisitionIdentity {
  definitionId: ItemDefinitionId;
  acquisitionSource: ItemAcquisitionSource;
  sourceDefinitionId: string;
}

function getItemLifecycleKey(seed: string, identity: ItemAcquisitionIdentity): string {
  return [
    seed,
    identity.definitionId,
    identity.acquisitionSource,
    identity.sourceDefinitionId,
  ].join(":");
}

function getOrCreateItemLifecycle(
  rows: Map<string, MutableItemLifecycle>,
  seed: string,
  gameSize: EventDistributionGameSizeId,
  identity: ItemAcquisitionIdentity,
): MutableItemLifecycle {
  const key = getItemLifecycleKey(seed, identity);
  const existing = rows.get(key);

  if (existing) {
    return existing;
  }

  const created: MutableItemLifecycle = {
    seed,
    gameSize,
    definitionId: identity.definitionId,
    acquisitionSource: identity.acquisitionSource,
    sourceDefinitionId: identity.sourceDefinitionId,
    acquiredInstances: 0,
    useEvents: 0,
    consumptionEvents: 0,
    consumedUses: 0,
    transferEvents: 0,
    destructionEvents: 0,
    retainedInstances: 0,
    ownedPreparedRoundExposures: 0,
    truceAccessiblePreparedRoundExposures: 0,
    ownedSelectorRounds: new Set<string>(),
    truceAccessibleSelectorRounds: new Set<string>(),
  };

  rows.set(key, created);
  return created;
}

function analyzeItemLifecycle(
  run: SimulationRun,
  preparedRounds: ReadonlyMap<string, PreparedRoundAudit>,
  failures: string[],
): ItemLifecycleByGameMetric[] {
  const gameSize = getGameSize(run);
  const eventById = new Map(run.state.eventHistory.map((event) => [event.id, event] as const));
  const acquisitionByInstance = new Map<string, ItemAcquisitionIdentity>();
  const acquisitionUsesByInstance = new Map<string, number | null>();
  const itemRows = new Map<string, MutableItemLifecycle>();

  const eventChangeCounts = {
    acquired: 0,
    consumed: 0,
    destroyed: 0,
    transferred: 0,
  };

  for (const event of run.state.eventHistory) {
    for (const change of event.changes) {
      switch (change.type) {
        case "acquire-item":
          eventChangeCounts.acquired += 1;
          break;
        case "consume-item":
          eventChangeCounts.consumed += 1;
          break;
        case "destroy-item":
          eventChangeCounts.destroyed += 1;
          break;
        case "transfer-item":
          eventChangeCounts.transferred += 1;
          break;
        default:
          break;
      }
    }
  }

  const transactionCounts = {
    acquired: 0,
    consumed: 0,
    destroyed: 0,
    transferred: 0,
  };

  for (const transaction of run.state.itemTransactions) {
    transactionCounts[transaction.type] += 1;

    if (transaction.type !== "acquired") {
      continue;
    }

    const sourceEvent = eventById.get(transaction.sourceId);

    if (!sourceEvent) {
      failures.push(
        `Item acquisition ${run.seed}/${transaction.itemInstanceId} ` +
          `references missing source event ${transaction.sourceId}.`,
      );
      continue;
    }

    if (acquisitionByInstance.has(transaction.itemInstanceId)) {
      failures.push(`Item ${run.seed}/${transaction.itemInstanceId} was acquired more than once.`);
      continue;
    }

    const identity: ItemAcquisitionIdentity = {
      definitionId: transaction.definitionId,
      acquisitionSource: transaction.acquisitionSource,
      sourceDefinitionId: sourceEvent.definitionId,
    };

    acquisitionByInstance.set(transaction.itemInstanceId, identity);
    acquisitionUsesByInstance.set(transaction.itemInstanceId, transaction.uses);
    getOrCreateItemLifecycle(itemRows, run.seed, gameSize, identity).acquiredInstances += 1;
  }

  for (const key of Object.keys(eventChangeCounts) as Array<keyof typeof eventChangeCounts>) {
    if (eventChangeCounts[key] !== transactionCounts[key]) {
      failures.push(
        `Item transaction reconciliation failed for ${run.seed}/${key}: ` +
          `${eventChangeCounts[key]} event change(s), ` +
          `${transactionCounts[key]} transaction(s).`,
      );
    }
  }

  function requireIdentity(
    itemInstanceId: string,
    context: string,
  ): ItemAcquisitionIdentity | null {
    const identity = acquisitionByInstance.get(itemInstanceId);

    if (!identity) {
      failures.push(
        `Item lifecycle ${run.seed}/${context} references ` + `untracked item ${itemInstanceId}.`,
      );
      return null;
    }

    return identity;
  }

  for (const event of run.state.eventHistory) {
    for (const change of event.changes) {
      if (change.type !== "use-item") {
        continue;
      }

      const identity = requireIdentity(change.itemInstanceId, `use:${event.id}`);

      if (identity) {
        getOrCreateItemLifecycle(itemRows, run.seed, gameSize, identity).useEvents += 1;
      }
    }
  }

  const consumedUsesByInstance = new Map<string, number>();
  const destroyedInstances = new Set<string>();

  for (const transaction of run.state.itemTransactions) {
    if (transaction.type === "acquired") {
      continue;
    }

    const identity = requireIdentity(
      transaction.itemInstanceId,
      `${transaction.type}:${transaction.id}`,
    );

    if (!identity) {
      continue;
    }

    const row = getOrCreateItemLifecycle(itemRows, run.seed, gameSize, identity);

    if (transaction.type === "consumed") {
      row.consumptionEvents += 1;
      row.consumedUses += transaction.uses;
      consumedUsesByInstance.set(
        transaction.itemInstanceId,
        (consumedUsesByInstance.get(transaction.itemInstanceId) ?? 0) + transaction.uses,
      );
    } else if (transaction.type === "destroyed") {
      row.destructionEvents += 1;
      destroyedInstances.add(transaction.itemInstanceId);
    } else {
      row.transferEvents += 1;
    }
  }

  const retainedInstanceIds = new Set<string>();

  for (const tribute of run.state.tributes) {
    for (const item of tribute.inventory) {
      retainedInstanceIds.add(item.id);

      const identity = requireIdentity(item.id, `retained:${tribute.id}`);

      if (identity) {
        getOrCreateItemLifecycle(itemRows, run.seed, gameSize, identity).retainedInstances += 1;
      }
    }
  }

  for (const [itemInstanceId, identity] of acquisitionByInstance.entries()) {
    if (retainedInstanceIds.has(itemInstanceId)) {
      continue;
    }

    if (destroyedInstances.has(itemInstanceId)) {
      continue;
    }

    const initialUses = acquisitionUsesByInstance.get(itemInstanceId);
    const consumedUses = consumedUsesByInstance.get(itemInstanceId) ?? 0;

    if (initialUses !== null && initialUses !== undefined && consumedUses >= initialUses) {
      continue;
    }

    failures.push(
      `Item ${run.seed}/${itemInstanceId} (${identity.definitionId}) ` +
        `is absent at game end without destruction or full consumption.`,
    );
  }

  for (const [roundKey, roundAudit] of preparedRounds) {
    const state = roundAudit.preparedState;
    const livingTributes = state.tributes.filter((tribute) => tribute.isAlive);

    for (const tribute of livingTributes) {
      for (const item of tribute.inventory) {
        const identity = requireIdentity(item.id, `owned-exposure:${roundKey}:${tribute.id}`);

        if (!identity) {
          continue;
        }

        const row = getOrCreateItemLifecycle(itemRows, run.seed, gameSize, identity);

        row.ownedPreparedRoundExposures += 1;
        row.ownedSelectorRounds.add(roundKey);
      }

      const truce = state.truces.find((candidate) => candidate.tributeIds.includes(tribute.id));

      if (!truce) {
        continue;
      }

      for (const partnerId of truce.tributeIds) {
        if (partnerId === tribute.id) {
          continue;
        }

        const partner = state.tributes.find(
          (candidate) => candidate.id === partnerId && candidate.isAlive,
        );

        if (!partner) {
          continue;
        }

        for (const item of partner.inventory) {
          const identity = requireIdentity(
            item.id,
            `truce-exposure:${roundKey}:${tribute.id}:${partner.id}`,
          );

          if (!identity) {
            continue;
          }

          const row = getOrCreateItemLifecycle(itemRows, run.seed, gameSize, identity);

          row.truceAccessiblePreparedRoundExposures += 1;
          row.truceAccessibleSelectorRounds.add(roundKey);
        }
      }
    }
  }

  return [...itemRows.values()]
    .map((row): ItemLifecycleByGameMetric => ({
      seed: row.seed,
      gameSize: row.gameSize,
      definitionId: row.definitionId,
      acquisitionSource: row.acquisitionSource,
      sourceDefinitionId: row.sourceDefinitionId,
      acquiredInstances: row.acquiredInstances,
      useEvents: row.useEvents,
      consumptionEvents: row.consumptionEvents,
      consumedUses: row.consumedUses,
      transferEvents: row.transferEvents,
      destructionEvents: row.destructionEvents,
      retainedInstances: row.retainedInstances,
      ownedPreparedRoundExposures: row.ownedPreparedRoundExposures,
      truceAccessiblePreparedRoundExposures: row.truceAccessiblePreparedRoundExposures,
      ownedSelectorRounds: row.ownedSelectorRounds.size,
      truceAccessibleSelectorRounds: row.truceAccessibleSelectorRounds.size,
    }))
    .sort(
      (first, second) =>
        first.definitionId.localeCompare(second.definitionId) ||
        first.acquisitionSource.localeCompare(second.acquisitionSource) ||
        first.sourceDefinitionId.localeCompare(second.sourceDefinitionId),
    );
}

function analyzeTruceLifecycle(
  run: SimulationRun,
  preparedRounds: ReadonlyMap<string, PreparedRoundAudit>,
  failures: string[],
): TruceLifecycleMetric[] {
  const gameSize = getGameSize(run);
  const rows = new Map<
    string,
    Omit<
      TruceLifecycleMetric,
      "durationRoundSequenceSteps" | "preparedRoundsObservedActive" | "activeAtGameEnd"
    > & {
      durationRoundSequenceSteps?: number;
      preparedRoundsObservedActive: number;
      activeAtGameEnd?: boolean;
    }
  >();

  for (const event of run.state.eventHistory) {
    for (const change of event.changes) {
      if (change.type === "form-truce") {
        if (rows.has(change.truce.id)) {
          failures.push(`Truce ${run.seed}/${change.truce.id} formed more than once.`);
          continue;
        }

        rows.set(change.truce.id, {
          seed: run.seed,
          gameSize,
          truceId: change.truce.id,
          kind: change.truce.kind,
          size: change.truce.tributeIds.length,
          sourceEventId: event.id,
          sourceDefinitionId: event.definitionId,
          createdDay: change.truce.createdRound.day,
          createdPeriod: change.truce.createdRound.period,
          createdRoundSequence: getRoundSequence(change.truce.createdRound),
          breakupDay: null,
          breakupPeriod: null,
          breakupRoundSequence: null,
          breakupReason: null,
          breakupEventId: null,
          breakupDefinitionId: null,
          preparedRoundsObservedActive: 0,
          duplicateBreakAttempts: 0,
        });
        continue;
      }

      if (change.type !== "break-truce") {
        continue;
      }

      const row = rows.get(change.truceId);

      if (!row) {
        failures.push(`Truce breakup ${run.seed}/${change.truceId} has no recorded formation.`);
        continue;
      }

      if (row.breakupReason !== null) {
        row.duplicateBreakAttempts += 1;
        continue;
      }

      row.breakupDay = event.round.day;
      row.breakupPeriod = event.round.period;
      row.breakupRoundSequence = getRoundSequence(event.round);
      row.breakupReason = change.reason;
      row.breakupEventId = event.id;
      row.breakupDefinitionId = event.definitionId;
    }
  }

  for (const roundAudit of preparedRounds.values()) {
    for (const truce of roundAudit.preparedState.truces) {
      const row = rows.get(truce.id);

      if (row) {
        row.preparedRoundsObservedActive += 1;
      }
    }
  }

  const activeAtGameEnd = new Set(run.state.truces.map((truce) => truce.id));
  const finalSequence = getFinalRoundSequence(run);

  for (const row of rows.values()) {
    row.activeAtGameEnd = activeAtGameEnd.has(row.truceId);

    if (row.breakupRoundSequence !== null) {
      row.durationRoundSequenceSteps = Math.max(
        0,
        row.breakupRoundSequence - row.createdRoundSequence,
      );
    } else {
      row.durationRoundSequenceSteps = Math.max(0, finalSequence - row.createdRoundSequence);
    }

    if (row.breakupReason === null && !row.activeAtGameEnd) {
      failures.push(`Truce ${run.seed}/${row.truceId} is neither broken nor active at game end.`);
    }

    if (row.breakupReason !== null && row.activeAtGameEnd) {
      failures.push(`Truce ${run.seed}/${row.truceId} is recorded broken but remains active.`);
    }
  }

  const brokenCount = [...rows.values()].filter((row) => row.breakupReason !== null).length;
  const activeCount = [...rows.values()].filter((row) => row.activeAtGameEnd).length;

  if (rows.size !== brokenCount + activeCount) {
    failures.push(
      `Truce reconciliation failed for ${run.seed}: ` +
        `${rows.size} formed, ${brokenCount} broken, ` +
        `${activeCount} active at game end.`,
    );
  }

  return [...rows.values()]
    .map((row): TruceLifecycleMetric => ({
      ...row,
      durationRoundSequenceSteps: row.durationRoundSequenceSteps ?? 0,
      activeAtGameEnd: row.activeAtGameEnd ?? false,
    }))
    .sort(
      (first, second) =>
        first.createdRoundSequence - second.createdRoundSequence ||
        first.truceId.localeCompare(second.truceId),
    );
}

function analyzeRun(run: SimulationRun, failures: string[]): RunAudit {
  const statusAnalysis = analyzePreparedRoundsAndStatuses(run, failures);

  return {
    run,
    gameSize: getGameSize(run),
    preparedRounds: statusAnalysis.preparedRounds,
    itemLifecycle: analyzeItemLifecycle(run, statusAnalysis.preparedRounds, failures),
    statusLifecycle: statusAnalysis.statusLifecycle,
    statusPreparationRemovals: statusAnalysis.statusPreparationRemovals,
    truceLifecycles: analyzeTruceLifecycle(run, statusAnalysis.preparedRounds, failures),
  };
}
function getItemRequirementDescription(prerequisite: ItemPrerequisite): string {
  return prerequisite.kind === "item-definition"
    ? `definitions:${[...prerequisite.definitionIds].sort().join(",")}`
    : `tags:${[...prerequisite.tags].sort().join(",")}`;
}

function getItemPrerequisiteKey(prerequisite: ItemPrerequisite): string {
  return [
    prerequisite.kind,
    prerequisite.roleId,
    getItemRequirementDescription(prerequisite),
    prerequisite.access,
    prerequisite.requireUsable ? "usable" : "narrative",
    `usable-by:${prerequisite.usableByRoleId}`,
  ].join("|");
}

function evaluateItemPrerequisite(
  state: GameState,
  definition: EventDefinition,
  prerequisite: ItemPrerequisite,
): {
  matchingCandidateCount: number;
  ownedPathAvailable: boolean;
  trucePathAvailable: boolean;
  stateAvailable: boolean;
} {
  const livingTributes = state.tributes.filter((tribute) => tribute.isAlive);
  const roleCount = getRoleCount(definition, prerequisite.roleId);
  let matchingCandidateCount = 0;
  let ownedPathAvailable = false;
  let trucePathAvailable = false;

  for (const actingTribute of livingTributes) {
    const usabilityTributes =
      prerequisite.usableByRoleId === prerequisite.roleId
        ? [actingTribute]
        : livingTributes.filter((tribute) => tribute.id !== actingTribute.id);

    let candidateMatches = false;
    let candidateOwnPath = false;
    let candidateTrucePath = false;

    for (const usabilityTribute of usabilityTributes) {
      const accessibleItems = getAccessibleInventoryItems(state, actingTribute, {
        ...(prerequisite.kind === "item-definition"
          ? {
              definitionIds: prerequisite.definitionIds,
            }
          : {
              requiredTags: prerequisite.tags,
            }),
        requireUsable: prerequisite.requireUsable,
        usabilityTribute,
      }).filter(({ owner }) => prerequisite.access !== "owned" || owner.id === actingTribute.id);

      if (accessibleItems.length === 0) {
        continue;
      }

      candidateMatches = true;

      if (accessibleItems.some(({ owner }) => owner.id === actingTribute.id)) {
        candidateOwnPath = true;
      }

      if (
        prerequisite.access === "accessible" &&
        accessibleItems.some(({ owner }) => owner.id !== actingTribute.id)
      ) {
        candidateTrucePath = true;
      }
    }

    if (!candidateMatches) {
      continue;
    }

    matchingCandidateCount += 1;
    ownedPathAvailable ||= candidateOwnPath;
    trucePathAvailable ||= candidateTrucePath;
  }

  return {
    matchingCandidateCount,
    ownedPathAvailable,
    trucePathAvailable,
    stateAvailable: matchingCandidateCount >= roleCount,
  };
}

function formatStatusCondition(condition: StatusCondition): string {
  const severity = condition.present
    ? [
        condition.minimumSeverity !== undefined ? `severity>=${condition.minimumSeverity}` : null,
        condition.maximumSeverity !== undefined ? `severity<=${condition.maximumSeverity}` : null,
      ]
        .filter((value): value is string => value !== null)
        .join(",")
    : "";

  return [condition.statusId, condition.present ? "present" : "absent", severity]
    .filter(Boolean)
    .join(" ");
}

function getStatusRequirementDescription(prerequisite: StatusPrerequisite): string {
  if (prerequisite.kind === "status") {
    return formatStatusCondition(prerequisite);
  }

  return `any(${prerequisite.alternatives
    .map((alternative) => formatStatusCondition(alternative))
    .join(" OR ")})`;
}

function getStatusPrerequisiteKey(prerequisite: StatusPrerequisite): string {
  return [
    prerequisite.kind,
    prerequisite.roleId,
    getStatusRequirementDescription(prerequisite),
    `minimum-matching:${prerequisite.minimumMatchingCount ?? "role-count"}`,
  ].join("|");
}

function candidateMatchesStatusCondition(
  tribute: GameTribute,
  condition: StatusCondition,
): boolean {
  const status = tribute.statuses.find(
    (candidate) => candidate.definitionId === condition.statusId,
  );

  if (!condition.present) {
    return status === undefined;
  }

  if (!status) {
    return false;
  }

  if (condition.minimumSeverity !== undefined && status.severity < condition.minimumSeverity) {
    return false;
  }

  if (condition.maximumSeverity !== undefined && status.severity > condition.maximumSeverity) {
    return false;
  }

  return true;
}

function candidateMatchesStatusPrerequisite(
  tribute: GameTribute,
  prerequisite: StatusPrerequisite,
): boolean {
  if (prerequisite.kind === "status") {
    return candidateMatchesStatusCondition(tribute, prerequisite);
  }

  return prerequisite.alternatives.some((alternative) =>
    candidateMatchesStatusCondition(tribute, alternative),
  );
}

function getStatusMinimumMatchingCount(
  definition: EventDefinition,
  prerequisite: StatusPrerequisite,
): number {
  return prerequisite.minimumMatchingCount ?? getRoleCount(definition, prerequisite.roleId);
}

function evaluateStatusPrerequisite(
  state: GameState,
  definition: EventDefinition,
  prerequisite: StatusPrerequisite,
): {
  matchingCandidateCount: number;
  stateAvailable: boolean;
} {
  const matchingCandidateCount = state.tributes.filter(
    (tribute) => tribute.isAlive && candidateMatchesStatusPrerequisite(tribute, prerequisite),
  ).length;
  const minimumMatchingCount = getStatusMinimumMatchingCount(definition, prerequisite);

  return {
    matchingCandidateCount,
    stateAvailable: matchingCandidateCount >= minimumMatchingCount,
  };
}

function positiveStatusConditionMatchesRemoval(
  condition: StatusCondition,
  statusId: StatusEffectId,
  severity: number,
): boolean {
  return (
    condition.present &&
    condition.statusId === statusId &&
    (condition.minimumSeverity === undefined || severity >= condition.minimumSeverity) &&
    (condition.maximumSeverity === undefined || severity <= condition.maximumSeverity)
  );
}

function statusPrerequisiteDependsOnRemovedStatus(
  prerequisite: StatusPrerequisite,
  statusId: StatusEffectId,
  severity: number,
): boolean {
  if (prerequisite.kind === "status") {
    return positiveStatusConditionMatchesRemoval(prerequisite, statusId, severity);
  }

  return prerequisite.alternatives.some((alternative) =>
    positiveStatusConditionMatchesRemoval(alternative, statusId, severity),
  );
}

function getTruceRequirementDescription(prerequisite: TrucePrerequisite): string {
  if (prerequisite.kind === "relationship") {
    return [
      "relationship:truce",
      `kind:${prerequisite.relationshipKind ?? "any"}`,
      `related-role:${prerequisite.relatedRoleId ?? "any"}`,
    ].join("|");
  }

  return [
    "truce",
    `kind:${prerequisite.truceKind ?? "any"}`,
    `exact:${prerequisite.exactSize ?? "any"}`,
    `min:${prerequisite.minimumSize ?? "any"}`,
    `max:${prerequisite.maximumSize ?? "any"}`,
  ].join("|");
}

function getTrucePrerequisiteKey(prerequisite: TrucePrerequisite): string {
  return [
    prerequisite.kind,
    prerequisite.roleId,
    getTruceRequirementDescription(prerequisite),
  ].join("|");
}

function truceMatchesPrerequisite(
  state: GameState,
  truceId: string,
  prerequisite: TrucePrerequisite,
): boolean {
  const truce = state.truces.find((candidate) => candidate.id === truceId);

  if (!truce) {
    return false;
  }

  const livingSize = truce.tributeIds.filter((tributeId) =>
    state.tributes.some((tribute) => tribute.id === tributeId && tribute.isAlive),
  ).length;

  if (prerequisite.kind === "relationship") {
    return (
      prerequisite.relationshipKind === undefined || truce.kind === prerequisite.relationshipKind
    );
  }

  if (prerequisite.truceKind !== undefined && truce.kind !== prerequisite.truceKind) {
    return false;
  }

  if (prerequisite.exactSize !== undefined && livingSize !== prerequisite.exactSize) {
    return false;
  }

  if (prerequisite.minimumSize !== undefined && livingSize < prerequisite.minimumSize) {
    return false;
  }

  if (prerequisite.maximumSize !== undefined && livingSize > prerequisite.maximumSize) {
    return false;
  }

  return true;
}

function evaluateTrucePrerequisite(
  state: GameState,
  definition: EventDefinition,
  prerequisite: TrucePrerequisite,
): {
  compatibleTruceCount: number;
  matchingCandidateCount: number;
  stateAvailable: boolean;
} {
  const compatibleTruces = state.truces.filter((truce) =>
    truceMatchesPrerequisite(state, truce.id, prerequisite),
  );
  const matchingCandidateIds = new Set<string>();

  for (const truce of compatibleTruces) {
    for (const tributeId of truce.tributeIds) {
      const tribute = state.tributes.find(
        (candidate) => candidate.id === tributeId && candidate.isAlive,
      );

      if (tribute) {
        matchingCandidateIds.add(tribute.id);
      }
    }
  }

  const roleCount = getRoleCount(definition, prerequisite.roleId);
  const relatedRoleCount =
    prerequisite.kind === "relationship" && prerequisite.relatedRoleId !== undefined
      ? getRoleCount(definition, prerequisite.relatedRoleId)
      : 0;
  const hasRelatedRoleCapacity =
    relatedRoleCount === 0 ||
    compatibleTruces.some((truce) => {
      const livingSize = truce.tributeIds.filter((tributeId) =>
        state.tributes.some((tribute) => tribute.id === tributeId && tribute.isAlive),
      ).length;

      return livingSize >= roleCount + relatedRoleCount;
    });

  return {
    compatibleTruceCount: compatibleTruces.length,
    matchingCandidateCount: matchingCandidateIds.size,
    stateAvailable: matchingCandidateIds.size >= roleCount && hasRelatedRoleCapacity,
  };
}

function getPreparedStateForOpportunity(
  runAudit: RunAudit,
  opportunity: EventSelectionOpportunityRecord,
): GameState {
  const prepared = runAudit.preparedRounds.get(
    `${opportunity.roundDay}:${opportunity.roundPeriod}`,
  );

  if (!prepared) {
    throw new Error(
      `Missing prepared-round state for ${runAudit.run.seed}/` +
        `${opportunity.roundPeriod}-${opportunity.roundDay}.`,
    );
  }

  return prepared.preparedState;
}

function getAvailabilityFlags({
  opportunities,
  stateAvailableOpportunities,
  hardFeasibleOpportunities,
}: {
  opportunities: number;
  stateAvailableOpportunities: number;
  hardFeasibleOpportunities: number;
}): string[] {
  if (opportunities === 0) {
    return [];
  }

  const flags: string[] = [];

  if (stateAvailableOpportunities === 0) {
    flags.push("never-prerequisite-available");
  } else if (stateAvailableOpportunities / opportunities < 0.25) {
    flags.push("usually-prerequisite-missing");
  }

  if (stateAvailableOpportunities > 0 && hardFeasibleOpportunities === 0) {
    flags.push("prerequisite-present-but-definition-never-hard-feasible");
  }

  return flags;
}

function createItemPrerequisiteMetrics(
  runAudits: readonly RunAudit[],
): ItemPrerequisiteAvailabilityMetric[] {
  const metrics = new Map<string, MutableItemPrerequisiteMetric>();

  for (const runAudit of runAudits) {
    const opportunities = runAudit.run.selectionDiagnostics?.opportunities ?? [];

    for (const opportunity of opportunities) {
      const definition = DEFINITION_BY_ID.get(opportunity.definitionId);

      if (!definition) {
        continue;
      }

      const prerequisites = getEventAuditPrerequisiteEvidence(definition).prerequisites.filter(
        (prerequisite): prerequisite is ItemPrerequisite =>
          prerequisite.kind === "item-definition" || prerequisite.kind === "item-tag",
      );

      if (prerequisites.length === 0) {
        continue;
      }

      const state = getPreparedStateForOpportunity(runAudit, opportunity);

      for (const prerequisite of prerequisites) {
        const prerequisiteKey = getItemPrerequisiteKey(prerequisite);
        const key = [runAudit.gameSize, definition.id, prerequisiteKey].join(":");
        const existing = metrics.get(key);
        const metric =
          existing ??
          ({
            gameSize: runAudit.gameSize,
            definitionId: definition.id,
            roleId: prerequisite.roleId,
            prerequisiteKey,
            prerequisiteKind: prerequisite.kind,
            requirement: getItemRequirementDescription(prerequisite),
            access: prerequisite.access,
            requireUsable: prerequisite.requireUsable,
            usableByRoleId: prerequisite.usableByRoleId,
            opportunities: 0,
            gamesWithOpportunity: new Set<string>(),
            matchingCandidateTotal: 0,
            stateAvailableOpportunities: 0,
            ownedPathOpportunities: 0,
            trucePathOpportunities: 0,
            hardFeasibleOpportunities: 0,
            opportunityFeasibleOpportunities: 0,
            weightedPoolEntries: 0,
            acceptedSelections: 0,
          } satisfies MutableItemPrerequisiteMetric);

        const availability = evaluateItemPrerequisite(state, definition, prerequisite);

        metric.opportunities += 1;
        metric.gamesWithOpportunity.add(runAudit.run.seed);
        metric.matchingCandidateTotal += availability.matchingCandidateCount;
        metric.stateAvailableOpportunities += availability.stateAvailable ? 1 : 0;
        metric.ownedPathOpportunities += availability.ownedPathAvailable ? 1 : 0;
        metric.trucePathOpportunities += availability.trucePathAvailable ? 1 : 0;
        metric.hardFeasibleOpportunities += opportunity.hardFeasible ? 1 : 0;
        metric.opportunityFeasibleOpportunities += opportunity.opportunityFeasible ? 1 : 0;
        metric.weightedPoolEntries += opportunity.weightedPoolEntryCount;
        metric.acceptedSelections += opportunity.resolvedAccepted ? 1 : 0;

        metrics.set(key, metric);
      }
    }
  }

  return [...metrics.values()]
    .map((metric): ItemPrerequisiteAvailabilityMetric => ({
      gameSize: metric.gameSize,
      definitionId: metric.definitionId,
      roleId: metric.roleId,
      prerequisiteKind: metric.prerequisiteKind,
      requirement: metric.requirement,
      access: metric.access,
      requireUsable: metric.requireUsable,
      usableByRoleId: metric.usableByRoleId,
      opportunities: metric.opportunities,
      gamesWithOpportunity: metric.gamesWithOpportunity.size,
      matchingCandidateTotal: metric.matchingCandidateTotal,
      stateAvailableOpportunities: metric.stateAvailableOpportunities,
      stateAvailabilityRate: divide(metric.stateAvailableOpportunities, metric.opportunities),
      ownedPathOpportunities: metric.ownedPathOpportunities,
      trucePathOpportunities: metric.trucePathOpportunities,
      hardFeasibleOpportunities: metric.hardFeasibleOpportunities,
      opportunityFeasibleOpportunities: metric.opportunityFeasibleOpportunities,
      weightedPoolEntries: metric.weightedPoolEntries,
      acceptedSelections: metric.acceptedSelections,
      flags: getAvailabilityFlags(metric),
    }))
    .sort(
      (first, second) =>
        first.gameSize.localeCompare(second.gameSize) ||
        first.stateAvailabilityRate - second.stateAvailabilityRate ||
        first.definitionId.localeCompare(second.definitionId) ||
        first.roleId.localeCompare(second.roleId),
    );
}

function createStatusPrerequisiteMetrics(
  runAudits: readonly RunAudit[],
): StatusPrerequisiteAvailabilityMetric[] {
  const metrics = new Map<string, MutableStatusPrerequisiteMetric>();

  for (const runAudit of runAudits) {
    const opportunities = runAudit.run.selectionDiagnostics?.opportunities ?? [];

    for (const opportunity of opportunities) {
      const definition = DEFINITION_BY_ID.get(opportunity.definitionId);
      if (!definition) continue;

      const prerequisites = getEventAuditPrerequisiteEvidence(definition).prerequisites.filter(
        (prerequisite): prerequisite is StatusPrerequisite =>
          prerequisite.kind === "status" || prerequisite.kind === "status-any",
      );
      if (prerequisites.length === 0) continue;

      const state = getPreparedStateForOpportunity(runAudit, opportunity);

      for (const prerequisite of prerequisites) {
        const prerequisiteKey = getStatusPrerequisiteKey(prerequisite);
        const key = [runAudit.gameSize, definition.id, prerequisiteKey].join(":");
        const existing = metrics.get(key);
        const metric =
          existing ??
          ({
            gameSize: runAudit.gameSize,
            definitionId: definition.id,
            roleId: prerequisite.roleId,
            prerequisiteKey,
            prerequisiteKind: prerequisite.kind,
            requirement: getStatusRequirementDescription(prerequisite),
            minimumMatchingCount: getStatusMinimumMatchingCount(definition, prerequisite),
            opportunities: 0,
            gamesWithOpportunity: new Set<string>(),
            matchingCandidateTotal: 0,
            stateAvailableOpportunities: 0,
            hardFeasibleOpportunities: 0,
            opportunityFeasibleOpportunities: 0,
            weightedPoolEntries: 0,
            acceptedSelections: 0,
          } satisfies MutableStatusPrerequisiteMetric);

        const availability = evaluateStatusPrerequisite(state, definition, prerequisite);
        metric.opportunities += 1;
        metric.gamesWithOpportunity.add(runAudit.run.seed);
        metric.matchingCandidateTotal += availability.matchingCandidateCount;
        metric.stateAvailableOpportunities += availability.stateAvailable ? 1 : 0;
        metric.hardFeasibleOpportunities += opportunity.hardFeasible ? 1 : 0;
        metric.opportunityFeasibleOpportunities += opportunity.opportunityFeasible ? 1 : 0;
        metric.weightedPoolEntries += opportunity.weightedPoolEntryCount;
        metric.acceptedSelections += opportunity.resolvedAccepted ? 1 : 0;
        metrics.set(key, metric);
      }
    }
  }

  return [...metrics.values()]
    .map((metric): StatusPrerequisiteAvailabilityMetric => ({
      gameSize: metric.gameSize,
      definitionId: metric.definitionId,
      roleId: metric.roleId,
      prerequisiteKind: metric.prerequisiteKind,
      requirement: metric.requirement,
      minimumMatchingCount: metric.minimumMatchingCount,
      opportunities: metric.opportunities,
      gamesWithOpportunity: metric.gamesWithOpportunity.size,
      matchingCandidateTotal: metric.matchingCandidateTotal,
      stateAvailableOpportunities: metric.stateAvailableOpportunities,
      stateAvailabilityRate: divide(metric.stateAvailableOpportunities, metric.opportunities),
      hardFeasibleOpportunities: metric.hardFeasibleOpportunities,
      opportunityFeasibleOpportunities: metric.opportunityFeasibleOpportunities,
      weightedPoolEntries: metric.weightedPoolEntries,
      acceptedSelections: metric.acceptedSelections,
      flags: getAvailabilityFlags(metric),
    }))
    .sort(
      (first, second) =>
        first.gameSize.localeCompare(second.gameSize) ||
        first.stateAvailabilityRate - second.stateAvailabilityRate ||
        first.definitionId.localeCompare(second.definitionId) ||
        first.roleId.localeCompare(second.roleId) ||
        first.requirement.localeCompare(second.requirement),
    );
}

function isTrucePrerequisite(
  prerequisite: EventAuditPrerequisite,
): prerequisite is TrucePrerequisite {
  return (
    prerequisite.kind === "truce" ||
    (prerequisite.kind === "relationship" && prerequisite.relationship === "truce")
  );
}

function createTrucePrerequisiteMetrics(
  runAudits: readonly RunAudit[],
): TrucePrerequisiteAvailabilityMetric[] {
  const metrics = new Map<string, MutableTrucePrerequisiteMetric>();

  for (const runAudit of runAudits) {
    const opportunities = runAudit.run.selectionDiagnostics?.opportunities ?? [];

    for (const opportunity of opportunities) {
      const definition = DEFINITION_BY_ID.get(opportunity.definitionId);

      if (!definition) {
        continue;
      }

      const prerequisites =
        getEventAuditPrerequisiteEvidence(definition).prerequisites.filter(isTrucePrerequisite);

      if (prerequisites.length === 0) {
        continue;
      }

      const state = getPreparedStateForOpportunity(runAudit, opportunity);

      for (const prerequisite of prerequisites) {
        const prerequisiteKey = getTrucePrerequisiteKey(prerequisite);
        const key = [runAudit.gameSize, definition.id, prerequisiteKey].join(":");
        const existing = metrics.get(key);
        const metric =
          existing ??
          ({
            gameSize: runAudit.gameSize,
            definitionId: definition.id,
            roleId: prerequisite.roleId,
            prerequisiteKey,
            requirement: getTruceRequirementDescription(prerequisite),
            opportunities: 0,
            gamesWithOpportunity: new Set<string>(),
            compatibleTruceTotal: 0,
            matchingCandidateTotal: 0,
            stateAvailableOpportunities: 0,
            hardFeasibleOpportunities: 0,
            opportunityFeasibleOpportunities: 0,
            weightedPoolEntries: 0,
            acceptedSelections: 0,
          } satisfies MutableTrucePrerequisiteMetric);

        const availability = evaluateTrucePrerequisite(state, definition, prerequisite);

        metric.opportunities += 1;
        metric.gamesWithOpportunity.add(runAudit.run.seed);
        metric.compatibleTruceTotal += availability.compatibleTruceCount;
        metric.matchingCandidateTotal += availability.matchingCandidateCount;
        metric.stateAvailableOpportunities += availability.stateAvailable ? 1 : 0;
        metric.hardFeasibleOpportunities += opportunity.hardFeasible ? 1 : 0;
        metric.opportunityFeasibleOpportunities += opportunity.opportunityFeasible ? 1 : 0;
        metric.weightedPoolEntries += opportunity.weightedPoolEntryCount;
        metric.acceptedSelections += opportunity.resolvedAccepted ? 1 : 0;

        metrics.set(key, metric);
      }
    }
  }

  return [...metrics.values()]
    .map((metric): TrucePrerequisiteAvailabilityMetric => ({
      gameSize: metric.gameSize,
      definitionId: metric.definitionId,
      roleId: metric.roleId,
      requirement: metric.requirement,
      opportunities: metric.opportunities,
      gamesWithOpportunity: metric.gamesWithOpportunity.size,
      compatibleTruceTotal: metric.compatibleTruceTotal,
      matchingCandidateTotal: metric.matchingCandidateTotal,
      stateAvailableOpportunities: metric.stateAvailableOpportunities,
      stateAvailabilityRate: divide(metric.stateAvailableOpportunities, metric.opportunities),
      hardFeasibleOpportunities: metric.hardFeasibleOpportunities,
      opportunityFeasibleOpportunities: metric.opportunityFeasibleOpportunities,
      weightedPoolEntries: metric.weightedPoolEntries,
      acceptedSelections: metric.acceptedSelections,
      flags: getAvailabilityFlags(metric),
    }))
    .sort(
      (first, second) =>
        first.gameSize.localeCompare(second.gameSize) ||
        first.stateAvailabilityRate - second.stateAvailabilityRate ||
        first.definitionId.localeCompare(second.definitionId),
    );
}
function enrichPreparationRemovalDependencies(
  runAudits: readonly RunAudit[],
): StatusPreparationRemovalMetric[] {
  const output: StatusPreparationRemovalMetric[] = [];

  for (const runAudit of runAudits) {
    const opportunities = runAudit.run.selectionDiagnostics?.opportunities ?? [];

    for (const removal of runAudit.statusPreparationRemovals) {
      const dependentRows = opportunities.filter((opportunity) => {
        if (
          opportunity.roundDay !== removal.roundDay ||
          opportunity.roundPeriod !== removal.roundPeriod
        ) {
          return false;
        }

        const definition = DEFINITION_BY_ID.get(opportunity.definitionId);

        if (!definition) {
          return false;
        }

        return getEventAuditPrerequisiteEvidence(definition).prerequisites.some(
          (prerequisite) =>
            (prerequisite.kind === "status" || prerequisite.kind === "status-any") &&
            statusPrerequisiteDependsOnRemovedStatus(
              prerequisite,
              removal.statusId,
              removal.removedSeverity,
            ),
        );
      });
      const dependentDefinitionIds = [
        ...new Set(dependentRows.map((row) => row.definitionId)),
      ].sort();

      output.push({
        ...removal,
        dependentDefinitionIds,
        dependentSelectorOpportunities: dependentRows.length,
      });
    }
  }

  return output.sort(
    (first, second) =>
      first.gameSize.localeCompare(second.gameSize) ||
      first.seed.localeCompare(second.seed) ||
      getRoundSequence({
        day: first.roundDay,
        period: first.roundPeriod,
      }) -
        getRoundSequence({
          day: second.roundDay,
          period: second.roundPeriod,
        }) ||
      first.statusId.localeCompare(second.statusId) ||
      first.tributeId.localeCompare(second.tributeId),
  );
}

function createGameSizeSummaries(
  runs: readonly SimulationRun[],
  itemLifecycle: readonly ItemLifecycleByGameMetric[],
  statusLifecycle: readonly StatusLifecycleByGameMetric[],
  truceLifecycles: readonly TruceLifecycleMetric[],
): PrerequisiteLifecycleGameSizeSummary[] {
  const gameSizes = [...new Set(runs.map((run) => getGameSize(run)))].sort();

  return gameSizes.map((gameSize) => {
    const gameItems = itemLifecycle.filter((row) => row.gameSize === gameSize);
    const gameStatuses = statusLifecycle.filter((row) => row.gameSize === gameSize);
    const gameTruces = truceLifecycles.filter((row) => row.gameSize === gameSize);

    return {
      gameSize,
      games: runs.filter((run) => getGameSize(run) === gameSize).length,
      itemAcquisitions: gameItems.reduce((total, row) => total + row.acquiredInstances, 0),
      itemUses: gameItems.reduce((total, row) => total + row.useEvents, 0),
      itemConsumptions: gameItems.reduce((total, row) => total + row.consumptionEvents, 0),
      itemTransfers: gameItems.reduce((total, row) => total + row.transferEvents, 0),
      itemDestructions: gameItems.reduce((total, row) => total + row.destructionEvents, 0),
      itemRetained: gameItems.reduce((total, row) => total + row.retainedInstances, 0),
      statusApplications: gameStatuses.reduce((total, row) => total + row.applications, 0),
      statusCreations: gameStatuses.reduce((total, row) => total + row.creations, 0),
      statusSeverityChanges: gameStatuses.reduce((total, row) => total + row.severityChanges, 0),
      statusRemovals: gameStatuses.reduce((total, row) => total + row.removals, 0),
      statusPreparationRemovals: gameStatuses.reduce(
        (total, row) => total + row.preparationRemovals,
        0,
      ),
      statusRetained: gameStatuses.reduce((total, row) => total + row.retainedAtGameEnd, 0),
      truceFormations: gameTruces.length,
      truceBreakups: gameTruces.filter((row) => row.breakupReason !== null).length,
      trucesActiveAtGameEnd: gameTruces.filter((row) => row.activeAtGameEnd).length,
    };
  });
}

export function collectPrerequisiteLifecycleEvidence(
  runs: readonly SimulationRun[],
): PrerequisiteLifecycleEvidenceReport {
  const failures: string[] = [];

  const missingTypedStatusDefinitions = ACTIVE_DEFINITIONS.filter(
    (definition) =>
      definition.selectionProfile?.specificityReasons.includes("status-requirement") === true,
  )
    .filter((definition) => {
      const prerequisites = getEventAuditPrerequisiteEvidence(definition).prerequisites;

      return !prerequisites.some(
        (prerequisite) => prerequisite.kind === "status" || prerequisite.kind === "status-any",
      );
    })
    .map((definition) => definition.id)
    .sort();

  if (missingTypedStatusDefinitions.length > 0) {
    failures.push(
      "Active status-requirement definitions are missing typed status " +
        `prerequisite metadata: ${missingTypedStatusDefinitions.join(", ")}.`,
    );
  }

  for (const run of runs) {
    if (!run.selectionDiagnostics?.opportunities) {
      failures.push(`Simulation ${run.seed} is missing opportunity-level selection diagnostics.`);
    }
  }

  const runAudits = runs.map((run) => analyzeRun(run, failures));
  const itemLifecycleByGame = runAudits.flatMap((audit) => audit.itemLifecycle);
  const statusLifecycleByGame = runAudits.flatMap((audit) => audit.statusLifecycle);
  const truceLifecycles = runAudits.flatMap((audit) => audit.truceLifecycles);
  const itemPrerequisites = createItemPrerequisiteMetrics(runAudits);
  const statusPrerequisites = createStatusPrerequisiteMetrics(runAudits);
  const trucePrerequisites = createTrucePrerequisiteMetrics(runAudits);
  const statusPreparationRemovals = enrichPreparationRemovalDependencies(runAudits);

  return {
    reconciliation: {
      passed: failures.length === 0,
      failures,
    },
    gameSizeSummaries: createGameSizeSummaries(
      runs,
      itemLifecycleByGame,
      statusLifecycleByGame,
      truceLifecycles,
    ),
    itemLifecycleByGame,
    itemPrerequisites,
    statusLifecycleByGame,
    statusPrerequisites,
    statusPreparationRemovals,
    truceLifecycles,
    trucePrerequisites,
  };
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function gameSizeLabel(gameSize: EventDistributionGameSizeId): string {
  return gameSize === "half-game" ? "Half Game" : "Full Game";
}

function createStarvationRows<
  T extends {
    stateAvailabilityRate: number;
    opportunities: number;
  },
>(rows: readonly T[], limit = 15): T[] {
  return [...rows]
    .filter((row) => row.opportunities > 0)
    .sort((first, second) => first.stateAvailabilityRate - second.stateAvailabilityRate)
    .slice(0, limit);
}

export function createPrerequisiteLifecycleEvidenceMarkdown(
  report: PrerequisiteLifecycleEvidenceReport,
): string[] {
  const lines: string[] = [
    "## Item, status, and truce prerequisite evidence",
    "",
    "This section reconstructs the selector-visible state after automatic round preparation. Item availability is evaluated from the exact typed definition/tag, ownership/access path, usability flag, and usability role preserved by Phase 1B. Status and truce availability are evaluated independently from the rest of a definition's eligibility, then shown alongside hard feasibility, reservation-aware feasibility, weighted-pool exposure, and selection.",
    "",
    `Reconciliation: ${report.reconciliation.passed ? "passed" : "FAILED"}.`,
    "",
  ];

  for (const summary of report.gameSizeSummaries) {
    const itemRows = report.itemPrerequisites.filter((row) => row.gameSize === summary.gameSize);
    const statusRows = report.statusPrerequisites.filter(
      (row) => row.gameSize === summary.gameSize,
    );
    const truceRows = report.trucePrerequisites.filter((row) => row.gameSize === summary.gameSize);
    const prepRemovals = report.statusPreparationRemovals.filter(
      (row) => row.gameSize === summary.gameSize,
    );
    const truceLifecycles = report.truceLifecycles.filter(
      (row) => row.gameSize === summary.gameSize,
    );

    lines.push(
      `### ${gameSizeLabel(summary.gameSize)} prerequisite lifecycle summary`,
      "",
      `Games: ${summary.games}.`,
      "",
      "| Evidence | Count |",
      "| --- | ---: |",
      `| Item acquisitions | ${summary.itemAcquisitions} |`,
      `| Reusable item uses | ${summary.itemUses} |`,
      `| Item consumption events | ${summary.itemConsumptions} |`,
      `| Item transfers | ${summary.itemTransfers} |`,
      `| Item destructions | ${summary.itemDestructions} |`,
      `| Item instances retained at game end | ${summary.itemRetained} |`,
      `| Status applications | ${summary.statusApplications} |`,
      `| Status creations | ${summary.statusCreations} |`,
      `| Status severity changes | ${summary.statusSeverityChanges} |`,
      `| Status removals | ${summary.statusRemovals} |`,
      `| Status removals during automatic preparation | ${summary.statusPreparationRemovals} |`,
      `| Status instances retained at game end | ${summary.statusRetained} |`,
      `| Truces formed | ${summary.truceFormations} |`,
      `| Truces broken | ${summary.truceBreakups} |`,
      `| Truces active at game end | ${summary.trucesActiveAtGameEnd} |`,
      "",
      `#### ${gameSizeLabel(summary.gameSize)} most item-starved typed prerequisites`,
      "",
      "| Definition | Role | Requirement | Access | Usable | Opportunities | State available | Hard feasible | Reservation-aware feasible | Weighted entries | Selected | Flags |",
      "| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
      ...createStarvationRows(itemRows).map(
        (row) =>
          `| \`${row.definitionId}\` | ${row.roleId} | ${row.requirement} | ` +
          `${row.access} | ${row.requireUsable ? `yes (${row.usableByRoleId})` : "no"} | ` +
          `${row.opportunities} | ${formatRate(row.stateAvailabilityRate)} | ` +
          `${row.hardFeasibleOpportunities} | ${row.opportunityFeasibleOpportunities} | ` +
          `${row.weightedPoolEntries} | ${row.acceptedSelections} | ` +
          `${row.flags.length > 0 ? row.flags.join(", ") : "—"} |`,
      ),
      ...(itemRows.length === 0
        ? [
            "| _No typed item prerequisites observed_ | — | — | — | — | 0 | 0.0% | 0 | 0 | 0 | 0 | — |",
          ]
        : []),
      "",
      `#### ${gameSizeLabel(summary.gameSize)} most status-starved typed prerequisites`,
      "",
      "| Definition | Role | Requirement | Min matching | Opportunities | State available | Hard feasible | Reservation-aware feasible | Weighted entries | Selected | Flags |",
      "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
      ...createStarvationRows(statusRows).map(
        (row) =>
          `| \`${row.definitionId}\` | ${row.roleId} | ${row.requirement} | ` +
          `${row.minimumMatchingCount} | ${row.opportunities} | ` +
          `${formatRate(row.stateAvailabilityRate)} | ${row.hardFeasibleOpportunities} | ` +
          `${row.opportunityFeasibleOpportunities} | ${row.weightedPoolEntries} | ` +
          `${row.acceptedSelections} | ${row.flags.length > 0 ? row.flags.join(", ") : "—"} |`,
      ),
      ...(statusRows.length === 0
        ? [
            "| _No typed status prerequisites observed_ | — | — | 0 | 0 | 0.0% | 0 | 0 | 0 | 0 | — |",
          ]
        : []),
      "",
      `Automatic preparation removed ${prepRemovals.length} status instance(s) before selector planning in this sample; ` +
        `${prepRemovals.filter((row) => row.remainedAbsentBeforeSelection).length} remained absent when ordinary selection began.`,
      "",
      `#### ${gameSizeLabel(summary.gameSize)} most truce-starved typed prerequisites`,
      "",
      "| Definition | Role | Requirement | Opportunities | State available | Compatible truce observations | Hard feasible | Reservation-aware feasible | Weighted entries | Selected | Flags |",
      "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
      ...createStarvationRows(truceRows).map(
        (row) =>
          `| \`${row.definitionId}\` | ${row.roleId} | ${row.requirement} | ` +
          `${row.opportunities} | ${formatRate(row.stateAvailabilityRate)} | ` +
          `${row.compatibleTruceTotal} | ${row.hardFeasibleOpportunities} | ` +
          `${row.opportunityFeasibleOpportunities} | ${row.weightedPoolEntries} | ` +
          `${row.acceptedSelections} | ${row.flags.length > 0 ? row.flags.join(", ") : "—"} |`,
      ),
      ...(truceRows.length === 0
        ? ["| _No typed truce prerequisites observed_ | — | — | 0 | 0.0% | 0 | 0 | 0 | 0 | 0 | — |"]
        : []),
      "",
    );

    if (truceLifecycles.length > 0) {
      const breakReasons = new Map<string, number>();

      for (const truce of truceLifecycles) {
        const reason = truce.breakupReason ?? "active-at-game-end";
        breakReasons.set(reason, (breakReasons.get(reason) ?? 0) + 1);
      }

      lines.push(
        `Truce breakup/retention outcomes: ${[...breakReasons.entries()]
          .sort(([first], [second]) => first.localeCompare(second))
          .map(([reason, count]) => `${reason}=${count}`)
          .join(", ")}.`,
        "",
      );
    }
  }

  lines.push(
    "Detailed per-game item lineage and ownership/access exposure is written to `event-frequency-item-lifecycle-by-game.tsv`. Typed item, status, and truce prerequisite opportunity evidence is written to dedicated prerequisite TSVs; automatic preparation removals and individual truce lifetimes are also retained as raw rows.",
    "",
  );

  return lines;
}

function sanitizeTsv(value: string): string {
  return value.replaceAll("\t", " ").replaceAll("\r", " ").replaceAll("\n", " ");
}

export function createItemLifecycleByGameTsv(report: PrerequisiteLifecycleEvidenceReport): string {
  const header = [
    "seed",
    "game_size",
    "definition_id",
    "acquisition_source",
    "source_definition_id",
    "acquired_instances",
    "use_events",
    "consumption_events",
    "consumed_uses",
    "transfer_events",
    "destruction_events",
    "retained_instances",
    "owned_prepared_round_exposures",
    "truce_accessible_prepared_round_exposures",
    "owned_selector_rounds",
    "truce_accessible_selector_rounds",
  ];
  const rows = report.itemLifecycleByGame.map((row) =>
    [
      row.seed,
      row.gameSize,
      row.definitionId,
      row.acquisitionSource,
      row.sourceDefinitionId,
      row.acquiredInstances,
      row.useEvents,
      row.consumptionEvents,
      row.consumedUses,
      row.transferEvents,
      row.destructionEvents,
      row.retainedInstances,
      row.ownedPreparedRoundExposures,
      row.truceAccessiblePreparedRoundExposures,
      row.ownedSelectorRounds,
      row.truceAccessibleSelectorRounds,
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

export function createItemPrerequisiteAvailabilityTsv(
  report: PrerequisiteLifecycleEvidenceReport,
): string {
  const header = [
    "game_size",
    "definition_id",
    "role_id",
    "prerequisite_kind",
    "requirement",
    "access",
    "require_usable",
    "usable_by_role_id",
    "opportunities",
    "games_with_opportunity",
    "matching_candidate_total",
    "state_available_opportunities",
    "state_availability_rate",
    "owned_path_opportunities",
    "truce_path_opportunities",
    "hard_feasible_opportunities",
    "opportunity_feasible_opportunities",
    "weighted_pool_entries",
    "accepted_selections",
    "flags",
  ];
  const rows = report.itemPrerequisites.map((row) =>
    [
      row.gameSize,
      row.definitionId,
      row.roleId,
      row.prerequisiteKind,
      row.requirement,
      row.access,
      row.requireUsable,
      row.usableByRoleId,
      row.opportunities,
      row.gamesWithOpportunity,
      row.matchingCandidateTotal,
      row.stateAvailableOpportunities,
      row.stateAvailabilityRate,
      row.ownedPathOpportunities,
      row.trucePathOpportunities,
      row.hardFeasibleOpportunities,
      row.opportunityFeasibleOpportunities,
      row.weightedPoolEntries,
      row.acceptedSelections,
      row.flags.join(","),
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

export function createStatusLifecycleByGameTsv(
  report: PrerequisiteLifecycleEvidenceReport,
): string {
  const header = [
    "seed",
    "game_size",
    "status_id",
    "applications",
    "creations",
    "severity_changes",
    "severity_delta",
    "removals",
    "preparation_removals",
    "event_removals",
    "round_end_removals",
    "round_start_exposures",
    "prepared_selector_round_exposures",
    "retained_at_game_end",
  ];
  const rows = report.statusLifecycleByGame.map((row) =>
    [
      row.seed,
      row.gameSize,
      row.statusId,
      row.applications,
      row.creations,
      row.severityChanges,
      row.severityDelta,
      row.removals,
      row.preparationRemovals,
      row.eventRemovals,
      row.roundEndRemovals,
      row.roundStartExposures,
      row.preparedSelectorRoundExposures,
      row.retainedAtGameEnd,
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

export function createStatusPrerequisiteAvailabilityTsv(
  report: PrerequisiteLifecycleEvidenceReport,
): string {
  const header = [
    "game_size",
    "definition_id",
    "role_id",
    "prerequisite_kind",
    "requirement",
    "minimum_matching_count",
    "opportunities",
    "games_with_opportunity",
    "matching_candidate_total",
    "state_available_opportunities",
    "state_availability_rate",
    "hard_feasible_opportunities",
    "opportunity_feasible_opportunities",
    "weighted_pool_entries",
    "accepted_selections",
    "flags",
  ];
  const rows = report.statusPrerequisites.map((row) =>
    [
      row.gameSize,
      row.definitionId,
      row.roleId,
      row.prerequisiteKind,
      row.requirement,
      row.minimumMatchingCount,
      row.opportunities,
      row.gamesWithOpportunity,
      row.matchingCandidateTotal,
      row.stateAvailableOpportunities,
      row.stateAvailabilityRate,
      row.hardFeasibleOpportunities,
      row.opportunityFeasibleOpportunities,
      row.weightedPoolEntries,
      row.acceptedSelections,
      row.flags.join(","),
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

export function createStatusPreparationRemovalTsv(
  report: PrerequisiteLifecycleEvidenceReport,
): string {
  const header = [
    "seed",
    "game_size",
    "round_day",
    "round_period",
    "preparation_definition_id",
    "preparation_mechanic",
    "tribute_id",
    "status_id",
    "removed_severity",
    "remained_absent_before_selection",
    "dependent_definition_ids",
    "dependent_selector_opportunities",
  ];
  const rows = report.statusPreparationRemovals.map((row) =>
    [
      row.seed,
      row.gameSize,
      row.roundDay,
      row.roundPeriod,
      row.preparationDefinitionId,
      row.preparationMechanic,
      row.tributeId,
      row.statusId,
      row.removedSeverity,
      row.remainedAbsentBeforeSelection,
      row.dependentDefinitionIds.join(","),
      row.dependentSelectorOpportunities,
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

export function createTruceLifecycleTsv(report: PrerequisiteLifecycleEvidenceReport): string {
  const header = [
    "seed",
    "game_size",
    "truce_id",
    "kind",
    "size",
    "source_event_id",
    "source_definition_id",
    "created_day",
    "created_period",
    "created_round_sequence",
    "breakup_day",
    "breakup_period",
    "breakup_round_sequence",
    "breakup_reason",
    "breakup_event_id",
    "breakup_definition_id",
    "duration_round_sequence_steps",
    "prepared_rounds_observed_active",
    "active_at_game_end",
    "duplicate_break_attempts",
  ];
  const rows = report.truceLifecycles.map((row) =>
    [
      row.seed,
      row.gameSize,
      row.truceId,
      row.kind,
      row.size,
      row.sourceEventId,
      row.sourceDefinitionId,
      row.createdDay,
      row.createdPeriod,
      row.createdRoundSequence,
      row.breakupDay ?? "",
      row.breakupPeriod ?? "",
      row.breakupRoundSequence ?? "",
      row.breakupReason ?? "",
      row.breakupEventId ?? "",
      row.breakupDefinitionId ?? "",
      row.durationRoundSequenceSteps,
      row.preparedRoundsObservedActive,
      row.activeAtGameEnd,
      row.duplicateBreakAttempts,
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

export function createTrucePrerequisiteAvailabilityTsv(
  report: PrerequisiteLifecycleEvidenceReport,
): string {
  const header = [
    "game_size",
    "definition_id",
    "role_id",
    "requirement",
    "opportunities",
    "games_with_opportunity",
    "compatible_truce_total",
    "matching_candidate_total",
    "state_available_opportunities",
    "state_availability_rate",
    "hard_feasible_opportunities",
    "opportunity_feasible_opportunities",
    "weighted_pool_entries",
    "accepted_selections",
    "flags",
  ];
  const rows = report.trucePrerequisites.map((row) =>
    [
      row.gameSize,
      row.definitionId,
      row.roleId,
      row.requirement,
      row.opportunities,
      row.gamesWithOpportunity,
      row.compatibleTruceTotal,
      row.matchingCandidateTotal,
      row.stateAvailableOpportunities,
      row.stateAvailabilityRate,
      row.hardFeasibleOpportunities,
      row.opportunityFeasibleOpportunities,
      row.weightedPoolEntries,
      row.acceptedSelections,
      row.flags.join(","),
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}
