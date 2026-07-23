import type { RandomSource } from "~/game/engine/random";
import type {
  EventDefinition,
  EventResolution,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import type { GameState, RoundReference } from "~/game/types/game-state";

import { AUTHORING_TEST_ROUND } from "./authoring-test-fixtures";

export function createSequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;

  const fallback = values[values.length - 1] ?? 0.5;

  return () => {
    const value = values[index] ?? fallback;

    index += 1;

    return value;
  };
}

export function resolveAuthoredEvent(
  definition: EventDefinition,

  state: GameState,

  participantsByRole: ParticipantsByRole,

  randomValues: readonly number[],

  round: RoundReference = AUTHORING_TEST_ROUND,
): EventResolution {
  return definition.resolve({
    state,
    round,

    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),

    eventId: `test:${definition.id}`,

    random: createSequenceRandom(randomValues),

    participantsByRole,
  });
}
