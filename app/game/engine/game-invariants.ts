import type { GameState } from "~/game/types/game-state";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import { getRoundSequence } from "~/game/engine/rounds";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Game invariant violated: ${message}`);
  }
}

function assertUniqueValues(values: readonly string[], label: string): void {
  assert(new Set(values).size === values.length, `${label} must be unique.`);
}

export function assertGameStateInvariants(state: GameState): void {
  const expectedTributeCount = state.config.districtCount * 2;

  assert(
    state.tributes.length === expectedTributeCount,
    `expected ${expectedTributeCount} tributes but found ${state.tributes.length}.`,
  );

  assertUniqueValues(
    state.tributes.map((tribute) => tribute.id),
    "Tribute IDs",
  );

  assertUniqueValues(
    state.tributes.map((tribute) => `${tribute.district}-${tribute.districtPosition}`),
    "District tribute slots",
  );

  const tributeIds = new Set(state.tributes.map((tribute) => tribute.id));

  assertUniqueValues(
    state.tributes.flatMap((tribute) => tribute.inventory.map((item) => item.id)),
    "Inventory item IDs across all tributes",
  );

  const truceIdByTributeId = new Map<string, string>();

  for (const truce of state.truces) {
    assert(truce.tributeIds.length >= 2, `truce "${truce.id}" must contain at least two tributes.`);

    assertUniqueValues(truce.tributeIds, `Member IDs for truce "${truce.id}"`);

    if (truce.kind === "romantic") {
      assert(
        truce.tributeIds.length === 2,
        `romantic truce "${truce.id}" must contain exactly two tributes.`,
      );

      assert(
        truce.expiresAfterRound === null,
        `romantic truce "${truce.id}" cannot expire automatically.`,
      );
    }

    if (truce.kind === "standard") {
      assert(
        truce.expiresAfterRound !== null,
        `standard truce "${truce.id}" must have an expiry round.`,
      );
    }

    if (truce.expiresAfterRound) {
      assert(
        getRoundSequence(truce.expiresAfterRound) >= getRoundSequence(truce.createdRound),
        `truce "${truce.id}" expires before it was created.`,
      );
    }

    for (const tributeId of truce.tributeIds) {
      const tribute = state.tributes.find((candidate) => candidate.id === tributeId);

      assert(tribute, `truce "${truce.id}" references missing tribute "${tributeId}".`);

      assert(tribute.isAlive, `truce "${truce.id}" contains dead tribute "${tributeId}".`);

      const existingTruceId = truceIdByTributeId.get(tributeId);

      assert(
        !existingTruceId,
        `tribute "${tributeId}" belongs to both "${existingTruceId}" and "${truce.id}".`,
      );

      truceIdByTributeId.set(tributeId, truce.id);
    }
  }
  for (const tribute of state.tributes) {
    assert(
      tribute.district >= 1 && tribute.district <= state.config.districtCount,
      `tribute "${tribute.id}" has an invalid district.`,
    );

    assert(
      tribute.districtPosition === 1 || tribute.districtPosition === 2,
      `tribute "${tribute.id}" has an invalid district position.`,
    );

    assert(
      tribute.isAlive ? tribute.death === null : tribute.death !== null,
      `tribute "${tribute.id}" has inconsistent life and death state.`,
    );

    assertUniqueValues(
      tribute.statuses.map((status) => status.id),
      `Status IDs for tribute "${tribute.id}"`,
    );

    assertUniqueValues(
      tribute.inventory.map((item) => item.id),
      `Inventory IDs for tribute "${tribute.id}"`,
    );

    for (const status of tribute.statuses) {
      const definition = getStatusDefinition(status.definitionId);

      assert(
        status.severity >= 1 && status.severity <= definition.maxSeverity,
        `status "${status.id}" has invalid severity.`,
      );

      assert(
        Number.isInteger(status.remainingRounds) && status.remainingRounds > 0,
        `status "${status.id}" has invalid duration.`,
      );
    }

    for (const item of tribute.inventory) {
      const definition = getItemDefinition(item.definitionId);

      assert(
        Number.isInteger(item.usesRemaining) &&
          item.usesRemaining > 0 &&
          item.usesRemaining <= definition.maxUses,
        `item "${item.id}" has invalid remaining uses.`,
      );
    }

    for (const statistic of Object.values(tribute.statistics)) {
      assert(
        Number.isFinite(statistic) && statistic >= 0,
        `tribute "${tribute.id}" has an invalid statistic.`,
      );
    }
  }

  assertUniqueValues(
    state.itemTransactions.map((transaction) => transaction.id),
    "Inventory transaction IDs",
  );

  const itemUseLedger = new Map<string, number>();

  const itemOwnerLedger = new Map<string, string>();

  for (const transaction of state.itemTransactions) {
    assert(
      tributeIds.has(transaction.tributeId),
      `inventory transaction "${transaction.id}" ` + "references a missing tribute.",
    );

    getItemDefinition(transaction.definitionId);

    assert(
      Number.isInteger(transaction.uses) && transaction.uses > 0,
      `inventory transaction "${transaction.id}" ` + "has invalid uses.",
    );

    if (transaction.type === "acquired") {
      assert(
        !itemUseLedger.has(transaction.itemInstanceId),
        `item "${transaction.itemInstanceId}" ` + "was acquired more than once.",
      );

      itemUseLedger.set(transaction.itemInstanceId, transaction.uses);

      itemOwnerLedger.set(transaction.itemInstanceId, transaction.tributeId);

      continue;
    }

    const remainingUses = itemUseLedger.get(transaction.itemInstanceId);

    assert(
      remainingUses !== undefined,
      `item "${transaction.itemInstanceId}" ` + `was ${transaction.type} before acquisition.`,
    );

    const currentOwnerId = itemOwnerLedger.get(transaction.itemInstanceId);

    assert(
      currentOwnerId !== undefined,
      `item "${transaction.itemInstanceId}" ` + "does not have an owner.",
    );

    if (transaction.type === "transferred") {
      assert(
        tributeIds.has(transaction.fromTributeId),
        `transfer "${transaction.id}" references ` + "a missing source tribute.",
      );

      assert(
        tributeIds.has(transaction.toTributeId),
        `transfer "${transaction.id}" references ` + "a missing target tribute.",
      );

      assert(
        transaction.tributeId === transaction.toTributeId,
        `transfer "${transaction.id}" has an ` + "inconsistent resulting owner.",
      );

      assert(
        currentOwnerId === transaction.fromTributeId,
        `item "${transaction.itemInstanceId}" was ` +
          `transferred by "${transaction.fromTributeId}" ` +
          `but is owned by "${currentOwnerId}".`,
      );

      assert(
        transaction.uses === remainingUses,
        `transfer "${transaction.id}" changed the ` + "recorded remaining uses.",
      );

      itemOwnerLedger.set(transaction.itemInstanceId, transaction.toTributeId);

      continue;
    }

    assert(
      currentOwnerId === transaction.tributeId,
      `item "${transaction.itemInstanceId}" was ` +
        `consumed by "${transaction.tributeId}" ` +
        `but is owned by "${currentOwnerId}".`,
    );

    assert(
      remainingUses >= transaction.uses,
      `item "${transaction.itemInstanceId}" ` + "was over-consumed.",
    );

    itemUseLedger.set(transaction.itemInstanceId, remainingUses - transaction.uses);
  }

  for (const tribute of state.tributes) {
    for (const item of tribute.inventory) {
      assert(
        itemUseLedger.get(item.id) === item.usesRemaining,
        `item "${item.id}" does not match ` + "its transaction history.",
      );

      assert(
        itemOwnerLedger.get(item.id) === tribute.id,
        `item "${item.id}" is held by ` +
          `"${tribute.id}" but its transaction ` +
          "history records another owner.",
      );
    }
  }

  assert(
    state.revealedEventCount >= 0 && state.revealedEventCount <= state.roundEvents.length,
    "Revealed event count is outside the current round.",
  );

  assertUniqueValues(
    state.roundEvents.map((event) => event.id),
    "Current round event IDs",
  );

  assertUniqueValues(
    state.eventHistory.map((event) => event.id),
    "Event history IDs",
  );

  const historyEventIds = new Set(state.eventHistory.map((event) => event.id));

  const revealedCurrentEvents = state.roundEvents.slice(0, state.revealedEventCount);

  for (const event of revealedCurrentEvents) {
    assert(
      historyEventIds.has(event.id),
      `revealed event "${event.id}" is absent from event history.`,
    );
  }

  for (const event of [...state.roundEvents, ...state.eventHistory]) {
    for (const participantId of event.participantTributeIds) {
      assert(
        tributeIds.has(participantId),
        `event "${event.id}" references missing tribute "${participantId}".`,
      );
    }
  }

  const eliminationChanges = state.eventHistory.flatMap((event) =>
    event.changes
      .filter((change) => change.type === "eliminate-tribute")
      .map((change) => ({
        event,
        change,
      })),
  );

  assertUniqueValues(
    eliminationChanges.map(({ change }) => change.tributeId),
    "Eliminated tribute IDs",
  );

  for (const tribute of state.tributes) {
    if (!tribute.death) {
      continue;
    }

    assert(
      historyEventIds.has(tribute.death.resolvedEventId),
      `death for tribute "${tribute.id}" references an unknown event.`,
    );
  }

  const livingTributes = state.tributes.filter((tribute) => tribute.isAlive);

  const livingTributeIds = new Set(livingTributes.map((tribute) => tribute.id));

  if (state.phase === "victory" || state.phase === "statistics") {
    assert(state.victoryOutcome !== null, `${state.phase} requires a victory outcome.`);
  }

  if (state.phase === "opening" || state.phase === "round-complete") {
    assert(state.victoryOutcome === null, `phase "${state.phase}" cannot have a victory outcome.`);
  }

  if (state.victoryOutcome) {
    const victoryOutcome = state.victoryOutcome;

    assertUniqueValues(victoryOutcome.victorTributeIds, "Victor tribute IDs");

    for (const tributeId of victoryOutcome.victorTributeIds) {
      assert(tributeIds.has(tributeId), `victory references missing tribute "${tributeId}".`);

      assert(livingTributeIds.has(tributeId), `victor "${tributeId}" must still be alive.`);
    }

    assert(
      victoryOutcome.victorTributeIds.length === livingTributes.length,
      "Every living tribute must be included in the victory outcome.",
    );

    if (victoryOutcome.kind === "sole") {
      assert(
        victoryOutcome.victorTributeIds.length === 1,
        "A sole victory requires exactly one victor.",
      );

      assert(livingTributes.length === 1, "A sole victory requires exactly one living tribute.");

      assert(
        victoryOutcome.sourceEventId === null,
        "A sole victory must not reference a joint-victory event.",
      );
    } else {
      assert(
        victoryOutcome.victorTributeIds.length === 2,
        "A joint victory requires exactly two victors.",
      );

      assert(livingTributes.length === 2, "A joint victory requires exactly two living tributes.");

      assert(
        victoryOutcome.reason === "poisonous-berries",
        "Joint victory currently requires the poisonous-berries finale.",
      );

      const sourceEvent = state.eventHistory.find(
        (event) => event.id === victoryOutcome.sourceEventId,
      );

      assert(sourceEvent !== undefined, "Joint victory must reference an event in event history.");

      assert(
        sourceEvent?.definitionId === "poisonous-berries-joint-victory",
        "Joint victory must reference its poisonous-berries event.",
      );

      const romanticTruce = state.truces.find(
        (truce) =>
          truce.kind === "romantic" &&
          victoryOutcome.victorTributeIds.every((tributeId) =>
            truce.tributeIds.includes(tributeId),
          ),
      );

      assert(romanticTruce !== undefined, "Joint victors must belong to the same romantic truce.");
    }
  }

  if (state.phase === "opening") {
    assert(state.currentRound === null, "Opening phase cannot have a current round.");
  }

  if (state.phase === "round-events" || state.phase === "round-complete") {
    assert(state.currentRound !== null, `phase "${state.phase}" requires a current round.`);
  }

  if (state.phase === "round-complete") {
    assert(
      state.revealedEventCount === state.roundEvents.length,
      "A completed round must reveal every event.",
    );
  }

  assert(
    Number.isInteger(state.engine.consecutiveNonEliminationRounds) &&
      state.engine.consecutiveNonEliminationRounds >= 0,
    "Non-elimination round count must be a non-negative integer.",
  );

  assert(
    Number.isInteger(state.engine.forcedResolutionCount) && state.engine.forcedResolutionCount >= 0,
    "Forced resolution count must be a non-negative integer.",
  );
}

export function assertGameStateInvariantsInDevelopment(state: GameState): void {
  if (import.meta.env.DEV) {
    assertGameStateInvariants(state);
  }
}
