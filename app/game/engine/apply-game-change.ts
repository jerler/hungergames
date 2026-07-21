import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type {
  GameChange,
  GameState,
  GameTribute,
  InventoryTransaction,
  ResolvedEvent,
  VictoryOutcome,
  Truce,
  Vendetta,
} from "~/game/types/game-state";
import { getRoundSequence } from "~/game/engine/rounds";
import { createAccidentalTruceDissolutionEvents } from "~/game/truces/truce-aftermath";

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

function validateTruceFormation(state: GameState, truce: Truce): void {
  if (state.truces.some((candidate) => candidate.id === truce.id)) {
    throw new Error(`Truce "${truce.id}" already exists.`);
  }

  if (truce.tributeIds.length < 2) {
    throw new Error("A truce requires at least two tributes.");
  }

  if (new Set(truce.tributeIds).size !== truce.tributeIds.length) {
    throw new Error(`Truce "${truce.id}" contains duplicate members.`);
  }

  if (truce.kind === "romantic" && truce.tributeIds.length !== 2) {
    throw new Error("A romantic truce must contain exactly two tributes.");
  }

  if (truce.kind === "romantic" && truce.expiresAfterRound) {
    throw new Error("A romantic truce cannot expire automatically.");
  }

  if (truce.kind === "standard" && !truce.expiresAfterRound) {
    throw new Error("A standard truce requires an expiry round.");
  }

  if (
    truce.expiresAfterRound &&
    getRoundSequence(truce.expiresAfterRound) < getRoundSequence(truce.createdRound)
  ) {
    throw new Error(`Truce "${truce.id}" expires before it is created.`);
  }

  for (const tributeId of truce.tributeIds) {
    const tribute = state.tributes.find((candidate) => candidate.id === tributeId);

    if (!tribute) {
      throw new Error(`Truce "${truce.id}" references missing tribute "${tributeId}".`);
    }

    if (!tribute.isAlive) {
      throw new Error(`Dead tribute "${tributeId}" cannot join a truce.`);
    }

    const existingTruce = state.truces.find((candidate) =>
      candidate.tributeIds.includes(tributeId),
    );

    if (existingTruce) {
      throw new Error(`Tribute "${tributeId}" already belongs to truce "${existingTruce.id}".`);
    }
  }
}

function validateVendettaFormation(state: GameState, vendetta: Vendetta): void {
  if (state.vendettas.some((candidate) => candidate.id === vendetta.id)) {
    throw new Error(`Vendetta "${vendetta.id}" already exists.`);
  }

  if (
    state.vendettas.some(
      (candidate) =>
        candidate.hunterTributeId === vendetta.hunterTributeId &&
        candidate.targetTributeId === vendetta.targetTributeId,
    )
  ) {
    throw new Error(
      `Tribute "${vendetta.hunterTributeId}" ` +
        `already has a vendetta against ` +
        `"${vendetta.targetTributeId}".`,
    );
  }

  if (vendetta.hunterTributeId === vendetta.targetTributeId) {
    throw new Error("A tribute cannot form a vendetta against themself.");
  }

  const hunter = state.tributes.find((tribute) => tribute.id === vendetta.hunterTributeId);

  const target = state.tributes.find((tribute) => tribute.id === vendetta.targetTributeId);

  if (!hunter) {
    throw new Error(`Vendetta references missing hunter ` + `"${vendetta.hunterTributeId}".`);
  }

  if (!target) {
    throw new Error(`Vendetta references missing target ` + `"${vendetta.targetTributeId}".`);
  }

  if (!hunter.isAlive) {
    throw new Error(`Dead tribute "${hunter.id}" ` + "cannot form a vendetta.");
  }

  if (!target.isAlive) {
    throw new Error(`A vendetta cannot target dead tribute ` + `"${target.id}".`);
  }
}

function validateVictoryDeclaration(
  state: GameState,
  outcome: VictoryOutcome,
  event: ResolvedEvent,
): void {
  if (state.victoryOutcome) {
    throw new Error("A victory outcome has already been declared.");
  }

  const uniqueVictorIds = new Set(outcome.victorTributeIds);

  if (uniqueVictorIds.size !== outcome.victorTributeIds.length) {
    throw new Error("A victory outcome cannot contain duplicate tributes.");
  }

  const livingTributes = state.tributes.filter((tribute) => tribute.isAlive);

  for (const tributeId of outcome.victorTributeIds) {
    const tribute = state.tributes.find((candidate) => candidate.id === tributeId);

    if (!tribute) {
      throw new Error(`Victory references missing tribute "${tributeId}".`);
    }

    if (!tribute.isAlive) {
      throw new Error(`Dead tribute "${tributeId}" cannot be declared a victor.`);
    }
  }

  const includesEveryLivingTribute =
    outcome.victorTributeIds.length === livingTributes.length &&
    livingTributes.every((tribute) => uniqueVictorIds.has(tribute.id));

  if (!includesEveryLivingTribute) {
    throw new Error("Every living tribute must be included in the victory outcome.");
  }

  if (outcome.kind === "sole") {
    if (outcome.victorTributeIds.length !== 1) {
      throw new Error("A sole victory requires exactly one victor.");
    }

    if (outcome.sourceEventId !== null) {
      throw new Error("A sole victory cannot reference a joint-victory event.");
    }

    return;
  }

  if (outcome.victorTributeIds.length !== 2) {
    throw new Error("A joint victory requires exactly two victors.");
  }

  if (outcome.reason !== "poisonous-berries") {
    throw new Error("A joint victory currently requires the poisonous-berries ending.");
  }

  if (event.definitionId !== "poisonous-berries-joint-victory") {
    throw new Error("A joint victory can only be declared by the poisonous-berries finale.");
  }

  if (outcome.sourceEventId !== event.id) {
    throw new Error("A joint victory must reference the event that declared it.");
  }

  const romanticTruce = state.truces.find(
    (truce) =>
      truce.kind === "romantic" &&
      truce.tributeIds.length === 2 &&
      outcome.victorTributeIds.every((tributeId) => truce.tributeIds.includes(tributeId)),
  );

  if (!romanticTruce) {
    throw new Error("Joint victors must belong to the same active romantic truce.");
  }
}

export function applyGameChange(
  state: GameState,
  change: GameChange,
  event: ResolvedEvent,
): GameState {
  switch (change.type) {
    case "eliminate-tribute": {
      const stateAfterElimination = updateTribute(state, change.tributeId, (tribute) => {
        if (!tribute.isAlive) {
          throw new Error(`Tribute "${tribute.id}" ` + "cannot be eliminated twice.");
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

      /*
       * Vengeful lasts until either the hunter
       * or the target dies. The same cleanup
       * handles both outcomes.
       */
      return {
        ...stateAfterElimination,

        vendettas: stateAfterElimination.vendettas.filter(
          (vendetta) =>
            vendetta.hunterTributeId !== change.tributeId &&
            vendetta.targetTributeId !== change.tributeId,
        ),
      };
    }
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

    case "use-item": {
      const itemOwner = state.tributes.find((tribute) => tribute.id === change.tributeId);

      if (!itemOwner) {
        throw new Error(`Cannot use an item owned by missing tribute ` + `"${change.tributeId}".`);
      }

      const item = itemOwner.inventory.find((candidate) => candidate.id === change.itemInstanceId);

      if (!item) {
        throw new Error(`Cannot use missing item ` + `"${change.itemInstanceId}".`);
      }

      if (item.usesRemaining !== null) {
        throw new Error(`Limited-use item "${item.id}" must be ` + "consumed when used.");
      }

      /*
       * Reusable equipment remains unchanged.
       * The change is retained in event history,
       * but creates no inventory transaction.
       */
      return state;
    }

    case "consume-item": {
      let definitionId: InventoryTransaction["definitionId"] | null = null;

      const stateWithConsumption = updateTribute(state, change.tributeId, (tribute) => {
        const item = tribute.inventory.find((candidate) => candidate.id === change.itemInstanceId);

        if (!item) {
          throw new Error(`Cannot consume missing item "${change.itemInstanceId}".`);
        }

        if (item.usesRemaining === null) {
          throw new Error(`Reusable item "${item.id}" cannot be consumed.`);
        }

        definitionId = item.definitionId;

        return {
          ...tribute,

          inventory: tribute.inventory
            .map((candidate) =>
              candidate.id === item.id
                ? {
                    ...candidate,

                    usesRemaining:
                      candidate.usesRemaining !== null
                        ? candidate.usesRemaining - change.uses
                        : null,
                  }
                : candidate,
            )
            .filter((candidate) => candidate.usesRemaining === null || candidate.usesRemaining > 0),
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

    case "transfer-item": {
      if (change.fromTributeId === change.toTributeId) {
        throw new Error(
          `Cannot transfer item "${change.itemInstanceId}" ` + "to its current owner.",
        );
      }

      const sourceTribute = state.tributes.find((tribute) => tribute.id === change.fromTributeId);

      if (!sourceTribute) {
        throw new Error(`Cannot transfer from missing tribute ` + `"${change.fromTributeId}".`);
      }

      const targetTribute = state.tributes.find((tribute) => tribute.id === change.toTributeId);

      if (!targetTribute) {
        throw new Error(`Cannot transfer to missing tribute ` + `"${change.toTributeId}".`);
      }

      if (!sourceTribute.isAlive) {
        throw new Error(`Dead tribute "${sourceTribute.id}" ` + "cannot transfer an item.");
      }

      if (!targetTribute.isAlive) {
        throw new Error(`Dead tribute "${targetTribute.id}" ` + "cannot receive an item.");
      }

      const item = sourceTribute.inventory.find(
        (candidate) => candidate.id === change.itemInstanceId,
      );

      if (!item) {
        throw new Error(
          `Tribute "${sourceTribute.id}" does not own ` + `item "${change.itemInstanceId}".`,
        );
      }

      if (targetTribute.inventory.some((candidate) => candidate.id === item.id)) {
        throw new Error(`Tribute "${targetTribute.id}" already owns ` + `item "${item.id}".`);
      }

      const stateWithTransfer: GameState = {
        ...state,

        tributes: state.tributes.map((tribute) => {
          if (tribute.id === sourceTribute.id) {
            return {
              ...tribute,

              inventory: tribute.inventory.filter((candidate) => candidate.id !== item.id),
            };
          }

          if (tribute.id === targetTribute.id) {
            return {
              ...tribute,

              /*
               * Move the original item
               * instance without changing
               * its ID, source, acquisition
               * round, or remaining uses.
               */
              inventory: [...tribute.inventory, item],
            };
          }

          return tribute;
        }),
      };

      const transaction: InventoryTransaction = {
        id:
          `transfer:${event.id}:` + `${item.id}:` + `${sourceTribute.id}:` + `${targetTribute.id}`,

        type: "transferred",

        /*
         * Preserve the old transaction
         * convention by treating tributeId
         * as the resulting owner.
         */
        tributeId: targetTribute.id,

        fromTributeId: sourceTribute.id,

        toTributeId: targetTribute.id,

        itemInstanceId: item.id,

        definitionId: item.definitionId,

        uses: item.usesRemaining,

        round: {
          ...event.round,
        },

        sourceId: change.reason,
      };

      return {
        ...stateWithTransfer,

        itemTransactions: [...stateWithTransfer.itemTransactions, transaction],
      };
    }

    case "form-truce": {
      validateTruceFormation(state, change.truce);

      return {
        ...state,

        truces: [...state.truces, change.truce],
      };
    }

    case "break-truce": {
      const truce = state.truces.find((candidate) => candidate.id === change.truceId);

      if (!truce) {
        throw new Error(`Cannot break missing truce "${change.truceId}".`);
      }

      if (truce.kind === "romantic" && change.reason !== "accidental") {
        throw new Error(`Romantic truce "${truce.id}" can only end through accidental separation.`);
      }

      return {
        ...state,

        truces: state.truces.filter((candidate) => candidate.id !== truce.id),
      };
    }

    case "form-vendetta": {
      validateVendettaFormation(state, change.vendetta);

      return {
        ...state,

        vendettas: [...state.vendettas, change.vendetta],
      };
    }

    case "declare-victory": {
      validateVictoryDeclaration(state, change.outcome, event);

      return {
        ...state,
        victoryOutcome: change.outcome,
      };
    }

    default: {
      const exhaustiveCheck: never = change;

      return exhaustiveCheck;
    }
  }
}

function applyEventChanges(state: GameState, event: ResolvedEvent): GameState {
  return event.changes.reduce(
    (currentState, change) => applyGameChange(currentState, change, event),
    state,
  );
}

function appendEventHistory(state: GameState, event: ResolvedEvent): GameState {
  return {
    ...state,

    eventHistory: [...state.eventHistory, event],
  };
}

function insertEventsAfterRoundEvent(
  state: GameState,
  sourceEventId: string,
  insertedEvents: readonly ResolvedEvent[],
): GameState {
  if (insertedEvents.length === 0) {
    return state;
  }

  const sourceIndex = state.roundEvents.findIndex((event) => event.id === sourceEventId);

  /*
   * Unit tests sometimes apply events
   * that were not sequenced into the
   * current round. Their aftermath still
   * enters history, but there is no round
   * feed position to insert it into.
   */
  if (sourceIndex < 0) {
    return state;
  }

  return {
    ...state,

    roundEvents: [
      ...state.roundEvents.slice(0, sourceIndex + 1),

      ...insertedEvents,

      ...state.roundEvents.slice(sourceIndex + 1),
    ],
  };
}

export function applyResolvedEvent(state: GameState, event: ResolvedEvent): GameState {
  if (state.eventHistory.some((historyEvent) => historyEvent.id === event.id)) {
    throw new Error(`Event "${event.id}" cannot be applied twice.`);
  }

  const stateAfterPrimaryChanges = applyEventChanges(state, event);

  let nextState = appendEventHistory(stateAfterPrimaryChanges, event);

  const aftermathEvents = createAccidentalTruceDissolutionEvents(state, nextState, event);

  for (const aftermathEvent of aftermathEvents) {
    if (nextState.eventHistory.some((historyEvent) => historyEvent.id === aftermathEvent.id)) {
      throw new Error(`Automatic event "${aftermathEvent.id}" ` + "cannot be applied twice.");
    }

    nextState = applyEventChanges(nextState, aftermathEvent);

    nextState = appendEventHistory(nextState, aftermathEvent);
  }

  return insertEventsAfterRoundEvent(nextState, event.id, aftermathEvents);
}
