import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { assertGameStateInvariantsInDevelopment } from "~/game/engine/game-invariants";
import { resolveRound } from "~/game/engine/resolve-round";
import { getNextRound } from "~/game/engine/rounds";
import { selectLivingTributes } from "~/game/selectors/game-selectors";
import type { GameState } from "~/game/types/game-state";
import type { GameAction } from "~/state/game-actions";
import { prepareTributesForRound } from "~/game/items/inventory-engine";
import { advanceStatusDurations } from "~/game/statuses/status-engine";

export type GameReducerState = GameState | null;

function finalizeState(state: GameState): GameState {
  assertGameStateInvariantsInDevelopment(state);

  return state;
}

function beginNextRound(state: GameState, now: string): GameState {
  const livingTributes = selectLivingTributes(state);

  if (livingTributes.length <= 1) {
    return finalizeState({
      ...state,
      phase: "victory",

      victorTributeId: livingTributes[0]?.id ?? null,

      updatedAt: now,
    });
  }

  const nextRound = getNextRound(state.currentRound);

  const preparedState = prepareTributesForRound(state, nextRound);

  return finalizeState({
    ...preparedState,
    phase: "round-events",
    currentRound: nextRound,

    roundEvents: resolveRound(preparedState, nextRound),

    revealedEventCount: 0,
    updatedAt: now,
  });
}

function completeRound(state: GameState, now: string): GameState {
  const stateWithAdvancedStatuses = advanceStatusDurations(state);

  const containedElimination = stateWithAdvancedStatuses.roundEvents.some((event) =>
    event.changes.some((change) => change.type === "eliminate-tribute"),
  );

  const containedSafetyResolution = stateWithAdvancedStatuses.roundEvents.some(
    (event) => event.resolutionMode === "safety",
  );

  const livingTributes = selectLivingTributes(stateWithAdvancedStatuses);

  return finalizeState({
    ...stateWithAdvancedStatuses,

    phase: livingTributes.length === 1 ? "victory" : "round-complete",

    victorTributeId: livingTributes.length === 1 ? livingTributes[0].id : null,

    engine: {
      consecutiveNonEliminationRounds: containedElimination
        ? 0
        : state.engine.consecutiveNonEliminationRounds + 1,

      forcedResolutionCount:
        state.engine.forcedResolutionCount + (containedSafetyResolution ? 1 : 0),
    },

    updatedAt: now,
  });
}

function revealNextEvent(state: GameState, now: string): GameState {
  if (state.phase !== "round-events") {
    return finalizeState(state);
  }

  const event = state.roundEvents[state.revealedEventCount];

  if (!event) {
    return completeRound(state, now);
  }

  const stateAfterEvent = applyResolvedEvent(state, event);

  const revealedEventCount = state.revealedEventCount + 1;

  const stateWithReveal = {
    ...stateAfterEvent,
    revealedEventCount,
    updatedAt: now,
  };

  if (revealedEventCount === state.roundEvents.length) {
    return completeRound(stateWithReveal, now);
  }

  return finalizeState(stateWithReveal);
}

function revealEntireRound(state: GameState, now: string): GameState {
  let nextState = state;

  while (nextState.phase === "round-events") {
    const previousRevealCount = nextState.revealedEventCount;

    nextState = revealNextEvent(nextState, now);

    if (nextState.revealedEventCount === previousRevealCount) {
      break;
    }
  }

  return finalizeState(nextState);
}

export function gameReducer(state: GameReducerState, action: GameAction): GameReducerState {
  if (action.type === "game/loaded") {
    return finalizeState(action.game);
  }

  if (action.type === "game/reset") {
    return null;
  }

  if (!state) {
    return state;
  }

  switch (action.type) {
    case "round/began":
      return beginNextRound(state, action.now);

    case "event/revealed":
      return revealNextEvent(state, action.now);

    case "round/revealed":
      return revealEntireRound(state, action.now);

    case "statistics/opened":
      if (state.phase !== "victory") {
        return finalizeState(state);
      }

      return finalizeState({
        ...state,
        phase: "statistics",
        updatedAt: action.now,
      });

    default:
      return finalizeState(state);
  }
}
