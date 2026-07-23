import { EVENT_CATALOGUE } from "~/game/events/catalogue/index";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { isEventDefinitionEligible } from "~/game/events/event-eligibility";
import {
  selectEventParticipants,
  type ParticipantSelection,
} from "~/game/events/participant-selection";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
import { createSeededRandom, selectWeightedItem } from "~/game/engine/random";
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

export const MAX_CONSECUTIVE_NON_ELIMINATION_ROUNDS = 2;

export function shouldForceElimination(state: GameState): boolean {
  return state.engine.consecutiveNonEliminationRounds >= MAX_CONSECUTIVE_NON_ELIMINATION_ROUNDS;
}

function createEventId(round: RoundReference, eventIndex: number, definitionId: string): string {
  return [round.period, round.day, eventIndex, definitionId].join("-");
}

function selectDefinitionAndParticipants(
  definitions: readonly EventDefinition[],
  context: EventSelectionContext,
  unavailableTributeIds: ReadonlySet<string>,
  unavailableItemInstanceIds: ReadonlySet<string>,
  random: () => number,
) {
  let remainingDefinitions = [...definitions];

  while (remainingDefinitions.length > 0) {
    const definition = selectWeightedItem(
      remainingDefinitions,

      (candidate) => getEventDefinitionWeight(candidate, context),

      random,
    );

    const selection = selectEventParticipants(
      definition,
      context,
      random,
      unavailableTributeIds,
      unavailableItemInstanceIds,
    );

    if (selection) {
      return {
        definition,
        selection,
      };
    }

    remainingDefinitions = remainingDefinitions.filter(
      (candidate) => candidate.id !== definition.id,
    );
  }

  return null;
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

export function sequenceRoundEvents(state: GameState, round: RoundReference): ResolvedEvent[] {
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

      participantsByRole: selection.participantsByRole,
    });

    validateEventResolution({
      eventId,
      definitionId: definition.id,
      round,
      resolution,
    });

    return [
      {
        id: eventId,

        definitionId: definition.id,

        resolutionMode: "standard",

        round,

        participantTributeIds: selection.participantTributeIds,

        text: resolution.text,

        changes: resolution.changes,
      },
    ];
  }

  const eligibleDefinitions = EVENT_CATALOGUE.filter((definition) =>
    isEventDefinitionEligible(definition, context),
  );

  const targetEventCount = getRoundEventTargetCount(livingTributes.length);

  const unavailableTributeIds = new Set<string>();

  const unavailableItemInstanceIds = new Set<string>();

  const events: ResolvedEvent[] = [];

  for (let eventIndex = 0; eventIndex < targetEventCount; eventIndex += 1) {
    const safetyResolution = eventIndex === 0 && shouldForceElimination(state);

    const candidateDefinitions = safetyResolution
      ? eligibleDefinitions.filter((definition) => definition.category === "fatal")
      : eligibleDefinitions;

    const selected = selectDefinitionAndParticipants(
      candidateDefinitions,
      context,
      unavailableTributeIds,
      unavailableItemInstanceIds,
      random,
    );

    if (!selected) {
      break;
    }

    const eventId = createEventId(round, eventIndex, selected.definition.id);

    const resolutionMode: EventResolutionMode = safetyResolution ? "safety" : "standard";

    const resolution = selected.definition.resolve({
      ...context,

      eventId,
      random,

      participantsByRole: selected.selection.participantsByRole,

      itemsByRole: selected.selection.itemsByRole,

      unavailableItemInstanceIds,
    });

    validateEventResolution({
      eventId,
      definitionId: selected.definition.id,
      round,
      resolution,
    });

    events.push({
      id: eventId,
      definitionId: selected.definition.id,
      resolutionMode,
      round,

      participantTributeIds: selected.selection.participantTributeIds,

      text: resolution.text,
      changes: resolution.changes,
    });

    reserveEventCommitments(
      selected.selection,
      resolution.changes,
      unavailableTributeIds,
      unavailableItemInstanceIds,
    );
  }

  if (events.length === 0) {
    throw new Error(`No eligible events could be sequenced for ${round.period} ${round.day}.`);
  }

  return events;
}
