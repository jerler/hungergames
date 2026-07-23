import {
  countPlannedEliminations,
  determineBloodbathFatalityTarget,
} from "~/game/bloodbath/bloodbath-balance";
import { assignBloodbathStrategies } from "~/game/bloodbath/bloodbath-strategy";
import {
  createSeededRandom,
  selectWeightedItem,
  shuffleItems,
  type RandomSource,
} from "~/game/engine/random";
import { createRoundSeed } from "~/game/engine/rounds";
import {
  CORNUCOPIA_ACQUISITION_EVENTS,
  CORNUCOPIA_GROUP_CONFLICT_EVENTS,
  CORNUCOPIA_PAIR_CONFLICT_EVENTS,
  FLEE_EVENTS,
} from "~/game/events/catalogue/bloodbath";
import { isEventDefinitionEligible } from "~/game/events/event-eligibility";
import type {
  EventDefinition,
  EventSelectionContext,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
import type {
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";
import { getCommittedItemInstanceIds } from "~/game/items/item-reservations";
import { validateEventResolution } from "~/game/events/validation/validate-event-resolution";

function createEventId(round: RoundReference, eventIndex: number, definitionId: string): string {
  return ["bloodbath", round.period, round.day, eventIndex, definitionId].join("-");
}

function selectDefinition(
  definitions: readonly EventDefinition[],
  context: EventSelectionContext,
  random: RandomSource,
): EventDefinition {
  const eligibleDefinitions = definitions.filter((definition) =>
    isEventDefinitionEligible(definition, context),
  );

  if (eligibleDefinitions.length === 0) {
    throw new Error("No eligible Bloodbath event definitions were available.");
  }

  return selectWeightedItem(
    eligibleDefinitions,

    (definition) => getEventDefinitionWeight(definition, context),

    random,
  );
}

interface ResolveBloodbathEventOptions {
  state: GameState;
  round: RoundReference;
  livingTributes: readonly GameTribute[];
  definition: EventDefinition;
  participantsByRole: ParticipantsByRole;
  eventIndex: number;
  random: RandomSource;
  unavailableItemInstanceIds: Set<string>;
}

function resolveBloodbathEvent({
  state,
  round,
  livingTributes,
  definition,
  participantsByRole,
  eventIndex,
  random,
  unavailableItemInstanceIds,
}: ResolveBloodbathEventOptions): ResolvedEvent {
  const eventId = createEventId(round, eventIndex, definition.id);

  const resolution = definition.resolve({
    state,
    round,
    livingTributes,

    eventId,
    random,
    participantsByRole,

    unavailableItemInstanceIds,
  });

  validateEventResolution({
    eventId,
    definitionId: definition.id,
    round,
    resolution,
  });

  const committedItemInstanceIds = getCommittedItemInstanceIds(resolution.changes);

  for (const itemInstanceId of committedItemInstanceIds) {
    if (unavailableItemInstanceIds.has(itemInstanceId)) {
      throw new Error(`Bloodbath item "${itemInstanceId}" ` + "was committed more than once.");
    }

    unavailableItemInstanceIds.add(itemInstanceId);
  }

  return {
    id: eventId,
    definitionId: definition.id,
    resolutionMode: "standard",
    round,

    participantTributeIds: Object.values(participantsByRole)
      .flat()
      .map((tribute) => tribute.id),

    text: resolution.text,
    changes: resolution.changes,
  };
}

interface CornucopiaSequenceResult {
  events: ResolvedEvent[];
  nextEventIndex: number;
  plannedEliminationCount: number;
}

function sequenceCornucopiaEvents(
  state: GameState,
  round: RoundReference,
  livingTributes: readonly GameTribute[],
  cornucopiaTributes: readonly GameTribute[],
  fatalityTarget: number,
  startingEventIndex: number,
  random: RandomSource,
  unavailableItemInstanceIds: Set<string>,
): CornucopiaSequenceResult {
  const context: EventSelectionContext = {
    state,
    round,
    livingTributes,
  };

  const remainingTributes = shuffleItems(cornucopiaTributes, random);

  const events: ResolvedEvent[] = [];

  let eventIndex = startingEventIndex;

  let plannedEliminationCount = 0;

  while (remainingTributes.length > 0) {
    const fatalityDeficit = fatalityTarget - plannedEliminationCount;

    let definition: EventDefinition;

    let participantsByRole: ParticipantsByRole;

    /*
     * Three-person clashes provide enough possible casualties
     * to reach the target without sending every tribute into
     * a separate forced-fatal event.
     */
    if (fatalityDeficit >= 2 && remainingTributes.length >= 3) {
      const contenders = remainingTributes.splice(0, 3);

      if (contenders.length !== 3) {
        throw new Error("Bloodbath group selection lost a contender.");
      }

      definition = selectDefinition(CORNUCOPIA_GROUP_CONFLICT_EVENTS, context, random);

      participantsByRole = {
        contenders,
      };
    } else if (fatalityDeficit > 0 && remainingTributes.length >= 2) {
      const attacker = remainingTributes.shift();

      const defender = remainingTributes.shift();

      if (!attacker || !defender) {
        throw new Error("Bloodbath pair selection lost a participant.");
      }

      definition = selectDefinition(CORNUCOPIA_PAIR_CONFLICT_EVENTS, context, random);

      participantsByRole = {
        attacker: [attacker],
        defender: [defender],
      };
    } else {
      /*
       * Once the soft target is reached—or only one entrant
       * remains—the sequencer falls back to lower-risk
       * acquisition events.
       *
       * It does not reroll previous outcomes or manufacture
       * an elimination solely to hit the target.
       */
      const tribute = remainingTributes.shift();

      if (!tribute) {
        throw new Error("Bloodbath acquisition selection lost a participant.");
      }

      definition = selectDefinition(CORNUCOPIA_ACQUISITION_EVENTS, context, random);

      participantsByRole = {
        tribute: [tribute],
      };
    }

    const event = resolveBloodbathEvent({
      state,
      round,
      livingTributes,
      definition,
      participantsByRole,
      eventIndex,
      random,
      unavailableItemInstanceIds,
    });

    plannedEliminationCount += countPlannedEliminations(event.changes);

    events.push(event);

    eventIndex += 1;
  }

  return {
    events,
    nextEventIndex: eventIndex,
    plannedEliminationCount,
  };
}

function sequenceFleeEvents(
  state: GameState,
  round: RoundReference,
  livingTributes: readonly GameTribute[],
  fleeingTributes: readonly GameTribute[],
  startingEventIndex: number,
  random: RandomSource,
  unavailableItemInstanceIds: Set<string>,
): ResolvedEvent[] {
  const context: EventSelectionContext = {
    state,
    round,
    livingTributes,
  };

  return shuffleItems(fleeingTributes, random).map((tribute, offset) => {
    const definition = selectDefinition(FLEE_EVENTS, context, random);

    return resolveBloodbathEvent({
      state,
      round,
      livingTributes,
      definition,

      participantsByRole: {
        tribute: [tribute],
      },

      eventIndex: startingEventIndex + offset,

      random,
      unavailableItemInstanceIds,
    });
  });
}

function assertParticipantCoverage(
  livingTributes: readonly GameTribute[],
  events: readonly ResolvedEvent[],
): void {
  const participantIds = events.flatMap((event) => event.participantTributeIds);

  if (participantIds.length !== livingTributes.length) {
    throw new Error("Bloodbath sequencing did not cover every living tribute exactly once.");
  }

  if (new Set(participantIds).size !== participantIds.length) {
    throw new Error("A tribute was assigned to more than one Bloodbath event.");
  }

  const livingTributeIds = new Set(livingTributes.map((tribute) => tribute.id));

  if (participantIds.some((tributeId) => !livingTributeIds.has(tributeId))) {
    throw new Error("A Bloodbath event references a tribute outside the starting roster.");
  }
}

export function sequenceBloodbathEvents(state: GameState, round: RoundReference): ResolvedEvent[] {
  if (round.day !== 1 || round.period !== "day") {
    throw new Error("The Bloodbath sequencer may only run during Day 1 daytime.");
  }

  const livingTributes = state.tributes.filter((tribute) => tribute.isAlive);

  if (livingTributes.length <= 1) {
    return [];
  }

  const random = createSeededRandom(createRoundSeed(state.seed, round));

  const strategyPlan = assignBloodbathStrategies(livingTributes, random);

  const fatalityTarget = determineBloodbathFatalityTarget(livingTributes.length, random);

  const strategyByTributeId = new Map(
    strategyPlan.assignments.map(({ tributeId, strategy }) => [tributeId, strategy] as const),
  );

  const cornucopiaTributes = livingTributes.filter(
    (tribute) => strategyByTributeId.get(tribute.id) === "cornucopia",
  );

  const fleeingTributes = livingTributes.filter(
    (tribute) => strategyByTributeId.get(tribute.id) === "flee",
  );

  if (cornucopiaTributes.length !== strategyPlan.cornucopiaCount) {
    throw new Error("Bloodbath strategy assignment produced an invalid Cornucopia count.");
  }

  const unavailableItemInstanceIds = new Set<string>();

  const cornucopiaSequence = sequenceCornucopiaEvents(
    state,
    round,
    livingTributes,
    cornucopiaTributes,
    fatalityTarget,
    0,
    random,
    unavailableItemInstanceIds,
  );

  const fleeEvents = sequenceFleeEvents(
    state,
    round,
    livingTributes,
    fleeingTributes,

    cornucopiaSequence.nextEventIndex,

    random,
    unavailableItemInstanceIds,
  );

  const events = [...cornucopiaSequence.events, ...fleeEvents];

  assertParticipantCoverage(livingTributes, events);

  /*
   * Resolve before shuffling so fatal-pressure decisions are
   * made in a coherent sequence. Feed order remains seeded
   * and does not expose strategy groups.
   */
  return shuffleItems(events, random);
}
