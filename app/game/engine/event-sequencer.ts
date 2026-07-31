import { EVENT_CATALOGUE } from "~/game/events/catalogue/index";
import type { EventSelectionContext } from "~/game/events/event-schema";
import { isEventDefinitionEligible } from "~/game/events/event-eligibility";
import {
  selectEventParticipants,
  type ParticipantSelection,
} from "~/game/events/participant-selection";
import {
  createEventCandidateSelectionSeed,
  createFeasibleEventCandidates,
  selectFeasibleEventCandidate,
} from "~/game/engine/event-candidate-selection";
import { createSeededRandom } from "~/game/engine/random";
import { createRoundSeed } from "~/game/engine/rounds";
import { getRoundEventTargetCount } from "~/game/engine/stat-formulas";
import { sequenceBloodbathEvents } from "~/game/bloodbath/bloodbath-sequencer";
import type {
  EventResolutionMode,
  GameChange,
  GameState,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";
import {
  POISONOUS_BERRIES_JOINT_VICTORY_EVENT,
  isPoisonousBerriesFinaleEligible,
} from "~/game/events/catalogue/relationships/romantic-events";
import { getCommittedItemInstanceIds } from "~/game/items/item-reservations";
import { validateEventResolution } from "~/game/events/validation/validate-event-resolution";
import { completeNightRestCoverage } from "~/game/survival/night-rest-coverage";
import { countPendingFatalStatusResolutions } from "~/game/statuses/status-engine";
import { canPreserveRemainingEventSlots } from "~/game/engine/ordinary-event-selection-policy";
import {
  countEliminationChanges,
  getLethalCandidateWeightMultiplier,
  getRoundLethalityProfile,
  isPotentiallyLethalDefinition,
} from "~/game/engine/round-lethality";
import {
  isEventSelectionDiagnosticsActive,
  recordEventSelectionCandidateEvaluation,
  recordEventSelectionOpportunity,
  type EventSelectionRejectionReason,
} from "~/game/simulation/event-selection-diagnostics";

export const MAX_CONSECUTIVE_NON_ELIMINATION_ROUNDS = 2;

export function shouldForceElimination(state: GameState): boolean {
  return state.engine.consecutiveNonEliminationRounds >= MAX_CONSECUTIVE_NON_ELIMINATION_ROUNDS;
}

function createEventId(round: RoundReference, eventIndex: number, definitionId: string): string {
  return [round.period, round.day, eventIndex, definitionId].join("-");
}

/**
 * Records every tribute and physical item whose state must remain
 * stable after an ordinary event has been planned for this round.
 *
 * Reservations exist only while sequencing the current round.
 */
export function reserveEventCommitments(
  selection: ParticipantSelection,
  changes: readonly GameChange[],
  unavailableTributeIds: Set<string>,
  unavailableItemInstanceIds: Set<string>,
  state?: GameState,
): void {
  /*
   * Visible participants cannot appear in another event
   * during this round.
   */
  for (const tributeId of selection.participantTributeIds) {
    unavailableTributeIds.add(tributeId);
  }

  /*
   * A required item may belong to a truce partner rather
   * than the visible user. Reserve that physical owner so
   * another event cannot kill them or move their inventory.
   */
  for (const itemSelection of Object.values(selection.itemsByRole).flat()) {
    unavailableTributeIds.add(itemSelection.owner.id);
  }

  /*
   * Items selected during participant selection are
   * committed even if resolution ultimately produces
   * no use or consumption change.
   */
  for (const itemInstanceId of selection.selectedItemInstanceIds) {
    unavailableItemInstanceIds.add(itemInstanceId);
  }

  /*
   * Some events locate an item opportunistically during
   * resolution rather than through a required-item role.
   *
   * Reserve every inventory owner whose state is referenced
   * or mutated by the resulting changes.
   */
  for (const change of changes) {
    switch (change.type) {
      case "eliminate-tribute": {
        unavailableTributeIds.add(change.tributeId);

        /*
         * A death can automatically dissolve an active truce when the
         * event is revealed. Reserve every member now so no later event
         * in this already-resolved round can also consume that truce.
         */
        for (const truce of state?.truces ?? []) {
          if (!truce.tributeIds.includes(change.tributeId)) {
            continue;
          }

          for (const tributeId of truce.tributeIds) {
            unavailableTributeIds.add(tributeId);
          }
        }

        break;
      }

      case "form-truce":
        for (const tributeId of change.truce.tributeIds) {
          unavailableTributeIds.add(tributeId);
        }
        break;

      case "break-truce": {
        const truce = state?.truces.find((candidate) => candidate.id === change.truceId);

        for (const tributeId of truce?.tributeIds ?? []) {
          unavailableTributeIds.add(tributeId);
        }

        break;
      }

      case "form-vendetta":
        unavailableTributeIds.add(change.vendetta.hunterTributeId);
        unavailableTributeIds.add(change.vendetta.targetTributeId);
        break;

      case "acquire-item":
      case "use-item":
      case "consume-item":
        unavailableTributeIds.add(change.tributeId);
        break;

      case "transfer-item":
        unavailableTributeIds.add(change.fromTributeId);
        unavailableTributeIds.add(change.toTributeId);
        break;

      default:
        break;
    }
  }

  /*
   * Reserve every newly created, used, consumed, or
   * transferred physical item instance.
   */
  for (const itemInstanceId of getCommittedItemInstanceIds(changes)) {
    unavailableItemInstanceIds.add(itemInstanceId);
  }
}

function getCommittedItemOwnerIds(
  state: GameState,
  committedItemInstanceIds: ReadonlySet<string>,
): Set<string> {
  const ownerIds = new Set<string>();

  /*
   * A preparation item may remain in inventory after use:
   *
   * - reusable equipment remains unchanged
   * - limited-use equipment may retain additional uses
   *
   * Reserve its current physical owner so a primary event
   * cannot kill them, transfer the item, or otherwise mutate
   * the inventory that preparation already committed.
   *
   * Fully consumed items are no longer present and therefore
   * do not require an owner reservation.
   */
  for (const tribute of state.tributes) {
    const ownsCommittedItem = tribute.inventory.some((item) =>
      committedItemInstanceIds.has(item.id),
    );

    if (ownsCommittedItem) {
      ownerIds.add(tribute.id);
    }
  }

  return ownerIds;
}

export function sequenceRoundEvents(
  state: GameState,
  round: RoundReference,
  committedItemInstanceIds: ReadonlySet<string> = new Set<string>(),
): ResolvedEvent[] {
  if (round.day === 1 && round.period === "day") {
    return sequenceBloodbathEvents(state, round);
  }

  const livingTributes = state.tributes.filter((tribute) => tribute.isAlive);

  // Existing function continues unchanged.
  if (livingTributes.length <= 1) {
    return [];
  }

  const random = createSeededRandom(createRoundSeed(state.seed, round));

  const context: EventSelectionContext = {
    state,
    round,
    livingTributes,
  };

  if (isPoisonousBerriesFinaleEligible(state)) {
    const definition = POISONOUS_BERRIES_JOINT_VICTORY_EVENT;

    const selection = selectEventParticipants(definition, context, random, new Set());

    if (!selection) {
      throw new Error(
        "The poisonous-berries finale was eligible but its participants could not be selected.",
      );
    }

    const eventId = createEventId(round, 0, definition.id);

    const resolution = definition.resolve({
      ...context,

      eventId,
      random,

      resolutionMode: "standard",

      participantsByRole: selection.participantsByRole,
    });

    validateEventResolution({
      eventId,
      definitionId: definition.id,
      round,
      resolution,
    });

    const finaleEvent: ResolvedEvent = {
      id: eventId,
      definitionId: definition.id,
      kind: "primary",
      resolutionMode: "standard",
      round,
      participantTributeIds: selection.participantTributeIds,
      text: resolution.text,
      changes: resolution.changes,
    };

    return completeNightRestCoverage(state, round, [finaleEvent]);
  }

  const eligibleDefinitions = EVENT_CATALOGUE.filter((definition) =>
    isEventDefinitionEligible(definition, context),
  );
  const eligibleDefinitionIds = new Set(eligibleDefinitions.map((definition) => definition.id));
  const diagnosticPoolId = round.period === "night" ? ("night" as const) : ("later-day" as const);
  const captureSelectionDiagnostics = isEventSelectionDiagnosticsActive();

  const targetEventCount = getRoundEventTargetCount(livingTributes.length);

  const unavailableItemInstanceIds = new Set(committedItemInstanceIds);

  const unavailableTributeIds = getCommittedItemOwnerIds(state, unavailableItemInstanceIds);

  const events: ResolvedEvent[] = [];
  const usedDefinitionIds = new Set<string>();

  const lethalityProfile = getRoundLethalityProfile(round, livingTributes.length);

  const pendingFatalStatusEliminationCount = countPendingFatalStatusResolutions(state, round);

  let plannedEliminationCount = Math.min(
    lethalityProfile.maxEliminations,
    pendingFatalStatusEliminationCount,
  );
  const lethalityRejectedDefinitionIds = new Set<string>();

  let feasibilitySelectionsByDefinitionId = new Map<string, ParticipantSelection>();

  for (let eventIndex = 0; eventIndex < targetEventCount; eventIndex += 1) {
    const hasEliminationBudget = plannedEliminationCount < lethalityProfile.maxEliminations;

    const isSafetyResolution =
      eventIndex === 0 && hasEliminationBudget && shouldForceElimination(state);

    if (captureSelectionDiagnostics) {
      for (const definition of EVENT_CATALOGUE) {
        let rejectionReason: EventSelectionRejectionReason | null = null;
        const isEligible = eligibleDefinitionIds.has(definition.id);

        if (!isEligible) {
          rejectionReason = "definition-ineligible";
        } else if (
          isSafetyResolution &&
          definition.category !== "fatal" &&
          !("safetyResolution" in definition && definition.safetyResolution === "force-success")
        ) {
          rejectionReason = "planner-stage-not-attempted";
        } else if (usedDefinitionIds.has(definition.id)) {
          rejectionReason = "already-used-definition";
        } else if (lethalityRejectedDefinitionIds.has(definition.id)) {
          rejectionReason = "fatality-target-overshoot";
        } else if (!hasEliminationBudget && isPotentiallyLethalDefinition(definition)) {
          rejectionReason = "lethality-budget-exhausted";
        }

        if (rejectionReason) {
          recordEventSelectionCandidateEvaluation({
            poolId: diagnosticPoolId,
            stage: "ordinary",
            definition,
            eligible: isEligible,
            feasible: false,
            rejectionReason,
          });
        }
      }
    }

    const candidateDefinitions = (
      isSafetyResolution
        ? eligibleDefinitions.filter(
            (definition) =>
              definition.category === "fatal" ||
              ("safetyResolution" in definition && definition.safetyResolution === "force-success"),
          )
        : eligibleDefinitions
    ).filter(
      (definition) =>
        !usedDefinitionIds.has(definition.id) &&
        !lethalityRejectedDefinitionIds.has(definition.id) &&
        (hasEliminationBudget || !isPotentiallyLethalDefinition(definition)),
    );

    const feasibleCandidates = createFeasibleEventCandidates({
      definitions: candidateDefinitions,
      context,
      unavailableTributeIds,
      unavailableItemInstanceIds,
      selectionSeed: createEventCandidateSelectionSeed(state.seed, round, eventIndex),
      previousSelectionsByDefinitionId: feasibilitySelectionsByDefinitionId,
      ...(captureSelectionDiagnostics
        ? {
            diagnostics: {
              poolId: diagnosticPoolId,
              stage: "ordinary" as const,
            },
          }
        : {}),
    });

    feasibilitySelectionsByDefinitionId = new Map(
      feasibleCandidates.map((candidate) => [
        candidate.definition.id,
        candidate.feasibilitySelection,
      ]),
    );

    const availableTributeCount = livingTributes.filter(
      (tribute) => !unavailableTributeIds.has(tribute.id),
    ).length;
    const remainingEventSlotCount = targetEventCount - eventIndex - 1;
    const coverageSafeCandidates = feasibleCandidates.filter((candidate) =>
      canPreserveRemainingEventSlots({
        selection: candidate.feasibilitySelection,
        availableTributeCount,
        remainingEventSlotCount,
      }),
    );

    /*
     * Prefer candidates that preserve enough participants for every remaining
     * event slot. If no candidate can do so, retain the complete feasible pool
     * so low-population and structurally unavoidable rounds still resolve.
     */
    const plannerCandidates =
      coverageSafeCandidates.length > 0 ? coverageSafeCandidates : feasibleCandidates;

    let remainingCandidates = plannerCandidates.map((candidate) => ({
      ...candidate,
      effectiveWeight:
        candidate.effectiveWeight *
        (isPotentiallyLethalDefinition(candidate.definition)
          ? getLethalCandidateWeightMultiplier(lethalityProfile, plannedEliminationCount)
          : 1),
    }));

    let acceptedEvent = false;
    let acceptedDefinition: (typeof feasibleCandidates)[number]["definition"] | null = null;
    const opportunityRejectionReasons = new Map<string, EventSelectionRejectionReason>();

    while (remainingCandidates.length > 0) {
      const selected = selectFeasibleEventCandidate(remainingCandidates, random);

      if (!selected) {
        break;
      }

      const selection = selectEventParticipants(
        selected.definition,
        context,
        random,
        unavailableTributeIds,
        unavailableItemInstanceIds,
      );

      if (!selection) {
        throw new Error(
          `Feasible event "${selected.definition.id}" could not reproduce a participant selection.`,
        );
      }

      const eventId = createEventId(round, eventIndex, selected.definition.id);
      const resolutionMode: EventResolutionMode = isSafetyResolution ? "safety" : "standard";

      const resolution = selected.definition.resolve({
        ...context,
        eventId,
        random,
        resolutionMode,
        participantsByRole: selection.participantsByRole,
        itemsByRole: selection.itemsByRole,
        unavailableItemInstanceIds,
      });

      validateEventResolution({
        eventId,
        definitionId: selected.definition.id,
        round,
        resolution,
      });

      const eventEliminationCount = countEliminationChanges(resolution.changes);

      if (plannedEliminationCount + eventEliminationCount > lethalityProfile.maxEliminations) {
        lethalityRejectedDefinitionIds.add(selected.definition.id);
        opportunityRejectionReasons.set(selected.definition.id, "fatality-target-overshoot");
        remainingCandidates = remainingCandidates.filter(
          (candidate) => candidate.definition.id !== selected.definition.id,
        );
        continue;
      }

      events.push({
        id: eventId,
        definitionId: selected.definition.id,
        kind: "primary",
        resolutionMode,
        round,
        participantTributeIds: selection.participantTributeIds,
        text: resolution.text,
        changes: resolution.changes,
      });

      plannedEliminationCount += eventEliminationCount;
      usedDefinitionIds.add(selected.definition.id);

      reserveEventCommitments(
        selection,
        resolution.changes,
        unavailableTributeIds,
        unavailableItemInstanceIds,
      );

      acceptedDefinition = selected.definition;
      acceptedEvent = true;
      break;
    }

    if (captureSelectionDiagnostics) {
      recordEventSelectionOpportunity({
        poolId: diagnosticPoolId,
        stage: "ordinary",
        feasibleDefinitions: feasibleCandidates.map((candidate) => candidate.definition),
        selectedDefinition: acceptedDefinition,
        plannerConsideredDefinitionIds: new Set(
          plannerCandidates.map((candidate) => candidate.definition.id),
        ),
        rejectionReasonsByDefinitionId: opportunityRejectionReasons,
      });
    }

    if (!acceptedEvent) {
      break;
    }
  }

  const completedEvents = completeNightRestCoverage(state, round, events);

  if (completedEvents.length === 0) {
    throw new Error(`No eligible events could be sequenced for ${round.period} ${round.day}.`);
  }

  return completedEvents;
}
