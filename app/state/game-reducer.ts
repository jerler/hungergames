import { resolveRound } from "~/game/engine/resolve-round";
import { getNextRound } from "~/game/engine/rounds";
import { selectLivingTributes } from "~/game/selectors/game-selectors";
import type { GameState, ResolvedEvent } from "~/game/types/game-state";
import type { GameAction } from "~/state/game-actions";

export type GameReducerState = GameState | null;

function beginNextRound(state: GameState, now: string): GameState {
  const livingTributes = selectLivingTributes(state);

  if (livingTributes.length <= 1) {
    return {
      ...state,
      phase: "victory",
      victorTributeId: livingTributes[0]?.id ?? null,
      updatedAt: now,
    };
  }

  const nextRound = getNextRound(state.currentRound);

  return {
    ...state,
    phase: "round-events",
    currentRound: nextRound,
    roundEvents: resolveRound(state, nextRound),
    revealedEventCount: 0,
    updatedAt: now,
  };
}

function applyResolvedEvent(state: GameState, event: ResolvedEvent): GameState {
  let updatedTributes = state.tributes;

  for (const change of event.changes) {
    if (change.type === "eliminate-tribute") {
      const victim = updatedTributes.find((tribute) => tribute.id === change.tributeId);

      if (!victim || !victim.isAlive) {
        continue;
      }

      updatedTributes = updatedTributes.map((tribute) => {
        if (tribute.id === change.tributeId) {
          return {
            ...tribute,
            isAlive: false,
            death: {
              round: event.round,
              causeId: change.causeId,
              causeLabel: change.causeLabel,
              summary: change.summary,
              killerTributeIds: change.killerTributeIds,
              resolvedEventId: event.id,
            },
          };
        }

        if (change.killerTributeIds.includes(tribute.id)) {
          return {
            ...tribute,
            statistics: {
              ...tribute.statistics,
              kills: tribute.statistics.kills + 1,
            },
          };
        }

        return tribute;
      });
    }
  }

  return {
    ...state,
    tributes: updatedTributes,
    eventHistory: [...state.eventHistory, event],
  };
}

function completeRound(state: GameState, now: string): GameState {
  const tributesWithSurvivalCredit = state.tributes.map((tribute) => {
    if (!tribute.isAlive) {
      return tribute;
    }

    return {
      ...tribute,
      statistics: {
        ...tribute.statistics,
        eventsSurvived: tribute.statistics.eventsSurvived + 1,
      },
    };
  });

  const livingTributes = tributesWithSurvivalCredit.filter((tribute) => tribute.isAlive);

  return {
    ...state,
    tributes: tributesWithSurvivalCredit,
    phase: livingTributes.length === 1 ? "victory" : "round-complete",
    victorTributeId: livingTributes.length === 1 ? livingTributes[0].id : null,
    updatedAt: now,
  };
}

function revealNextEvent(state: GameState, now: string): GameState {
  if (state.phase !== "round-events") {
    return state;
  }

  const event = state.roundEvents[state.revealedEventCount];

  if (!event) {
    return completeRound(state, now);
  }

  const stateAfterEvent = applyResolvedEvent(state, event);

  const revealedEventCount = state.revealedEventCount + 1;

  const stateWithRevealCount = {
    ...stateAfterEvent,
    revealedEventCount,
    updatedAt: now,
  };

  if (revealedEventCount === state.roundEvents.length) {
    return completeRound(stateWithRevealCount, now);
  }

  return stateWithRevealCount;
}

function revealEntireRound(state: GameState, now: string): GameState {
  let nextState = state;

  while (nextState.phase === "round-events") {
    const previousRevealedEventCount = nextState.revealedEventCount;

    nextState = revealNextEvent(nextState, now);

    if (nextState.revealedEventCount === previousRevealedEventCount) {
      break;
    }
  }

  return nextState;
}

export function gameReducer(state: GameReducerState, action: GameAction): GameReducerState {
  if (action.type === "game/loaded") {
    return action.game;
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
        return state;
      }

      return {
        ...state,
        phase: "statistics",
        updatedAt: action.now,
      };

    default:
      return state;
  }
}
