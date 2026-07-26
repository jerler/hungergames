import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { isLegacyFoodWaterItemId } from "~/game/survival/survival-resource-schema";
import {
  CURRENT_GAME_STATE_SCHEMA_VERSION,
  type GameChange,
  type GameState,
  type ResolvedEvent,
} from "~/game/types/game-state";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDeprecatedSurvivalCounters(state: GameState): GameState {
  const hasDeprecatedCounters = state.tributes.some((tribute) => {
    const survival = tribute.survival as unknown as Record<string, unknown>;

    return "roundsWithoutFood" in survival || "roundsWithoutWater" in survival;
  });

  if (!hasDeprecatedCounters) {
    return state;
  }

  return {
    ...state,
    tributes: state.tributes.map((tribute) => ({
      ...tribute,
      survival: {
        lastFoundFoodRound: tribute.survival.lastFoundFoodRound,
        lastFoundWaterRound: tribute.survival.lastFoundWaterRound,
        lastNightRest: tribute.survival.lastNightRest,
      },
    })),
  };
}

function normalizeVisibleRoundQueue(state: GameState): GameState {
  const containsAutomaticRoundEvents = state.roundEvents.some(
    (event) => event.kind === "preparation",
  );

  if (!containsAutomaticRoundEvents) {
    return state;
  }

  const revealedVisibleEventCount = state.roundEvents
    .slice(0, state.revealedEventCount)
    .filter((event) => event.kind !== "preparation").length;

  return {
    ...state,
    roundEvents: state.roundEvents.filter((event) => event.kind !== "preparation"),
    revealedEventCount: revealedVisibleEventCount,
  };
}

function isDeprecatedResourcePreparation(event: ResolvedEvent): boolean {
  const mechanic = (
    event.preparation as
      | {
          mechanic?: unknown;
        }
      | undefined
  )?.mechanic;

  return mechanic === "hydration-consumption" || mechanic === "food-consumption";
}

function isDeprecatedResourceItemChange(
  change: GameChange,
  deprecatedItemInstanceIds: ReadonlySet<string>,
): boolean {
  switch (change.type) {
    case "acquire-item":
      return isLegacyFoodWaterItemId(change.item.definitionId);

    case "consume-item":
    case "use-item":
    case "transfer-item":
      return deprecatedItemInstanceIds.has(change.itemInstanceId);

    default:
      return false;
  }
}

function normalizeHistoricalEvent(
  event: ResolvedEvent,
  deprecatedItemInstanceIds: ReadonlySet<string>,
): ResolvedEvent {
  return {
    ...event,
    changes: event.changes.filter(
      (change) => !isDeprecatedResourceItemChange(change, deprecatedItemInstanceIds),
    ),
  };
}

function normalizeDeprecatedFoodWaterInventory(state: GameState): GameState {
  const deprecatedItemInstanceIds = new Set<string>();

  for (const tribute of state.tributes) {
    for (const item of tribute.inventory) {
      if (isLegacyFoodWaterItemId(item.definitionId)) {
        deprecatedItemInstanceIds.add(item.id);
      }
    }
  }

  for (const transaction of state.itemTransactions) {
    if (isLegacyFoodWaterItemId(transaction.definitionId)) {
      deprecatedItemInstanceIds.add(transaction.itemInstanceId);
    }
  }

  const containsDeprecatedResourceData = (event: ResolvedEvent): boolean =>
    isDeprecatedResourcePreparation(event) ||
    event.changes.some((change) =>
      isDeprecatedResourceItemChange(change, deprecatedItemInstanceIds),
    );

  const requiresNormalization =
    deprecatedItemInstanceIds.size > 0 ||
    state.roundEvents.some(containsDeprecatedResourceData) ||
    state.eventHistory.some(containsDeprecatedResourceData);

  if (!requiresNormalization) {
    return state;
  }

  const normalizeEvents = (events: readonly ResolvedEvent[]): ResolvedEvent[] =>
    events
      .filter((event) => !isDeprecatedResourcePreparation(event))
      .map((event) => normalizeHistoricalEvent(event, deprecatedItemInstanceIds));

  return {
    ...state,
    tributes: state.tributes.map((tribute) => ({
      ...tribute,
      inventory: tribute.inventory.filter((item) => !isLegacyFoodWaterItemId(item.definitionId)),
    })),
    roundEvents: normalizeEvents(state.roundEvents),
    eventHistory: normalizeEvents(state.eventHistory),
    itemTransactions: state.itemTransactions.filter(
      (transaction) => !isLegacyFoodWaterItemId(transaction.definitionId),
    ),
  };
}

export class UnsupportedGameStateSchemaError extends Error {
  readonly receivedSchemaVersion: unknown;

  constructor(receivedSchemaVersion: unknown) {
    const receivedLabel =
      typeof receivedSchemaVersion === "number"
        ? String(receivedSchemaVersion)
        : "missing or invalid";

    super(
      `Cannot load GameState schema version ${receivedLabel}. ` +
        `This build supports schema version ` +
        `${CURRENT_GAME_STATE_SCHEMA_VERSION}.`,
    );

    this.name = "UnsupportedGameStateSchemaError";
    this.receivedSchemaVersion = receivedSchemaVersion;
  }
}

export function loadGameState(value: unknown): GameState {
  if (!isRecord(value)) {
    throw new Error("Cannot load a GameState that is not an object.");
  }

  if (value.schemaVersion !== CURRENT_GAME_STATE_SCHEMA_VERSION) {
    throw new UnsupportedGameStateSchemaError(value.schemaVersion);
  }

  const state = normalizeDeprecatedFoodWaterInventory(
    normalizeVisibleRoundQueue(normalizeDeprecatedSurvivalCounters(value as unknown as GameState)),
  );

  try {
    assertGameStateInvariants(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown validation failure.";

    throw new Error(`Cannot load invalid GameState: ${message}`, {
      cause: error,
    });
  }

  return state;
}
