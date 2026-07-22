import {
  describe,
  expect,
  it,
} from "vitest";

import { applyResolvedEvent } from
  "~/game/engine/apply-game-change";
import { createInitialGameState } from
  "~/game/engine/create-initial-game-state";
import { createSeededRandom } from
  "~/game/engine/random";
import {
  BLOODBATH_EVENT_CATALOGUE,
  CORNUCOPIA_ACQUISITION_EVENTS,
  CORNUCOPIA_CONFLICT_EVENTS,
  CORNUCOPIA_EVENTS,
  FLEE_EVENTS,
} from "~/game/events/catalogue/bloodbath";
import type {
  EventDefinition,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { EVENT_CATALOGUE } from
  "~/game/events/catalogue";
import { getItemDefinition } from
  "~/game/items/item-catalogue";
import { createInventoryItemInstance } from
  "~/game/items/inventory-engine";
import { DEFAULT_TRIBUTES } from
  "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from
  "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from
  "~/game/types/game-config";
import type {
  GameChange,
  GameState,
  GameTribute,
  ResolvedEvent,
} from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

function createParticipantsByRole(
  definition: EventDefinition,
  firstTribute: GameTribute,
  secondTribute: GameTribute,
): ParticipantsByRole {
  if (
    definition.roles.some(
      (role) => role.id === "attacker",
    )
  ) {
    return {
      attacker: [firstTribute],
      defender: [secondTribute],
    };
  }

  return {
    tribute: [firstTribute],
  };
}

function createTestGame(
  seed = "bloodbath-event-tests",
): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,

    createRandomTributeDrafts(
      6,
      DEFAULT_TRIBUTES,
      createSeededRandom(
        `${seed}:reaping`,
      ),
    ),

    "random",

    {
      createId: () => {
        nextId += 1;
        return `${seed}-id-${nextId}`;
      },

      seed,
      now: "2026-07-21T12:00:00.000Z",
    },
  );
}

function resolveDefinition(
  definition: EventDefinition,
  game: GameState,
  participantsByRole: ParticipantsByRole,
  randomValue: number,
) {
  return definition.resolve({
    state: game,
    round: DAY_ONE,
    livingTributes:
      game.tributes.filter(
        (tribute) => tribute.isAlive,
      ),

    eventId: `test-${definition.id}`,
    random: () => randomValue,
    participantsByRole,
  });
}

function getStatuses(
  changes: readonly GameChange[],
) {
  return changes.flatMap((change) =>
    change.type === "apply-status"
      ? [change.status]
      : [],
  );
}

function getAcquisitions(
  changes: readonly GameChange[],
) {
  return changes.filter(
    (change) =>
      change.type === "acquire-item",
  );
}

function getEliminations(
  changes: readonly GameChange[],
) {
  return changes.filter(
    (change) =>
      change.type ===
      "eliminate-tribute",
  );
}

function findResolution(
  definition: EventDefinition,
  game: GameState,
  participantsByRole: ParticipantsByRole,
  predicate: (
    changes: readonly GameChange[],
  ) => boolean,
) {
  for (
    let index = 0;
    index < 1_000;
    index += 1
  ) {
    const resolution = resolveDefinition(
      definition,
      game,
      participantsByRole,
      (index + 0.5) / 1_000,
    );

    if (predicate(resolution.changes)) {
      return resolution;
    }
  }

  throw new Error(
    `Could not reach the required outcome for "${definition.id}".`,
  );
}

function sampleSignatures(
  definition: EventDefinition,
  game: GameState,
  participantsByRole: ParticipantsByRole,
  getSignature: (
    changes: readonly GameChange[],
  ) => string,
): Set<string> {
  const signatures = new Set<string>();

  for (
    let index = 0;
    index < 1_000;
    index += 1
  ) {
    const resolution =
      resolveDefinition(
        definition,
        game,
        participantsByRole,
        (index + 0.5) / 1_000,
      );

    signatures.add(
      getSignature(
        resolution.changes,
      ),
    );
  }

  return signatures;
}

describe("Bloodbath event catalogue", () => {
  it("contains every Bloodbath event exactly once", () => {
    const expectedIds = [
      ...CORNUCOPIA_EVENTS,
      ...FLEE_EVENTS,
    ].map((event) => event.id);

    const catalogueIds =
      BLOODBATH_EVENT_CATALOGUE.map(
        (event) => event.id,
      );

    expect(catalogueIds).toEqual(
      expectedIds,
    );

    expect(
      new Set(catalogueIds).size,
    ).toBe(catalogueIds.length);
  });

  it("keeps Bloodbath events outside the ordinary catalogue", () => {
    const ordinaryIds = new Set(
      EVENT_CATALOGUE.map(
        (event) => event.id,
      ),
    );

    for (
      const event of
      BLOODBATH_EVENT_CATALOGUE
    ) {
      expect(
        ordinaryIds.has(event.id),
      ).toBe(false);
    }
  });

  it("uses Cornucopia provenance for every Cornucopia acquisition", () => {
    const game = createTestGame();
    const [firstTribute, secondTribute] =
      game.tributes;

    for (
      const definition of [
        ...CORNUCOPIA_ACQUISITION_EVENTS,
        ...CORNUCOPIA_CONFLICT_EVENTS,
      ]
    ) {
      const participantsByRole =
        createParticipantsByRole(
          definition,
          firstTribute,
          secondTribute,
        );

      for (
        let index = 0;
        index < 100;
        index += 1
      ) {
        const resolution =
          resolveDefinition(
            definition,
            game,
            participantsByRole,
            (index + 0.5) / 100,
          );

        for (
          const change of
          getAcquisitions(
            resolution.changes,
          )
        ) {
          expect(
            change.acquisitionSource,
          ).toBe("cornucopia");
        }
      }
    }
  });

  it("never awards manufactured items through flee events", () => {
    const game = createTestGame();
    const tribute = game.tributes[0];

    for (const definition of FLEE_EVENTS) {
      for (
        let index = 0;
        index < 100;
        index += 1
      ) {
        const resolution =
          resolveDefinition(
            definition,
            game,
            {
              tribute: [tribute],
            },
            (index + 0.5) / 100,
          );

        for (
          const change of
          getAcquisitions(
            resolution.changes,
          )
        ) {
          expect(
            getItemDefinition(
              change.item.definitionId,
            ).origin,
          ).toBe("natural-resource");

          expect(
            change.acquisitionSource,
          ).toBe("natural-foraging");
        }
      }
    }
  });

  it("resolves every definition deterministically", () => {
    const game = createTestGame();
    const [firstTribute, secondTribute] =
      game.tributes;

    for (
      const definition of
      BLOODBATH_EVENT_CATALOGUE
    ) {
      const participantsByRole =
        createParticipantsByRole(
          definition,
          firstTribute,
          secondTribute,
        );

      expect(
        resolveDefinition(
          definition,
          game,
          participantsByRole,
          0.73,
        ),
      ).toEqual(
        resolveDefinition(
          definition,
          game,
          participantsByRole,
          0.73,
        ),
      );
    }
  });
});

describe("Bloodbath outcome coverage", () => {
  it("reaches every acquisition-event outcome", () => {
    const game = createTestGame();
    const tribute = game.tributes[0];

    for (
      const definition of
      CORNUCOPIA_ACQUISITION_EVENTS
    ) {
      const signatures =
        sampleSignatures(
          definition,
          game,
          {
            tribute: [tribute],
          },
          (changes) => {
            const statuses =
              getStatuses(changes);

            const acquisitions =
              getAcquisitions(changes);

            if (
              statuses.some(
                (status) =>
                  status.definitionId ===
                  "injured",
              )
            ) {
              return "critical-failure";
            }

            if (
              statuses.some(
                (status) =>
                  status.definitionId ===
                  "exhausted",
              )
            ) {
              return "failure";
            }

            if (
              acquisitions.length === 2 ||
              statuses.some(
                (status) =>
                  status.definitionId ===
                  "inspired",
              )
            ) {
              return "exceptional-success";
            }

            if (
              acquisitions.length === 1
            ) {
              return "success";
            }

            return "unknown";
          },
        );

      expect(signatures).toEqual(
        new Set([
          "critical-failure",
          "failure",
          "success",
          "exceptional-success",
        ]),
      );
    }
  });

  it("reaches every conflict-event outcome", () => {
    const game = createTestGame();
    const [attacker, defender] =
      game.tributes;

    for (
      const definition of
      CORNUCOPIA_CONFLICT_EVENTS
    ) {
      const signatures =
        sampleSignatures(
          definition,
          game,
          {
            attacker: [attacker],
            defender: [defender],
          },
          (changes) => {
            const elimination =
              getEliminations(
                changes,
              )[0];

            if (
              elimination?.tributeId ===
              attacker.id
            ) {
              return "critical-failure";
            }

            if (
              elimination?.tributeId ===
              defender.id
            ) {
              return "exceptional-success";
            }

            if (
              getAcquisitions(
                changes,
              ).length === 1
            ) {
              return "success";
            }

            return "failure";
          },
        );

      expect(signatures).toEqual(
        new Set([
          "critical-failure",
          "failure",
          "success",
          "exceptional-success",
        ]),
      );
    }
  });
});

describe("Bloodbath conflict inventory", () => {
  it("credits the killer and transfers victim inventory once", () => {
    const originalGame = createTestGame(
      "conflict-death-loot",
    );

    const originalAttacker =
      originalGame.tributes[0];

    const originalDefender =
      originalGame.tributes[1];

    const eventId =
      "test-conflict-death-loot";

    const item =
      createInventoryItemInstance(
        "conflict-fixture",
        originalDefender.id,
        "rope",
        DAY_ONE,
      );

    const game: GameState = {
      ...originalGame,

      tributes: originalGame.tributes.map(
        (tribute) =>
          tribute.id === originalDefender.id
            ? {
                ...tribute,
                inventory: [item],
              }
            : tribute,
      ),
    };

    /*
    * Read both participants back from the final game fixture.
    * This ensures resolution and application use the exact
    * tribute objects contained in `game`.
    */
    const attacker = game.tributes.find(
      (tribute) =>
        tribute.id === originalAttacker.id,
    );

    const defender = game.tributes.find(
      (tribute) =>
        tribute.id === originalDefender.id,
    );

    if (!attacker || !defender) {
      throw new Error(
        "Missing conflict test participants.",
      );
    }

    const definition =
      CORNUCOPIA_CONFLICT_EVENTS.find(
        (event) =>
          event.id ===
          "cornucopia-contested-weapon",
      );

    if (!definition) {
      throw new Error(
        "Missing contested weapon event.",
      );
    }

    const resolution = definition.resolve({
      state: game,
      round: DAY_ONE,

      livingTributes:
        game.tributes.filter(
          (tribute) => tribute.isAlive,
        ),

      eventId,

      /*
      * Exceptional success is the final weighted outcome.
      * A value immediately below 1 therefore selects that
      * branch regardless of the participants' relative stats.
      */
      random: () => 1 - Number.EPSILON,

      participantsByRole: {
        attacker: [attacker],
        defender: [defender],
      },
    });

    /*
    * Verify the event produced the outcome this test requires
    * before testing application and death-loot behavior.
    */
    const eliminationChange =
      resolution.changes.find(
        (change) =>
          change.type ===
            "eliminate-tribute" &&
          change.tributeId === defender.id,
      );

    expect(eliminationChange).toEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: defender.id,
        killerTributeIds: [attacker.id],
      }),
    );

    const event: ResolvedEvent = {
      id: eventId,
      definitionId: definition.id,
      resolutionMode: "standard",
      round: DAY_ONE,

      participantTributeIds: [
        attacker.id,
        defender.id,
      ],

      text: resolution.text,
      changes: resolution.changes,
    };

    const nextState =
      applyResolvedEvent(
        game,
        event,
      );

    const deadDefender =
      nextState.tributes.find(
        (tribute) =>
          tribute.id === defender.id,
      );

    const survivingAttacker =
      nextState.tributes.find(
        (tribute) =>
          tribute.id === attacker.id,
      );

    if (
      !deadDefender ||
      !survivingAttacker
    ) {
      throw new Error(
        "Conflict participants disappeared after event application.",
      );
    }

    expect(deadDefender.isAlive).toBe(false);

    expect(
      deadDefender.death
        ?.killerTributeIds,
    ).toEqual([attacker.id]);

    expect(
      survivingAttacker.inventory.filter(
        (candidate) =>
          candidate.id === item.id,
      ),
    ).toHaveLength(1);

    expect(
      deadDefender.inventory.some(
        (candidate) =>
          candidate.id === item.id,
      ),
    ).toBe(false);

    expect(
      nextState.itemTransactions.filter(
        (transaction) =>
          transaction.type ===
            "transferred" &&
          transaction.itemInstanceId ===
            item.id,
      ),
    ).toHaveLength(1);

    const deathLootChanges =
      resolution.changes.filter(
        (change) =>
          change.type === "transfer-item" &&
          change.reason === "death-loot",
      );

    expect(deathLootChanges).toEqual([
      {
        type: "transfer-item",
        itemInstanceId: item.id,
        fromTributeId: defender.id,
        toTributeId: attacker.id,
        reason: "death-loot",
      },
    ]);
  });

  it("awards each contested item at most once", () => {
    const game = createTestGame();
    const [attacker, defender] =
      game.tributes;

    for (
      const definition of
      CORNUCOPIA_CONFLICT_EVENTS
    ) {
      for (
        let index = 0;
        index < 100;
        index += 1
      ) {
        const resolution =
          resolveDefinition(
            definition,
            game,
            {
              attacker: [attacker],
              defender: [defender],
            },
            (index + 0.5) / 100,
          );

        const acquisitions =
          getAcquisitions(
            resolution.changes,
          );

        expect(
          acquisitions.length,
        ).toBeLessThanOrEqual(1);

        expect(
          new Set(
            acquisitions.map(
              (change) =>
                change.item.id,
            ),
          ).size,
        ).toBe(acquisitions.length);
      }
    }
  });
});