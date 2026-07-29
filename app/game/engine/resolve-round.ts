import { sequenceRoundEvents } from "~/game/engine/event-sequencer";
import { shuffleRoundEventsForPresentation } from "~/game/engine/event-presentation-order";
import type { GameState, ResolvedEvent, RoundReference } from "~/game/types/game-state";

export function resolveRound(
  state: GameState,
  round: RoundReference,
  committedItemInstanceIds: ReadonlySet<string> = new Set<string>(),
): ResolvedEvent[] {
  const sequencedEvents = sequenceRoundEvents(state, round, committedItemInstanceIds);

  return shuffleRoundEventsForPresentation(state, round, sequencedEvents);
}
