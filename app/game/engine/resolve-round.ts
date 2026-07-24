import { sequenceRoundEvents } from "~/game/engine/event-sequencer";
import type { GameState, ResolvedEvent, RoundReference } from "~/game/types/game-state";

export function resolveRound(
  state: GameState,
  round: RoundReference,
  committedItemInstanceIds: ReadonlySet<string> = new Set<string>(),
): ResolvedEvent[] {
  return sequenceRoundEvents(state, round, committedItemInstanceIds);
}
