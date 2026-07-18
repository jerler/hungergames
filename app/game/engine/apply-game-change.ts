import type { GameChange, GameState, GameTribute, ResolvedEvent } from "~/game/types/game-state";

function updateTribute(
  state: GameState,
  tributeId: string,
  update: (tribute: GameTribute) => GameTribute,
): GameState {
  const tributeExists = state.tributes.some((tribute) => tribute.id === tributeId);

  if (!tributeExists) {
    throw new Error(`Cannot update missing tribute "${tributeId}".`);
  }

  return {
    ...state,

    tributes: state.tributes.map((tribute) =>
      tribute.id === tributeId ? update(tribute) : tribute,
    ),
  };
}

export function applyGameChange(
  state: GameState,
  change: GameChange,
  event: ResolvedEvent,
): GameState {
  switch (change.type) {
    case "eliminate-tribute":
      return updateTribute(state, change.tributeId, (tribute) => {
        if (!tribute.isAlive) {
          throw new Error(`Tribute "${tribute.id}" cannot be eliminated twice.`);
        }

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
      });

    case "increment-statistic":
      return updateTribute(state, change.tributeId, (tribute) => ({
        ...tribute,

        statistics: {
          ...tribute.statistics,

          [change.statistic]: tribute.statistics[change.statistic] + change.amount,
        },
      }));

    case "add-status":
      return updateTribute(state, change.tributeId, (tribute) => ({
        ...tribute,
        statuses: [...tribute.statuses, change.status],
      }));

    case "remove-status":
      return updateTribute(state, change.tributeId, (tribute) => ({
        ...tribute,

        statuses: tribute.statuses.filter((status) => status.id !== change.statusId),
      }));

    case "add-inventory-item":
      return updateTribute(state, change.tributeId, (tribute) => ({
        ...tribute,

        inventory: [...tribute.inventory, change.item],
      }));

    case "remove-inventory-item":
      return updateTribute(state, change.tributeId, (tribute) => ({
        ...tribute,

        inventory: tribute.inventory.filter((item) => item.id !== change.itemId),
      }));

    default: {
      const exhaustiveCheck: never = change;

      return exhaustiveCheck;
    }
  }
}

export function applyResolvedEvent(state: GameState, event: ResolvedEvent): GameState {
  if (state.eventHistory.some((historyEvent) => historyEvent.id === event.id)) {
    throw new Error(`Event "${event.id}" cannot be applied twice.`);
  }

  const stateAfterChanges = event.changes.reduce(
    (currentState, change) => applyGameChange(currentState, change, event),
    state,
  );

  return {
    ...stateAfterChanges,

    eventHistory: [...stateAfterChanges.eventHistory, event],
  };
}
