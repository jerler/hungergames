import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import { CURRENT_GAME_STATE_SCHEMA_VERSION } from "~/game/types/game-state";

import { loadGameState, UnsupportedGameStateSchemaError } from "./game-state-loader";

function createGame() {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
    "random",
    {
      createId: () => {
        nextId += 1;
        return `loaded-game-id-${nextId}`;
      },
      seed: "loaded-game-tests",
      now: "2026-07-23T12:00:00.000Z",
    },
  );
}

describe("loadGameState", () => {
  it("accepts a valid current-schema game", () => {
    const game = createGame();

    expect(loadGameState(game)).toBe(game);
    expect(game.schemaVersion).toBe(CURRENT_GAME_STATE_SCHEMA_VERSION);
  });

  it("rejects schema-1 games intentionally", () => {
    const schemaOneGame = {
      ...createGame(),
      schemaVersion: 1,
    };

    expect(() => loadGameState(schemaOneGame)).toThrow(UnsupportedGameStateSchemaError);

    expect(() => loadGameState(schemaOneGame)).toThrow(/schema version 1/i);
  });

  it("rejects schema-2 saves using the retired status model", () => {
    const game = createGame();

    const schemaTwoGame = {
      ...game,
      schemaVersion: 2,

      tributes: game.tributes.map((tribute, index) =>
        index === 0
          ? {
              ...tribute,

              statuses: [
                {
                  id: "legacy-concealed-status",
                  definitionId: "concealed",
                  severity: 2,
                  remainingRounds: 2,
                  sourceEventId: "legacy-concealment-event",

                  appliedRound: {
                    day: 1,
                    period: "day",
                  },
                },
              ],
            }
          : tribute,
      ),
    };

    expect(() => loadGameState(schemaTwoGame)).toThrow(UnsupportedGameStateSchemaError);

    expect(() => loadGameState(schemaTwoGame)).toThrow(/schema version 2/i);
  });

  it.each(["concealed", "sick", "exposed"] as const)(
    "rejects a current-schema save containing retired status %s",
    (definitionId) => {
      const game = createGame();

      const invalidGame = {
        ...game,

        tributes: game.tributes.map((tribute, index) =>
          index === 0
            ? {
                ...tribute,

                statuses: [
                  {
                    id: `invalid-${definitionId}-status`,

                    definitionId,
                    severity: 1,
                    remainingRounds: 2,

                    sourceEventId: "invalid-status-event",

                    appliedRound: {
                      day: 1,
                      period: "day",
                    },
                  },
                ],
              }
            : tribute,
        ),
      };

      expect(() => loadGameState(invalidGame)).toThrow(
        new RegExp(`unknown status definition "${definitionId}"`, "i"),
      );
    },
  );

  it("rejects unknown future schema versions", () => {
    const futureGame = {
      ...createGame(),
      schemaVersion: CURRENT_GAME_STATE_SCHEMA_VERSION + 1,
    };

    expect(() => loadGameState(futureGame)).toThrow(UnsupportedGameStateSchemaError);
  });

  it("rejects objects without a schema version", () => {
    const unversionedGame = { ...createGame() } as Record<string, unknown>;
    delete unversionedGame.schemaVersion;

    expect(() => loadGameState(unversionedGame)).toThrow(UnsupportedGameStateSchemaError);
  });

  it("rejects invalid state carrying the current schema version", () => {
    const game = createGame();

    const invalidGame = {
      ...game,
      tributes: game.tributes.map((tribute, index) =>
        index === 0
          ? {
              ...tribute,
              survival: {
                ...tribute.survival,
                roundsWithoutWater: -1,
              },
            }
          : tribute,
      ),
    };

    expect(() => loadGameState(invalidGame)).toThrow(/rounds without water.*non-negative integer/i);
  });
});
