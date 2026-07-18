import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type {
  GameChange,
  GameState,
  GameTribute,
  InventoryTransaction,
  ResolvedEvent,
} from "~/game/types/game-state";

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

    case "apply-status":
      return updateTribute(state, change.tributeId, (tribute) => {
        const definition = getStatusDefinition(change.status.definitionId);

        const existingStatus = tribute.statuses.find(
          (status) => status.definitionId === change.status.definitionId,
        );

        if (!existingStatus) {
          return {
            ...tribute,
            statuses: [...tribute.statuses, change.status],
          };
        }

        return {
          ...tribute,

          statuses: tribute.statuses.map((status) =>
            status.id === existingStatus.id
              ? {
                  ...status,

                  severity: Math.min(
                    definition.maxSeverity,
                    status.severity + change.status.severity,
                  ) as 1 | 2 | 3,

                  remainingRounds: Math.max(status.remainingRounds, change.status.remainingRounds),
                }
              : status,
          ),
        };
      });

    case "remove-status":
      return updateTribute(state, change.tributeId, (tribute) => ({
        ...tribute,

        statuses: tribute.statuses.filter((status) => status.id !== change.statusId),
      }));

    case "acquire-item": {
      const stateWithItem = updateTribute(state, change.tributeId, (tribute) => ({
        ...tribute,
        inventory: [...tribute.inventory, change.item],
      }));

      const transaction: InventoryTransaction = {
        id: `acquire:${event.id}:${change.item.id}`,
        type: "acquired",
        tributeId: change.tributeId,
        itemInstanceId: change.item.id,
        definitionId: change.item.definitionId,
        uses: change.item.usesRemaining,
        round: {
          ...event.round,
        },
        sourceId: event.id,
      };

      return {
        ...stateWithItem,
        itemTransactions: [...stateWithItem.itemTransactions, transaction],
      };
    }

    case "consume-item": {
      let definitionId: InventoryTransaction["definitionId"] | null = null;

      const stateWithConsumption = updateTribute(state, change.tributeId, (tribute) => {
        const item = tribute.inventory.find((candidate) => candidate.id === change.itemInstanceId);

        if (!item) {
          throw new Error(`Cannot consume missing item "${change.itemInstanceId}".`);
        }

        if (item.usesRemaining < change.uses) {
          throw new Error(`Item "${item.id}" does not have enough remaining uses.`);
        }

        definitionId = item.definitionId;

        return {
          ...tribute,

          inventory: tribute.inventory
            .map((candidate) =>
              candidate.id === item.id
                ? {
                    ...candidate,

                    usesRemaining: candidate.usesRemaining - change.uses,
                  }
                : candidate,
            )
            .filter((candidate) => candidate.usesRemaining > 0),
        };
      });

      if (!definitionId) {
        throw new Error("Consumed item definition could not be resolved.");
      }

      const transaction: InventoryTransaction = {
        id: `consume:${event.id}:${change.itemInstanceId}`,
        type: "consumed",
        tributeId: change.tributeId,
        itemInstanceId: change.itemInstanceId,
        definitionId,
        uses: change.uses,
        round: {
          ...event.round,
        },
        sourceId: change.reason,
      };

      return {
        ...stateWithConsumption,

        itemTransactions: [...stateWithConsumption.itemTransactions, transaction],
      };
    }

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
