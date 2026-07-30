import { createSeededRandom } from "~/game/engine/random";
import {
  EVENT_PARTICIPANT_SHAPES,
  getEventParticipantCount,
  getEventParticipantShape,
  type EventParticipantShape,
} from "~/game/events/event-participant-shape";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { selectEventParticipants } from "~/game/events/participant-selection";

export const EVENT_SELECTION_DIAGNOSTIC_POOL_IDS = [
  "bloodbath-cornucopia",
  "bloodbath-flee",
  "later-day",
  "night",
] as const;

export type EventSelectionDiagnosticPoolId = (typeof EVENT_SELECTION_DIAGNOSTIC_POOL_IDS)[number];

export const EVENT_SELECTION_DIAGNOSTIC_STAGES = [
  "ordinary",
  "cornucopia-fatal",
  "cornucopia-post-target",
  "flee",
] as const;

export type EventSelectionDiagnosticStage = (typeof EVENT_SELECTION_DIAGNOSTIC_STAGES)[number];

export const EVENT_SELECTION_REJECTION_REASONS = [
  "definition-ineligible",
  "already-used-definition",
  "participant-count-unavailable",
  "participant-or-item-infeasible",
  "reservation-blocked",
  "fatality-target-overshoot",
  "fatality-survivor-budget",
  "lethality-budget-exhausted",
  "planner-stage-not-attempted",
  "weighted-not-selected",
] as const;

export type EventSelectionRejectionReason = (typeof EVENT_SELECTION_REJECTION_REASONS)[number];

export interface EventSelectionDefinitionDiagnostics {
  definitionId: string;
  participantShape: EventParticipantShape;
  considered: number;
  eligible: number;
  feasible: number;
  selected: number;
  rejectionCounts: Readonly<Record<EventSelectionRejectionReason, number>>;
}

export interface EventSelectionStageDiagnostics {
  poolId: EventSelectionDiagnosticPoolId;
  stage: EventSelectionDiagnosticStage;
  opportunities: number;
  noFeasibleCandidates: number;
  noNonSoloFeasible: number;
  selectedSoloWithNonSoloFeasible: number;
  selectedNonSoloWithSoloFeasible: number;
  feasibleByShape: Readonly<Record<EventParticipantShape, number>>;
  selectedByShape: Readonly<Record<EventParticipantShape, number>>;
  definitions: readonly EventSelectionDefinitionDiagnostics[];
}

export interface EventSelectionDiagnosticsSnapshot {
  stages: readonly EventSelectionStageDiagnostics[];
}

export interface EventSelectionPoolDiagnosticsSummary {
  opportunities: number;
  noFeasibleCandidates: number;
  noNonSoloFeasible: number;
  selectedSoloWithNonSoloFeasible: number;
  selectedNonSoloWithSoloFeasible: number;
  feasibleByShape: Readonly<Record<EventParticipantShape, number>>;
  selectedByShape: Readonly<Record<EventParticipantShape, number>>;
  stages: readonly EventSelectionStageDiagnostics[];
  definitions: readonly EventSelectionDefinitionDiagnostics[];
}

interface MutableDefinitionDiagnostics {
  definitionId: string;
  participantShape: EventParticipantShape;
  considered: number;
  eligible: number;
  feasible: number;
  selected: number;
  rejectionCounts: Record<EventSelectionRejectionReason, number>;
}

interface MutableStageDiagnostics {
  poolId: EventSelectionDiagnosticPoolId;
  stage: EventSelectionDiagnosticStage;
  opportunities: number;
  noFeasibleCandidates: number;
  noNonSoloFeasible: number;
  selectedSoloWithNonSoloFeasible: number;
  selectedNonSoloWithSoloFeasible: number;
  feasibleByShape: Record<EventParticipantShape, number>;
  selectedByShape: Record<EventParticipantShape, number>;
  definitionsById: Map<string, MutableDefinitionDiagnostics>;
}

function createShapeRecord(): Record<EventParticipantShape, number> {
  return {
    solo: 0,
    pair: 0,
    trio: 0,
    "group-four-plus": 0,
  };
}

function createRejectionRecord(): Record<EventSelectionRejectionReason, number> {
  return {
    "definition-ineligible": 0,
    "already-used-definition": 0,
    "participant-count-unavailable": 0,
    "participant-or-item-infeasible": 0,
    "reservation-blocked": 0,
    "fatality-target-overshoot": 0,
    "fatality-survivor-budget": 0,
    "lethality-budget-exhausted": 0,
    "planner-stage-not-attempted": 0,
    "weighted-not-selected": 0,
  };
}

function createStageKey(
  poolId: EventSelectionDiagnosticPoolId,
  stage: EventSelectionDiagnosticStage,
): string {
  return `${poolId}:${stage}`;
}

class EventSelectionDiagnosticsCollector {
  private readonly stagesByKey = new Map<string, MutableStageDiagnostics>();

  private getStage(
    poolId: EventSelectionDiagnosticPoolId,
    stage: EventSelectionDiagnosticStage,
  ): MutableStageDiagnostics {
    const key = createStageKey(poolId, stage);
    const existing = this.stagesByKey.get(key);

    if (existing) {
      return existing;
    }

    const created: MutableStageDiagnostics = {
      poolId,
      stage,
      opportunities: 0,
      noFeasibleCandidates: 0,
      noNonSoloFeasible: 0,
      selectedSoloWithNonSoloFeasible: 0,
      selectedNonSoloWithSoloFeasible: 0,
      feasibleByShape: createShapeRecord(),
      selectedByShape: createShapeRecord(),
      definitionsById: new Map(),
    };

    this.stagesByKey.set(key, created);
    return created;
  }

  private getDefinition(
    poolId: EventSelectionDiagnosticPoolId,
    stage: EventSelectionDiagnosticStage,
    definition: EventDefinition,
  ): MutableDefinitionDiagnostics {
    const stageDiagnostics = this.getStage(poolId, stage);
    const existing = stageDiagnostics.definitionsById.get(definition.id);

    if (existing) {
      return existing;
    }

    const created: MutableDefinitionDiagnostics = {
      definitionId: definition.id,
      participantShape: getEventParticipantShape(definition),
      considered: 0,
      eligible: 0,
      feasible: 0,
      selected: 0,
      rejectionCounts: createRejectionRecord(),
    };

    stageDiagnostics.definitionsById.set(definition.id, created);
    return created;
  }

  public recordCandidate({
    poolId,
    stage,
    definition,
    eligible,
    feasible,
    rejectionReason,
  }: {
    poolId: EventSelectionDiagnosticPoolId;
    stage: EventSelectionDiagnosticStage;
    definition: EventDefinition;
    eligible: boolean;
    feasible: boolean;
    rejectionReason?: EventSelectionRejectionReason;
  }): void {
    const diagnostics = this.getDefinition(poolId, stage, definition);

    diagnostics.considered += 1;

    if (eligible) {
      diagnostics.eligible += 1;
    }

    if (feasible) {
      diagnostics.feasible += 1;
    }

    if (rejectionReason) {
      diagnostics.rejectionCounts[rejectionReason] += 1;
    }
  }

  public recordOpportunity({
    poolId,
    stage,
    feasibleDefinitions,
    selectedDefinition,
    plannerConsideredDefinitionIds,
    rejectionReasonsByDefinitionId,
  }: {
    poolId: EventSelectionDiagnosticPoolId;
    stage: EventSelectionDiagnosticStage;
    feasibleDefinitions: readonly EventDefinition[];
    selectedDefinition: EventDefinition | null;
    plannerConsideredDefinitionIds?: ReadonlySet<string>;
    rejectionReasonsByDefinitionId?: ReadonlyMap<string, EventSelectionRejectionReason>;
  }): void {
    const stageDiagnostics = this.getStage(poolId, stage);
    const uniqueFeasibleDefinitions = [
      ...new Map(feasibleDefinitions.map((definition) => [definition.id, definition])).values(),
    ];

    if (
      selectedDefinition &&
      !uniqueFeasibleDefinitions.some((definition) => definition.id === selectedDefinition.id)
    ) {
      this.recordCandidate({
        poolId,
        stage,
        definition: selectedDefinition,
        eligible: true,
        feasible: true,
      });
      uniqueFeasibleDefinitions.push(selectedDefinition);
    }

    stageDiagnostics.opportunities += 1;

    if (uniqueFeasibleDefinitions.length === 0) {
      stageDiagnostics.noFeasibleCandidates += 1;
    }

    const hasSoloFeasible = uniqueFeasibleDefinitions.some(
      (definition) => getEventParticipantShape(definition) === "solo",
    );
    const hasNonSoloFeasible = uniqueFeasibleDefinitions.some(
      (definition) => getEventParticipantShape(definition) !== "solo",
    );

    if (!hasNonSoloFeasible) {
      stageDiagnostics.noNonSoloFeasible += 1;
    }

    for (const definition of uniqueFeasibleDefinitions) {
      stageDiagnostics.feasibleByShape[getEventParticipantShape(definition)] += 1;
    }

    if (selectedDefinition) {
      const selectedShape = getEventParticipantShape(selectedDefinition);
      stageDiagnostics.selectedByShape[selectedShape] += 1;

      if (selectedShape === "solo" && hasNonSoloFeasible) {
        stageDiagnostics.selectedSoloWithNonSoloFeasible += 1;
      }

      if (selectedShape !== "solo" && hasSoloFeasible) {
        stageDiagnostics.selectedNonSoloWithSoloFeasible += 1;
      }

      this.getDefinition(poolId, stage, selectedDefinition).selected += 1;
    }

    for (const definition of uniqueFeasibleDefinitions) {
      if (definition.id === selectedDefinition?.id) {
        continue;
      }

      const explicitReason = rejectionReasonsByDefinitionId?.get(definition.id);
      const reason =
        explicitReason ??
        (plannerConsideredDefinitionIds && !plannerConsideredDefinitionIds.has(definition.id)
          ? "planner-stage-not-attempted"
          : "weighted-not-selected");

      this.getDefinition(poolId, stage, definition).rejectionCounts[reason] += 1;
    }
  }

  public merge(snapshot: EventSelectionDiagnosticsSnapshot): void {
    for (const stage of snapshot.stages) {
      const mutableStage = this.getStage(stage.poolId, stage.stage);

      mutableStage.opportunities += stage.opportunities;
      mutableStage.noFeasibleCandidates += stage.noFeasibleCandidates;
      mutableStage.noNonSoloFeasible += stage.noNonSoloFeasible;
      mutableStage.selectedSoloWithNonSoloFeasible += stage.selectedSoloWithNonSoloFeasible;
      mutableStage.selectedNonSoloWithSoloFeasible += stage.selectedNonSoloWithSoloFeasible;

      for (const shape of EVENT_PARTICIPANT_SHAPES) {
        mutableStage.feasibleByShape[shape] += stage.feasibleByShape[shape];
        mutableStage.selectedByShape[shape] += stage.selectedByShape[shape];
      }

      for (const definition of stage.definitions) {
        const mutableDefinition = mutableStage.definitionsById.get(definition.definitionId) ?? {
          definitionId: definition.definitionId,
          participantShape: definition.participantShape,
          considered: 0,
          eligible: 0,
          feasible: 0,
          selected: 0,
          rejectionCounts: createRejectionRecord(),
        };

        mutableDefinition.considered += definition.considered;
        mutableDefinition.eligible += definition.eligible;
        mutableDefinition.feasible += definition.feasible;
        mutableDefinition.selected += definition.selected;

        for (const reason of EVENT_SELECTION_REJECTION_REASONS) {
          mutableDefinition.rejectionCounts[reason] += definition.rejectionCounts[reason];
        }

        mutableStage.definitionsById.set(definition.definitionId, mutableDefinition);
      }
    }
  }

  public toSnapshot(): EventSelectionDiagnosticsSnapshot {
    return {
      stages: [...this.stagesByKey.values()]
        .map((stage): EventSelectionStageDiagnostics => ({
          poolId: stage.poolId,
          stage: stage.stage,
          opportunities: stage.opportunities,
          noFeasibleCandidates: stage.noFeasibleCandidates,
          noNonSoloFeasible: stage.noNonSoloFeasible,
          selectedSoloWithNonSoloFeasible: stage.selectedSoloWithNonSoloFeasible,
          selectedNonSoloWithSoloFeasible: stage.selectedNonSoloWithSoloFeasible,
          feasibleByShape: { ...stage.feasibleByShape },
          selectedByShape: { ...stage.selectedByShape },
          definitions: [...stage.definitionsById.values()]
            .map((definition) => ({
              ...definition,
              rejectionCounts: { ...definition.rejectionCounts },
            }))
            .sort((first, second) => first.definitionId.localeCompare(second.definitionId)),
        }))
        .sort(
          (first, second) =>
            first.poolId.localeCompare(second.poolId) || first.stage.localeCompare(second.stage),
        ),
    };
  }
}

let activeCollector: EventSelectionDiagnosticsCollector | null = null;

export function captureEventSelectionDiagnostics<T>(callback: () => T): {
  result: T;
  diagnostics: EventSelectionDiagnosticsSnapshot;
} {
  if (activeCollector) {
    throw new Error("Event-selection diagnostics capture cannot be nested.");
  }

  const collector = new EventSelectionDiagnosticsCollector();
  activeCollector = collector;

  try {
    const result = callback();

    return {
      result,
      diagnostics: collector.toSnapshot(),
    };
  } finally {
    activeCollector = null;
  }
}

export function isEventSelectionDiagnosticsActive(): boolean {
  return activeCollector !== null;
}

export function recordEventSelectionCandidateEvaluation(options: {
  poolId: EventSelectionDiagnosticPoolId;
  stage: EventSelectionDiagnosticStage;
  definition: EventDefinition;
  eligible: boolean;
  feasible: boolean;
  rejectionReason?: EventSelectionRejectionReason;
}): void {
  activeCollector?.recordCandidate(options);
}

export function recordEventSelectionOpportunity(options: {
  poolId: EventSelectionDiagnosticPoolId;
  stage: EventSelectionDiagnosticStage;
  feasibleDefinitions: readonly EventDefinition[];
  selectedDefinition: EventDefinition | null;
  plannerConsideredDefinitionIds?: ReadonlySet<string>;
  rejectionReasonsByDefinitionId?: ReadonlyMap<string, EventSelectionRejectionReason>;
}): void {
  activeCollector?.recordOpportunity(options);
}

export function diagnoseEventSelectionFeasibilityRejection({
  definition,
  context,
  unavailableTributeIds,
  unavailableItemInstanceIds,
  selectionSeed,
}: {
  definition: EventDefinition;
  context: EventSelectionContext;
  unavailableTributeIds: ReadonlySet<string>;
  unavailableItemInstanceIds: ReadonlySet<string>;
  selectionSeed: string;
}): EventSelectionRejectionReason {
  const availableTributeCount = context.livingTributes.filter(
    (tribute) => !unavailableTributeIds.has(tribute.id),
  ).length;

  if (getEventParticipantCount(definition) > availableTributeCount) {
    return "participant-count-unavailable";
  }

  const selectionWithoutReservations = selectEventParticipants(
    definition,
    context,
    createSeededRandom([selectionSeed, definition.id].join(":")),
    new Set<string>(),
    new Set<string>(),
  );

  if (
    selectionWithoutReservations &&
    (unavailableTributeIds.size > 0 || unavailableItemInstanceIds.size > 0)
  ) {
    return "reservation-blocked";
  }

  return "participant-or-item-infeasible";
}

export function mergeEventSelectionDiagnostics(
  snapshots: readonly EventSelectionDiagnosticsSnapshot[],
): EventSelectionDiagnosticsSnapshot {
  const collector = new EventSelectionDiagnosticsCollector();

  for (const snapshot of snapshots) {
    collector.merge(snapshot);
  }

  return collector.toSnapshot();
}

export function summarizeEventSelectionDiagnosticsForPool(
  snapshot: EventSelectionDiagnosticsSnapshot,
  poolId: EventSelectionDiagnosticPoolId,
): EventSelectionPoolDiagnosticsSummary {
  const stages = snapshot.stages.filter((stage) => stage.poolId === poolId);
  const collector = new EventSelectionDiagnosticsCollector();

  collector.merge({
    stages,
  });

  const mergedStages = collector.toSnapshot().stages;
  const definitionsById = new Map<string, MutableDefinitionDiagnostics>();
  const feasibleByShape = createShapeRecord();
  const selectedByShape = createShapeRecord();

  let opportunities = 0;
  let noFeasibleCandidates = 0;
  let noNonSoloFeasible = 0;
  let selectedSoloWithNonSoloFeasible = 0;
  let selectedNonSoloWithSoloFeasible = 0;

  for (const stage of mergedStages) {
    opportunities += stage.opportunities;
    noFeasibleCandidates += stage.noFeasibleCandidates;
    noNonSoloFeasible += stage.noNonSoloFeasible;
    selectedSoloWithNonSoloFeasible += stage.selectedSoloWithNonSoloFeasible;
    selectedNonSoloWithSoloFeasible += stage.selectedNonSoloWithSoloFeasible;

    for (const shape of EVENT_PARTICIPANT_SHAPES) {
      feasibleByShape[shape] += stage.feasibleByShape[shape];
      selectedByShape[shape] += stage.selectedByShape[shape];
    }

    for (const definition of stage.definitions) {
      const mutableDefinition = definitionsById.get(definition.definitionId) ?? {
        definitionId: definition.definitionId,
        participantShape: definition.participantShape,
        considered: 0,
        eligible: 0,
        feasible: 0,
        selected: 0,
        rejectionCounts: createRejectionRecord(),
      };

      mutableDefinition.considered += definition.considered;
      mutableDefinition.eligible += definition.eligible;
      mutableDefinition.feasible += definition.feasible;
      mutableDefinition.selected += definition.selected;

      for (const reason of EVENT_SELECTION_REJECTION_REASONS) {
        mutableDefinition.rejectionCounts[reason] += definition.rejectionCounts[reason];
      }

      definitionsById.set(definition.definitionId, mutableDefinition);
    }
  }

  return {
    opportunities,
    noFeasibleCandidates,
    noNonSoloFeasible,
    selectedSoloWithNonSoloFeasible,
    selectedNonSoloWithSoloFeasible,
    feasibleByShape,
    selectedByShape,
    stages: mergedStages,
    definitions: [...definitionsById.values()]
      .map((definition) => ({
        ...definition,
        rejectionCounts: { ...definition.rejectionCounts },
      }))
      .sort(
        (first, second) =>
          second.feasible - first.feasible ||
          second.selected - first.selected ||
          first.definitionId.localeCompare(second.definitionId),
      ),
  };
}
