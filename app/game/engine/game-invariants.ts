import type { GameState } from "~/game/types/game-state";

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

    for (const statistic of Object.values(tribute.statistics)) {
      assert(
        Number.isFinite(statistic) && statistic >= 0,
        `tribute "${tribute.id}" has an invalid statistic.`,
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

  if (state.phase === "victory" || state.phase === "statistics") {
    assert(livingTributes.length === 1, `${state.phase} requires exactly one living tribute.`);

    assert(
      state.victorTributeId === livingTributes[0].id,
      "Victor ID must identify the sole living tribute.",
    );
  } else {
    assert(state.victorTributeId === null, `phase "${state.phase}" cannot have a victor.`);
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
