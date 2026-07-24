import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { CURRENT_GAME_STATE_SCHEMA_VERSION, type GameState } from "~/game/types/game-state";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
        `This build supports schema version ${CURRENT_GAME_STATE_SCHEMA_VERSION}.`,
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

  const state = value as unknown as GameState;

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
