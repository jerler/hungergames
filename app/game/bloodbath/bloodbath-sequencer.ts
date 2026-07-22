import {
  assignBloodbathStrategies,
  type BloodbathStrategy,
} from "~/game/bloodbath/bloodbath-strategy";
import {
  createSeededRandom,
  selectWeightedItem,
  shuffleItems,
  type RandomSource,
} from "~/game/engine/random";
import { createRoundSeed } from "~/game/engine/rounds";
import {
  CORNUCOPIA_ACQUISITION_EVENTS,
  CORNUCOPIA_CONFLICT_EVENTS,
  FLEE_EVENTS,
} from "~/game/events/catalogue/bloodbath";
import { isEventDefinitionEligible } from
  "~/game/events/event-eligibility";
import type {
  EventDefinition,
  EventSelectionContext,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { getEventDefinitionWeight } from
  "~/game/events/event-weighting";
import type {
  GameChange,
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";

const CORNUCOPIA_CONFLICT_PROBABILITY = 0.65;

interface PendingBloodbathEvent {
  definition: EventDefinition;
  strategy: BloodbathStrategy;
  participantsByRole: ParticipantsByRole;
}

function createEventId(
  round: RoundReference,
  eventIndex: number,
  definitionId: string,
): string {
  return [
    "bloodbath",
    round.period,
    round.day,
    eventIndex,
    definitionId,
  ].join("-");
}

function selectDefinition(
  definitions: readonly EventDefinition[],
  context: EventSelectionContext,
  random: RandomSource,
): EventDefinition {
  const eligibleDefinitions = definitions.filter(
    (definition) =>
      isEventDefinitionEligible(
        definition,
        context,
      ),
  );

  if (eligibleDefinitions.length === 0) {
    throw new Error(
      "No eligible Bloodbath event definitions were available.",
    );
  }

  return selectWeightedItem(
    eligibleDefinitions,
    (definition) =>
      getEventDefinitionWeight(
        definition,
        context,
      ),
    random,
  );
}

function createCornucopiaEvents(
  tributes: readonly GameTribute[],
  context: EventSelectionContext,
  random: RandomSource,
): PendingBloodbathEvent[] {
  const remainingTributes = shuffleItems(
    tributes,
    random,
  );

  const events: PendingBloodbathEvent[] = [];

  while (remainingTributes.length > 0) {
    const shouldCreateConflict =
      remainingTributes.length >= 2 &&
      random() <
        CORNUCOPIA_CONFLICT_PROBABILITY;

    if (shouldCreateConflict) {
      const attacker = remainingTributes.shift();
      const defender = remainingTributes.shift();

      if (!attacker || !defender) {
        throw new Error(
          "Bloodbath conflict selection lost a participant.",
        );
      }

      events.push({
        definition: selectDefinition(
          CORNUCOPIA_CONFLICT_EVENTS,
          context,
          random,
        ),

        strategy: "cornucopia",

        participantsByRole: {
          attacker: [attacker],
          defender: [defender],
        },
      });

      continue;
    }

    const tribute = remainingTributes.shift();

    if (!tribute) {
      throw new Error(
        "Bloodbath acquisition selection lost a participant.",
      );
    }

    events.push({
      definition: selectDefinition(
        CORNUCOPIA_ACQUISITION_EVENTS,
        context,
        random,
      ),

      strategy: "cornucopia",

      participantsByRole: {
        tribute: [tribute],
      },
    });
  }

  return events;
}

function createFleeEvents(
  tributes: readonly GameTribute[],
  context: EventSelectionContext,
  random: RandomSource,
): PendingBloodbathEvent[] {
  return shuffleItems(
    tributes,
    random,
  ).map((tribute) => ({
    definition: selectDefinition(
      FLEE_EVENTS,
      context,
      random,
    ),

    strategy: "flee" as const,

    participantsByRole: {
      tribute: [tribute],
    },
  }));
}

function getParticipantIds(
  pendingEvent: PendingBloodbathEvent,
): string[] {
  return Object.values(
    pendingEvent.participantsByRole,
  )
    .flat()
    .map((tribute) => tribute.id);
}

function getCommittedItemInstanceIds(
  changes: readonly GameChange[],
): string[] {
  return changes.flatMap((change) => {
    switch (change.type) {
      case "acquire-item":
        return [change.item.id];

      case "use-item":
      case "consume-item":
      case "transfer-item":
        return [change.itemInstanceId];

      default:
        return [];
    }
  });
}

function assertParticipantCoverage(
  livingTributes: readonly GameTribute[],
  pendingEvents: readonly PendingBloodbathEvent[],
): void {
  const participantIds = pendingEvents.flatMap(
    getParticipantIds,
  );

  if (
    participantIds.length !==
    livingTributes.length
  ) {
    throw new Error(
      "Bloodbath sequencing did not cover every living tribute exactly once.",
    );
  }

  if (
    new Set(participantIds).size !==
    participantIds.length
  ) {
    throw new Error(
      "A tribute was assigned to more than one Bloodbath event.",
    );
  }

  const livingTributeIds = new Set(
    livingTributes.map(
      (tribute) => tribute.id,
    ),
  );

  if (
    participantIds.some(
      (tributeId) =>
        !livingTributeIds.has(tributeId),
    )
  ) {
    throw new Error(
      "A Bloodbath event references a tribute outside the starting roster.",
    );
  }
}

function resolvePendingEvents(
  state: GameState,
  round: RoundReference,
  livingTributes: readonly GameTribute[],
  pendingEvents: readonly PendingBloodbathEvent[],
  random: RandomSource,
): ResolvedEvent[] {
  const unavailableItemInstanceIds =
    new Set<string>();

  return pendingEvents.map(
    (
      {
        definition,
        participantsByRole,
      },
      eventIndex,
    ) => {
      const eventId = createEventId(
        round,
        eventIndex,
        definition.id,
      );

      const resolution = definition.resolve({
        state,
        round,
        livingTributes,

        eventId,
        random,
        participantsByRole,

        unavailableItemInstanceIds,
      });

      const committedItemInstanceIds =
        getCommittedItemInstanceIds(
          resolution.changes,
        );

      for (
        const itemInstanceId of
        committedItemInstanceIds
      ) {
        if (
          unavailableItemInstanceIds.has(
            itemInstanceId,
          )
        ) {
          throw new Error(
            `Bloodbath item "${itemInstanceId}" ` +
              "was committed to more than one event.",
          );
        }

        unavailableItemInstanceIds.add(
          itemInstanceId,
        );
      }

      return {
        id: eventId,
        definitionId: definition.id,
        resolutionMode: "standard",
        round,

        participantTributeIds:
          Object.values(
            participantsByRole,
          )
            .flat()
            .map((tribute) => tribute.id),

        text: resolution.text,
        changes: resolution.changes,
      };
    },
  );
}

export function sequenceBloodbathEvents(
  state: GameState,
  round: RoundReference,
): ResolvedEvent[] {
  if (
    round.day !== 1 ||
    round.period !== "day"
  ) {
    throw new Error(
      "The Bloodbath sequencer may only run during Day 1 daytime.",
    );
  }

  const livingTributes =
    state.tributes.filter(
      (tribute) => tribute.isAlive,
    );

  if (livingTributes.length <= 1) {
    return [];
  }

  const random = createSeededRandom(
    createRoundSeed(
      state.seed,
      round,
    ),
  );

  const strategyPlan =
    assignBloodbathStrategies(
      livingTributes,
      random,
    );

  const strategiesByTributeId = new Map(
    strategyPlan.assignments.map(
      ({
        tributeId,
        strategy,
      }) =>
        [
          tributeId,
          strategy,
        ] as const,
    ),
  );

  const cornucopiaTributes =
    livingTributes.filter(
      (tribute) =>
        strategiesByTributeId.get(
          tribute.id,
        ) === "cornucopia",
    );

  const fleeingTributes =
    livingTributes.filter(
      (tribute) =>
        strategiesByTributeId.get(
          tribute.id,
        ) === "flee",
    );

  if (
    cornucopiaTributes.length !==
    strategyPlan.cornucopiaCount
  ) {
    throw new Error(
      "Bloodbath strategy assignment produced an invalid Cornucopia count.",
    );
  }

  const context: EventSelectionContext = {
    state,
    round,
    livingTributes,
  };

  const pendingEvents = [
    ...createCornucopiaEvents(
      cornucopiaTributes,
      context,
      random,
    ),

    ...createFleeEvents(
      fleeingTributes,
      context,
      random,
    ),
  ];

  assertParticipantCoverage(
    livingTributes,
    pendingEvents,
  );

  const orderedEvents = shuffleItems(
    pendingEvents,
    random,
  );

  return resolvePendingEvents(
    state,
    round,
    livingTributes,
    orderedEvents,
    random,
  );
}