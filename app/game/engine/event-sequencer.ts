import { EVENT_CATALOGUE } from "~/game/events/catalogue/index";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { isEventDefinitionEligible } from "~/game/events/event-eligibility";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
import { createSeededRandom, selectWeightedItem } from "~/game/engine/random";
import { createRoundSeed } from "~/game/engine/rounds";
import { getRoundEventTargetCount } from "~/game/engine/stat-formulas";
import type {
  EventResolutionMode,
  GameState,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";
import {
  POISONOUS_BERRIES_JOINT_VICTORY_EVENT,
  isPoisonousBerriesFinaleEligible,
} from "~/game/events/catalogue/relationships/romantic-events";

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

export function sequenceRoundEvents(state: GameState, round: RoundReference): ResolvedEvent[] {
  const livingTributes = state.tributes.filter((tribute) => tribute.isAlive);

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

    events.push({
      id: eventId,
      definitionId: selected.definition.id,
      resolutionMode,
      round,
      participantTributeIds: selected.selection.participantTributeIds,
      text: resolution.text,
      changes: resolution.changes,
    });

    for (const tributeId of selected.selection.participantTributeIds) {
      unavailableTributeIds.add(tributeId);
    }

    for (const tributeId of selected.selection.participantTributeIds) {
      unavailableTributeIds.add(tributeId);
    }

    for (const itemInstanceId of selected.selection.selectedItemInstanceIds) {
      unavailableItemInstanceIds.add(itemInstanceId);
    }

    /*
     * Also reserve opportunistically consumed items,
     * such as food stolen by the goose or water used
     * as brushfire protection.
     */
    for (const change of resolution.changes) {
      if (change.type === "consume-item") {
        unavailableItemInstanceIds.add(change.itemInstanceId);
      }
    }
  }

  if (events.length === 0) {
    throw new Error(`No eligible events could be sequenced for ${round.period} ${round.day}.`);
  }

  return events;
}
