import { sequenceRoundEvents } from "~/game/engine/event-sequencer";
import type { GameState, ResolvedEvent, RoundReference } from "~/game/types/game-state";

export function resolveRound(state: GameState, round: RoundReference): ResolvedEvent[] {
  return sequenceRoundEvents(state, round);
}
