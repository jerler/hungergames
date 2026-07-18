import {
  FATAL_EVENT_DEFINITIONS,
  SURVIVAL_EVENT_DEFINITIONS,
} from "~/game/events/event-definitions";
import { createSeededRandom, selectRandomItem, shuffleItems } from "~/game/engine/random";
import { createRoundSeed, formatRoundLabel } from "~/game/engine/rounds";
import type {
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";

function createEventId(
  round: RoundReference,
  category: "fatal" | "survival",
  index: number,
  definitionId: string,
): string {
  return [round.period, round.day, category, index, definitionId].join("-");
}

function createFatalEvents(
  victims: readonly GameTribute[],
  survivingTributes: readonly GameTribute[],
  round: RoundReference,
  random: () => number,
): ResolvedEvent[] {
  const availableDefinitions = FATAL_EVENT_DEFINITIONS.filter((definition) =>
    definition.periods.includes(round.period),
  );

  return victims.map((victim, index) => {
    const definition = selectRandomItem(availableDefinitions, random);

    const killer = definition.requiresKiller ? selectRandomItem(survivingTributes, random) : null;

    const killerTributeIds = killer ? [killer.id] : [];

    const text = definition.createText(victim, killer);

    return {
      id: createEventId(round, "fatal", index, definition.id),

      definitionId: definition.id,
      round,
      participantTributeIds: [victim.id, ...killerTributeIds],
      text,

      changes: [
        {
          type: "eliminate-tribute",
          tributeId: victim.id,
          causeId: definition.id,
          causeLabel: definition.causeLabel,
          summary: text,
          killerTributeIds,
        },
      ],
    };
  });
}

function createSurvivalEvents(
  survivingTributes: readonly GameTribute[],
  round: RoundReference,
  random: () => number,
): ResolvedEvent[] {
  if (survivingTributes.length <= 1) {
    return [];
  }

  const desiredEventCount = Math.min(3, Math.max(1, Math.ceil(survivingTributes.length / 6)));

  const availableParticipants = shuffleItems(survivingTributes, random);

  const events: ResolvedEvent[] = [];
  let participantIndex = 0;

  for (let eventIndex = 0; eventIndex < desiredEventCount; eventIndex += 1) {
    const remainingParticipantCount = availableParticipants.length - participantIndex;

    const eligibleDefinitions = SURVIVAL_EVENT_DEFINITIONS.filter(
      (definition) =>
        definition.periods.includes(round.period) &&
        definition.participantCount <= remainingParticipantCount,
    );

    if (eligibleDefinitions.length === 0) {
      break;
    }

    const definition = selectRandomItem(eligibleDefinitions, random);

    const participants = availableParticipants.slice(
      participantIndex,
      participantIndex + definition.participantCount,
    );

    participantIndex += definition.participantCount;

    events.push({
      id: createEventId(round, "survival", eventIndex, definition.id),

      definitionId: definition.id,
      round,
      participantTributeIds: participants.map((tribute) => tribute.id),
      text: definition.createText(participants),
      changes: [],
    });
  }

  return events;
}

export function resolveRound(state: GameState, round: RoundReference): ResolvedEvent[] {
  const livingTributes = state.tributes.filter((tribute) => tribute.isAlive);

  if (livingTributes.length <= 1) {
    return [];
  }

  const random = createSeededRandom(createRoundSeed(state.seed, round));

  const shuffledTributes = shuffleItems(livingTributes, random);

  const intendedDeathCount = Math.max(1, Math.ceil(livingTributes.length * 0.3));

  const deathCount = Math.min(livingTributes.length - 1, intendedDeathCount);

  const victims = shuffledTributes.slice(0, deathCount);

  const survivingTributes = shuffledTributes.slice(deathCount);

  const fatalEvents = createFatalEvents(victims, survivingTributes, round, random);

  const survivalEvents = createSurvivalEvents(survivingTributes, round, random);

  const events = shuffleItems([...fatalEvents, ...survivalEvents], random);

  if (events.length === 0) {
    throw new Error(`No events were generated for ${formatRoundLabel(round)}.`);
  }

  return events;
}
