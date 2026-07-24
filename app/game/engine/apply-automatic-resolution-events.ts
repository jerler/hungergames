import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import type { GameState, ResolvedEvent } from "~/game/types/game-state";

/**
 * Appends derived end-of-round events to the current feed,
 * applies them immediately, and marks both the event and any
 * generated aftermath as revealed.
 *
 * The source event must enter roundEvents before application
 * so applyResolvedEvent can insert aftermath directly after it.
 */
export function applyAutomaticResolutionEvents(
  state: GameState,
  events: readonly ResolvedEvent[],
): GameState {
  let nextState = state;

  for (const event of events) {
    if (nextState.roundEvents.some((candidate) => candidate.id === event.id)) {
      throw new Error(`Automatic event "${event.id}" already exists in the current round.`);
    }

    const historyCountBefore = nextState.eventHistory.length;

    nextState = {
      ...nextState,

      roundEvents: [...nextState.roundEvents, event],
    };

    nextState = applyResolvedEvent(nextState, event);

    const appliedEventCount = nextState.eventHistory.length - historyCountBefore;

    nextState = {
      ...nextState,

      revealedEventCount: Math.min(
        nextState.roundEvents.length,

        nextState.revealedEventCount + appliedEventCount,
      ),
    };
  }

  return nextState;
}
