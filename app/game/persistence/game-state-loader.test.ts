import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import { CURRENT_GAME_STATE_SCHEMA_VERSION, type ResolvedEvent } from "~/game/types/game-state";

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

  it("removes legacy preparation events while preserving reveal progress", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    if (!tribute) {
      throw new Error("Loader migration test requires a tribute.");
    }

    const round = {
      day: 2,
      period: "day",
    } as const;

    const automaticEvent: ResolvedEvent = {
      id: "legacy-morning-rest",
      definitionId: "automatic-morning-rest-resolution",
      kind: "preparation",
      resolutionMode: "standard",
      round,
      participantTributeIds: [tribute.id],
      text: `${tribute.snapshot.name} wakes after a sheltered night.`,
      changes: [],
      preparation: {
        mechanic: "morning-rest-resolution",
        actingTributeId: tribute.id,
        restQuality: "sheltered",
        affectedStatusIds: [],
      },
    };

    const firstPrimaryEvent: ResolvedEvent = {
      id: "legacy-primary-one",
      definitionId: "legacy-primary-one",
      kind: "primary",
      resolutionMode: "standard",
      round,
      participantTributeIds: [tribute.id],
      text: `${tribute.snapshot.name} watches the arena.`,
      changes: [],
    };

    const secondPrimaryEvent: ResolvedEvent = {
      id: "legacy-primary-two",
      definitionId: "legacy-primary-two",
      kind: "primary",
      resolutionMode: "standard",
      round,
      participantTributeIds: [tribute.id],
      text: `${tribute.snapshot.name} moves on.`,
      changes: [],
    };

    const legacyGame = {
      ...game,
      phase: "round-events" as const,
      currentRound: round,
      roundEvents: [automaticEvent, firstPrimaryEvent, secondPrimaryEvent],
      revealedEventCount: 2,
      eventHistory: [automaticEvent, firstPrimaryEvent],
    };

    const loadedGame = loadGameState(legacyGame);

    expect(loadedGame.roundEvents).toEqual([firstPrimaryEvent, secondPrimaryEvent]);
    expect(loadedGame.revealedEventCount).toBe(1);
    expect(loadedGame.eventHistory).toEqual([automaticEvent, firstPrimaryEvent]);
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

  it("strips deprecated Phase 1 survival counters", () => {
    const game = createGame();

    const bridgeGame = {
      ...game,
      tributes: game.tributes.map((tribute) => ({
        ...tribute,
        survival: {
          ...tribute.survival,
          roundsWithoutFood: 3,
          roundsWithoutWater: 2,
        },
      })),
    };

    const loaded = loadGameState(bridgeGame);
    const survival = loaded.tributes[0]?.survival as unknown as Record<string, unknown>;

    expect(survival).not.toHaveProperty("roundsWithoutFood");
    expect(survival).not.toHaveProperty("roundsWithoutWater");
    expect(survival).toMatchObject({
      lastFoundFoodRound: null,
      lastFoundWaterRound: null,
      lastNightRest: null,
    });
  });

  it("rejects current-schema state missing food history", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    if (!tribute) {
      throw new Error("Loader history test requires a tribute.");
    }

    const survival = {
      ...tribute.survival,
    } as Record<string, unknown>;

    delete survival.lastFoundFoodRound;

    const invalidGame = {
      ...game,
      tributes: game.tributes.map((candidate, index) =>
        index === 0
          ? {
              ...candidate,
              survival,
            }
          : candidate,
      ),
    };

    expect(() => loadGameState(invalidGame)).toThrow(
      /last-found food round must be null or a round reference/i,
    );
  });

  it("rejects survival history recorded before the arena starts", () => {
    const game = createGame();

    const invalidGame = {
      ...game,
      tributes: game.tributes.map((tribute, index) =>
        index === 0
          ? {
              ...tribute,
              survival: {
                ...tribute.survival,
                lastFoundWaterRound: {
                  day: 1,
                  period: "day" as const,
                },
              },
            }
          : tribute,
      ),
    };

    expect(() => loadGameState(invalidGame)).toThrow(
      /records last-found water before the arena has started/i,
    );
  });

  it("rejects schema-4 saves from before the named natural-food migration", () => {
    const schemaFourGame = {
      ...createGame(),

      schemaVersion: 4,
    };

    expect(() => loadGameState(schemaFourGame)).toThrow(UnsupportedGameStateSchemaError);

    expect(() => loadGameState(schemaFourGame)).toThrow(/schema version 4/i);
  });

  it("rejects schema-5 saves from before the Phase 9 utility migration", () => {
    const schemaFiveGame = {
      ...createGame(),

      schemaVersion: 5,
    };

    expect(() => loadGameState(schemaFiveGame)).toThrow(UnsupportedGameStateSchemaError);

    expect(() => loadGameState(schemaFiveGame)).toThrow(/schema version 5/i);
  });

  it("rejects schema-6 saves from before attributed fatal statuses", () => {
    const schemaSixGame = {
      ...createGame(),

      schemaVersion: 6,
    };

    expect(() => loadGameState(schemaSixGame)).toThrow(UnsupportedGameStateSchemaError);

    expect(() => loadGameState(schemaSixGame)).toThrow(/schema version 6/i);
  });

  it("rejects schema-7 saves from before round-based survival history", () => {
    const schemaSevenGame = {
      ...createGame(),

      schemaVersion: 7,
    };

    expect(() => loadGameState(schemaSevenGame)).toThrow(UnsupportedGameStateSchemaError);

    expect(() => loadGameState(schemaSevenGame)).toThrow(/schema version 7/i);
  });

  it("strips legacy food and water inventory", () => {
    const game = createGame();
    const tribute = game.tributes[0];

    if (!tribute) {
      throw new Error("Expected a tribute fixture.");
    }

    const legacyItem = {
      id: "legacy-water-item",
      definitionId: "water",
      usesRemaining: 1,
      sourceEventId: "legacy-water-event",
      acquiredRound: {
        day: 1,
        period: "day",
      },
    };

    const legacyGame = {
      ...game,
      tributes: game.tributes.map((candidate, index) =>
        index === 0
          ? {
              ...candidate,
              inventory: [legacyItem],
            }
          : candidate,
      ),
      itemTransactions: [
        {
          id: "legacy-water-transaction",
          type: "acquired",
          tributeId: tribute.id,
          itemInstanceId: legacyItem.id,
          definitionId: "water",
          uses: 1,
          round: legacyItem.acquiredRound,
          sourceId: legacyItem.sourceEventId,
          acquisitionSource: "natural-foraging",
        },
      ],
    };

    const loaded = loadGameState(legacyGame);

    expect(loaded.tributes[0]?.inventory).toEqual([]);
    expect(loaded.itemTransactions).toEqual([]);
  });
});
