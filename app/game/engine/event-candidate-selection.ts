// Phase 1: feasible ordinary-event candidate selection.
import { createSeededRandom, selectWeightedItem, type RandomSource } from "~/game/engine/random";
import { createRoundSeed } from "~/game/engine/rounds";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
import {
  selectEventParticipants,
  type ParticipantSelection,
} from "~/game/events/participant-selection";
import type { RoundReference } from "~/game/types/game-state";
import { getEventSelectionRecoveryPriorityMultiplier } from "~/game/events/event-recovery-priority";
import { getOrdinaryEventParticipantShapeMultiplier } from "~/game/engine/ordinary-event-selection-policy";
import {
  diagnoseEventSelectionFeasibilityRejection,
  isEventSelectionDiagnosticsActive,
  recordEventSelectionCandidateEvaluation,
  type EventSelectionDiagnosticPoolId,
  type EventSelectionDiagnosticStage,
} from "~/game/simulation/event-selection-diagnostics";

export interface FeasibleEventCandidate {
  definition: EventDefinition;

  /**
   * A private proof that this definition can form a complete event using the
   * current reservations. The sequencer selects the winning event's real
   * participants again with the main round RNG.
   */
  feasibilitySelection: ParticipantSelection;

  /**
   * Captured when feasibility is evaluated so selection and future
   * opportunity reporting use the same effective weight.
   */
  effectiveWeight: number;
}

export interface CreateFeasibleEventCandidatesOptions {
  definitions: readonly EventDefinition[];
  context: EventSelectionContext;

  unavailableTributeIds: ReadonlySet<string>;
  unavailableItemInstanceIds: ReadonlySet<string>;

  /**
   * Stable seed shared by all definitions considered for one event slot.
   * Each definition receives its own derived random stream.
   */
  selectionSeed: string;

  /**
   * Feasibility proofs from the previous event slot. A proof can be reused
   * when none of its participants, item owners, or physical item instances
   * have since been reserved.
   */
  previousSelectionsByDefinitionId?: ReadonlyMap<string, ParticipantSelection>;

  diagnostics?: {
    poolId: EventSelectionDiagnosticPoolId;
    stage: EventSelectionDiagnosticStage;
  };
}

export function createEventCandidateSelectionSeed(
  gameSeed: string,
  round: RoundReference,
  eventIndex: number,
): string {
  return [
    createRoundSeed(gameSeed, round),
    "ordinary-event",
    eventIndex,
    "candidate-selection",
  ].join(":");
}

function createDefinitionSelectionRandom(
  selectionSeed: string,
  definitionId: string,
): RandomSource {
  return createSeededRandom([selectionSeed, definitionId].join(":"));
}

function isSelectionStillAvailable(
  selection: ParticipantSelection,
  unavailableTributeIds: ReadonlySet<string>,
  unavailableItemInstanceIds: ReadonlySet<string>,
): boolean {
  if (selection.participantTributeIds.some((tributeId) => unavailableTributeIds.has(tributeId))) {
    return false;
  }

  if (
    selection.selectedItemInstanceIds.some((itemInstanceId) =>
      unavailableItemInstanceIds.has(itemInstanceId),
    )
  ) {
    return false;
  }

  return !Object.values(selection.itemsByRole)
    .flat()
    .some(({ owner }) => unavailableTributeIds.has(owner.id));
}

/**
 * Builds the complete weighted draw pool for one ordinary event slot.
 *
 * A definition enters the pool only when participant selection can produce
 * a complete assignment using the currently available tributes and items.
 * Candidate construction uses a definition-specific random stream, so
 * checking one impossible definition cannot consume or shift the main
 * weighted-selection random stream.
 *
 * Feasibility selections are reusable proofs only. They are deliberately not
 * the assignments used to resolve the winning event.
 */
export function createFeasibleEventCandidates({
  definitions,
  context,
  unavailableTributeIds,
  unavailableItemInstanceIds,
  selectionSeed,
  previousSelectionsByDefinitionId = new Map(),
  diagnostics,
}: CreateFeasibleEventCandidatesOptions): FeasibleEventCandidate[] {
  return definitions.flatMap((definition): FeasibleEventCandidate[] => {
    const previousSelection = previousSelectionsByDefinitionId.get(definition.id);

    const feasibilitySelection =
      previousSelection &&
      isSelectionStillAvailable(
        previousSelection,
        unavailableTributeIds,
        unavailableItemInstanceIds,
      )
        ? previousSelection
        : selectEventParticipants(
            definition,
            context,
            createDefinitionSelectionRandom(selectionSeed, definition.id),
            unavailableTributeIds,
            unavailableItemInstanceIds,
          );

    if (!feasibilitySelection) {
      if (diagnostics && isEventSelectionDiagnosticsActive()) {
        recordEventSelectionCandidateEvaluation({
          ...diagnostics,
          definition,
          eligible: true,
          feasible: false,
          rejectionReason: diagnoseEventSelectionFeasibilityRejection({
            definition,
            context,
            unavailableTributeIds,
            unavailableItemInstanceIds,
            selectionSeed,
          }),
        });
      }

      return [];
    }

    if (diagnostics && isEventSelectionDiagnosticsActive()) {
      recordEventSelectionCandidateEvaluation({
        ...diagnostics,
        definition,
        eligible: true,
        feasible: true,
      });
    }

    return [
      {
        definition,
        feasibilitySelection,
        effectiveWeight:
          getEventDefinitionWeight(definition, context) *
          getOrdinaryEventParticipantShapeMultiplier(definition, context.round) *
          getEventSelectionRecoveryPriorityMultiplier(definition, feasibilitySelection),
      },
    ];
  });
}

/**
 * Performs exactly one weighted draw after every real candidate has proven
 * feasible. Null means that no definition can form a complete event in the
 * current slot.
 */
export function selectFeasibleEventCandidate(
  candidates: readonly FeasibleEventCandidate[],
  random: RandomSource,
): FeasibleEventCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  return selectWeightedItem(candidates, (candidate) => candidate.effectiveWeight, random);
}
