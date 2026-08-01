import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { createSeededRandom } from "~/game/engine/random";
import {
  BLOODBATH_EVENT_CATALOGUE,
  CORNUCOPIA_ACQUISITION_EVENTS,
  CORNUCOPIA_CONFLICT_EVENTS,
  CORNUCOPIA_EVENTS,
  CORNUCOPIA_GROUP_CONFLICT_EVENTS,
  CORNUCOPIA_PAIR_CONFLICT_EVENTS,
  FLEE_EVENTS,
} from "~/game/events/catalogue/bloodbath";
import type { EventDefinition, ParticipantsByRole } from "~/game/events/event-schema";
import { EVENT_CATALOGUE } from "~/game/events/catalogue";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameChange, GameState, GameTribute, ResolvedEvent } from "~/game/types/game-state";
import { sampleOutcomeSignatures } from "~/game/events/testing/event-test-helpers";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

function createParticipantsByRole(
  definition: EventDefinition,
  firstTribute: GameTribute,
  secondTribute: GameTribute,
  thirdTribute: GameTribute,
): ParticipantsByRole {
  if (definition.roles.some((role) => role.id === "contenders")) {
    return {
      contenders: [firstTribute, secondTribute, thirdTribute],
    };
  }

  if (definition.roles.some((role) => role.id === "attacker")) {
    return {
      attacker: [firstTribute],
      defender: [secondTribute],
    };
  }

  return {
    tribute: [firstTribute],
  };
}

function createDeterministicParticipantsByRole(
  definition: EventDefinition,
  tributes: readonly GameTribute[],
): ParticipantsByRole {
  const participantsByRole: Record<string, GameTribute[]> = {};
  let nextTributeIndex = 0;

  for (const role of definition.roles) {
    const selectedTributes = tributes
      .slice(nextTributeIndex, nextTributeIndex + role.count)
      .map((tribute): GameTribute => ({
        ...tribute,
        snapshot: {
          ...tribute.snapshot,
          /*
           * This test resolves definitions directly instead of
           * running participant selection. Maximize the fixture
           * stats so item-gated resolvers receive participants
           * satisfying the eligibility contract they normally
           * rely on in production.
           */
          stats: {
            brains: 5,
            brawn: 5,
            luck: 5,
          },
        },
      }));

    if (selectedTributes.length !== role.count) {
      throw new Error(
        `Event "${definition.id}" requires ${role.count} participant(s) for role "${role.id}".`,
      );
    }

    participantsByRole[role.id] = selectedTributes;
    nextTributeIndex += role.count;
  }

  return participantsByRole;
}

function createTestGame(seed = "bloodbath-event-tests"): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,

    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, createSeededRandom(`${seed}:reaping`)),

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
    livingTributes: game.tributes.filter((tribute) => tribute.isAlive),

    eventId: `test-${definition.id}`,
    random: () => randomValue,
    participantsByRole,
  });
}

function getStatuses(changes: readonly GameChange[]) {
  return changes.flatMap((change) => (change.type === "apply-status" ? [change.status] : []));
}

function getAcquisitions(changes: readonly GameChange[]) {
  return changes.filter((change) => change.type === "acquire-item");
}

function getEliminations(changes: readonly GameChange[]) {
  return changes.filter((change) => change.type === "eliminate-tribute");
}

function getFleeOutcomeSignature(changes: readonly GameChange[]): string {
  const statuses = getStatuses(changes);

  const hasStatus = (definitionId: string, severity?: number, remainingRounds?: number | null) =>
    statuses.some(
      (status) =>
        status.definitionId === definitionId &&
        (severity === undefined || status.severity === severity) &&
        (remainingRounds === undefined || status.remainingRounds === remainingRounds),
    );

  /*
   * Check exceptional outcomes first because the stream and
   * foraging branches also include an item acquisition.
   */
  if (hasStatus("hidden") || hasStatus("inspired")) {
    return "exceptional-success";
  }

  /*
   * The woods critical failure also applies exhaustion, so
   * critical conditions must be checked before failures.
   */
  if (hasStatus("injured") || hasStatus("poisoned", 1, 2) || hasStatus("disoriented", 2)) {
    return "critical-failure";
  }

  if (hasStatus("exhausted") || hasStatus("poisoned", 1, 3) || hasStatus("disoriented", 1)) {
    return "failure";
  }

  const acquiredItem = getAcquisitions(changes).length > 0;

  const survivedEvent = changes.some(
    (change) => change.type === "increment-statistic" && change.statistic === "eventsSurvived",
  );

  if (acquiredItem || survivedEvent) {
    return "success";
  }

  return "unknown";
}

function sampleSignatures(
  definition: EventDefinition,
  game: GameState,
  participantsByRole: ParticipantsByRole,
  getSignature: (changes: readonly GameChange[]) => string,
): Set<string> {
  return sampleOutcomeSignatures(
    (randomValue) => resolveDefinition(definition, game, participantsByRole, randomValue),

    (resolution) => getSignature(resolution.changes),
  );
}

function resolveFleeOutcome(
  definition: EventDefinition,
  game: GameState,
  tribute: GameTribute,
  expectedOutcome: string,
) {
  for (let index = 0; index < 1_000; index += 1) {
    const resolution = resolveDefinition(
      definition,
      game,
      {
        actor: [tribute],
      },
      (index + 0.5) / 1_000,
    );

    if (getFleeOutcomeSignature(resolution.changes) === expectedOutcome) {
      return resolution;
    }
  }

  throw new Error(`Could not reach "${expectedOutcome}" ` + `for "${definition.id}".`);
}

describe("Bloodbath event catalogue", () => {
  it("contains every Bloodbath event exactly once", () => {
    const expectedIds = [...CORNUCOPIA_EVENTS, ...FLEE_EVENTS].map((event) => event.id);

    const catalogueIds = BLOODBATH_EVENT_CATALOGUE.map((event) => event.id);

    expect(catalogueIds).toEqual(expectedIds);

    expect(new Set(catalogueIds).size).toBe(catalogueIds.length);
  });

  it.each([
    {
      pronouns: "they",
      reflexive: "themself",
    },
    {
      pronouns: "she",
      reflexive: "herself",
    },
    {
      pronouns: "he",
      reflexive: "himself",
    },
    {
      pronouns: "it",
      reflexive: "itself",
    },
  ] as const)("uses $pronouns pronouns in flee-event text", ({ pronouns, reflexive }) => {
    const game = createTestGame();

    const originalTribute = game.tributes[0];

    const tribute: GameTribute = {
      ...originalTribute,

      snapshot: {
        ...originalTribute.snapshot,

        name: "Harry Potter",
        pronouns,
      },
    };

    const definition = FLEE_EVENTS.find(
      (event) => event.id === "bloodbath-flee-run-from-cornucopia",
    );

    if (!definition) {
      throw new Error("Missing run-from-Cornucopia flee event.");
    }

    const resolution = resolveFleeOutcome(definition, game, tribute, "success");

    expect(resolution.text).toBe(
      "Harry Potter runs directly into the woods and puts " +
        `a safe distance between ${reflexive} and the Cornucopia ` +
        "before finally slowing down to think of a plan.",
    );
  });

  it("keeps Bloodbath events outside the ordinary catalogue", () => {
    const ordinaryIds = new Set(EVENT_CATALOGUE.map((event) => event.id));

    for (const event of BLOODBATH_EVENT_CATALOGUE) {
      expect(ordinaryIds.has(event.id)).toBe(false);
    }
  });

  it("uses Cornucopia provenance for every Cornucopia acquisition", () => {
    const game = createTestGame();
    const [firstTribute, secondTribute, thirdTribute] = game.tributes;

    for (const definition of [...CORNUCOPIA_ACQUISITION_EVENTS, ...CORNUCOPIA_CONFLICT_EVENTS]) {
      const participantsByRole = createParticipantsByRole(
        definition,
        firstTribute,
        secondTribute,
        thirdTribute,
      );

      for (let index = 0; index < 100; index += 1) {
        const resolution = resolveDefinition(
          definition,
          game,
          participantsByRole,
          (index + 0.5) / 100,
        );

        for (const change of getAcquisitions(resolution.changes)) {
          expect(change.acquisitionSource).toBe("cornucopia");
        }
      }
    }
  });

  it("uses only approved acquisition provenance in flee events", () => {
    const game = createTestGame();

    for (const definition of FLEE_EVENTS) {
      const participantsByRole = createDeterministicParticipantsByRole(definition, game.tributes);

      for (let index = 0; index < 100; index += 1) {
        const resolution = resolveDefinition(
          definition,
          game,
          participantsByRole,
          (index + 0.5) / 100,
        );

        for (const change of getAcquisitions(resolution.changes)) {
          const itemDefinition = getItemDefinition(change.item.definitionId);

          if (itemDefinition.origin === "natural-resource") {
            expect(change.acquisitionSource).toBe("natural-foraging");
            continue;
          }

          /*
           * The stampede event may persist the knife that was
           * thrown during the Cornucopia rush. Fleeing tributes
           * still receive neither provisions nor arbitrary
           * manufactured equipment.
           */
          expect(change.item.definitionId).toBe("knife");
          expect(change.acquisitionSource).toBe("cornucopia");
        }

        expect(
          getAcquisitions(resolution.changes).some(
            (change) => change.item.definitionId === "cornucopia-provisions",
          ),
        ).toBe(false);
      }
    }
  });

  it("resolves every definition deterministically", () => {
    const game = createTestGame();

    for (const definition of BLOODBATH_EVENT_CATALOGUE) {
      const participantsByRole = createDeterministicParticipantsByRole(definition, game.tributes);

      expect(resolveDefinition(definition, game, participantsByRole, 0.73)).toEqual(
        resolveDefinition(definition, game, participantsByRole, 0.73),
      );
    }
  });
});

describe("Bloodbath outcome coverage", () => {
  it("reaches every acquisition-event outcome", () => {
    const game = createTestGame();
    const tribute = game.tributes[0];

    for (const definition of CORNUCOPIA_ACQUISITION_EVENTS) {
      const signatures = sampleSignatures(
        definition,
        game,
        {
          tribute: [tribute],
        },
        (changes) => {
          const statuses = getStatuses(changes);

          const acquisitions = getAcquisitions(changes);

          if (
            statuses.some(
              (status) =>
                status.definitionId === "injured" || status.definitionId === "disoriented",
            )
          ) {
            return "critical-failure";
          }

          if (statuses.some((status) => status.definitionId === "exhausted")) {
            return "failure";
          }

          if (
            acquisitions.length === 2 ||
            statuses.some((status) => status.definitionId === "inspired")
          ) {
            return "exceptional-success";
          }

          if (acquisitions.length === 1) {
            return "success";
          }

          return "unknown";
        },
      );

      expect(signatures).toEqual(
        new Set(["critical-failure", "failure", "success", "exceptional-success"]),
      );
    }
  });

  it("reaches every pair-conflict outcome", () => {
    const game = createTestGame();

    const [attacker, defender] = game.tributes;

    for (const definition of CORNUCOPIA_PAIR_CONFLICT_EVENTS) {
      const signatures = sampleSignatures(
        definition,
        game,
        {
          attacker: [attacker],
          defender: [defender],
        },
        (changes) => {
          const elimination = getEliminations(changes)[0];

          if (elimination?.tributeId === attacker.id) {
            return "attacker-dies";
          }

          if (elimination?.tributeId === defender.id) {
            return "defender-dies";
          }

          if (getAcquisitions(changes).length === 1) {
            return "attacker-wins";
          }

          return "both-retreat";
        },
      );

      expect(signatures).toEqual(
        new Set(["attacker-dies", "both-retreat", "attacker-wins", "defender-dies"]),
      );
    }
  });

  it("reaches every group-conflict outcome", () => {
    const game = createTestGame();

    const contenders = game.tributes.slice(0, 3);

    for (const definition of CORNUCOPIA_GROUP_CONFLICT_EVENTS) {
      const signatures = sampleSignatures(
        definition,
        game,
        {
          contenders,
        },
        (changes) => {
          const eliminationCount = getEliminations(changes).length;

          if (eliminationCount === 3) {
            return "mutual-destruction";
          }

          if (eliminationCount === 2) {
            return "sole-survivor";
          }

          if (eliminationCount === 1) {
            return "single-casualty";
          }

          return "all-retreat";
        },
      );

      expect(signatures).toEqual(
        new Set(["mutual-destruction", "sole-survivor", "single-casualty", "all-retreat"]),
      );
    }
  });

  it("preserves legacy flee outcomes and revised multi-participant variation", () => {
    const game = createTestGame();
    const multiParticipantDefinitionIds = new Set(
      FLEE_EVENTS.filter(
        (definition) => definition.roles.reduce((total, role) => total + role.count, 0) > 1,
      ).map((definition) => definition.id),
    );
    const deterministicMultiDefinitionIds = new Set([
      "bloodbath-flee-trio-redirect-pursuit",
      "bloodbath-flee-low-brawn-run-faster",
      "bloodbath-flee-high-brawn-gentle-giant",
      "bloodbath-flee-low-brains-follow-that-tribute",
      "bloodbath-flee-high-brains-not-my-problem",
      "bloodbath-flee-high-brains-mutual-interest",
    ]);

    for (const definition of FLEE_EVENTS) {
      const participantsByRole = createDeterministicParticipantsByRole(definition, game.tributes);
      const outcomeTexts = sampleOutcomeSignatures(
        (randomValue) => resolveDefinition(definition, game, participantsByRole, randomValue),
        (resolution) => resolution.text,
      );

      if (!multiParticipantDefinitionIds.has(definition.id)) {
        expect(outcomeTexts.size, definition.id).toBe(4);
        continue;
      }

      const resolutionSignatures = sampleOutcomeSignatures(
        (randomValue) => resolveDefinition(definition, game, participantsByRole, randomValue),
        (resolution) =>
          JSON.stringify({
            text: resolution.text,
            changes: resolution.changes,
          }),
      );
      const minimumSignatureCount = deterministicMultiDefinitionIds.has(definition.id) ? 1 : 2;

      expect(resolutionSignatures.size, definition.id).toBeGreaterThanOrEqual(
        minimumSignatureCount,
      );
    }
  });

  it("advantages strong tributes without guaranteeing survival", () => {
    const game = createTestGame("combat-advantage");

    const originalStrongTribute = game.tributes[0];

    const originalWeakTribute = game.tributes[1];

    const strongTribute: GameTribute = {
      ...originalStrongTribute,

      snapshot: {
        ...originalStrongTribute.snapshot,

        stats: {
          brains: 5,
          brawn: 5,
          luck: 5,
        },
      },
    };

    const weakTribute: GameTribute = {
      ...originalWeakTribute,

      snapshot: {
        ...originalWeakTribute.snapshot,

        stats: {
          brains: 1,
          brawn: 1,
          luck: 1,
        },
      },
    };

    const definition = CORNUCOPIA_PAIR_CONFLICT_EVENTS[0];

    let strongSurvivalCount = 0;
    let weakSurvivalCount = 0;

    const sampleCount = 2_000;

    for (let index = 0; index < sampleCount; index += 1) {
      const strongIsAttacker = index % 2 === 0;

      const attacker = strongIsAttacker ? strongTribute : weakTribute;

      const defender = strongIsAttacker ? weakTribute : strongTribute;

      const resolution = definition.resolve({
        state: game,
        round: DAY_ONE,
        livingTributes: game.tributes,

        eventId: `combat-advantage-${index}`,

        random: createSeededRandom(`combat-advantage-${index}`),

        participantsByRole: {
          attacker: [attacker],
          defender: [defender],
        },
      });

      const eliminatedIds = new Set(
        getEliminations(resolution.changes).map((change) => change.tributeId),
      );

      if (!eliminatedIds.has(strongTribute.id)) {
        strongSurvivalCount += 1;
      }

      if (!eliminatedIds.has(weakTribute.id)) {
        weakSurvivalCount += 1;
      }
    }

    expect(strongSurvivalCount).toBeGreaterThan(weakSurvivalCount);

    expect(strongSurvivalCount).toBeLessThan(sampleCount);

    expect(weakSurvivalCount).toBeGreaterThan(0);
  });
});

describe("Bloodbath conflict inventory", () => {
  it("credits the killer and transfers victim inventory once", () => {
    const originalGame = createTestGame("conflict-death-loot");

    const originalAttacker = originalGame.tributes[0];

    const originalDefender = originalGame.tributes[1];

    const eventId = "test-conflict-death-loot";

    const item = createInventoryItemInstance(
      "conflict-fixture",
      originalDefender.id,
      "blanket",
      DAY_ONE,
    );

    const game: GameState = {
      ...originalGame,

      tributes: originalGame.tributes.map((tribute) =>
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
    const attacker = game.tributes.find((tribute) => tribute.id === originalAttacker.id);

    const defender = game.tributes.find((tribute) => tribute.id === originalDefender.id);

    if (!attacker || !defender) {
      throw new Error("Missing conflict test participants.");
    }

    const definition = CORNUCOPIA_CONFLICT_EVENTS.find(
      (event) => event.id === "cornucopia-contested-weapon",
    );

    if (!definition) {
      throw new Error("Missing contested weapon event.");
    }

    const resolution = definition.resolve({
      state: game,
      round: DAY_ONE,

      livingTributes: game.tributes.filter((tribute) => tribute.isAlive),

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
    const eliminationChange = resolution.changes.find(
      (change) => change.type === "eliminate-tribute" && change.tributeId === defender.id,
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

      participantTributeIds: [attacker.id, defender.id],
      kind: "primary",
      text: resolution.text,
      changes: resolution.changes,
    };

    const nextState = applyResolvedEvent(game, event);

    const deadDefender = nextState.tributes.find((tribute) => tribute.id === defender.id);

    const survivingAttacker = nextState.tributes.find((tribute) => tribute.id === attacker.id);

    if (!deadDefender || !survivingAttacker) {
      throw new Error("Conflict participants disappeared after event application.");
    }

    expect(deadDefender.isAlive).toBe(false);

    expect(deadDefender.death?.killerTributeIds).toEqual([attacker.id]);

    expect(
      survivingAttacker.inventory.filter((candidate) => candidate.id === item.id),
    ).toHaveLength(1);

    expect(deadDefender.inventory.some((candidate) => candidate.id === item.id)).toBe(false);

    expect(
      nextState.itemTransactions.filter(
        (transaction) =>
          transaction.type === "transferred" && transaction.itemInstanceId === item.id,
      ),
    ).toHaveLength(1);

    const deathLootChanges = resolution.changes.filter(
      (change) => change.type === "transfer-item" && change.reason === "death-loot",
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

    const [firstTribute, secondTribute, thirdTribute] = game.tributes;

    for (const definition of CORNUCOPIA_CONFLICT_EVENTS) {
      const participantsByRole = createParticipantsByRole(
        definition,
        firstTribute,
        secondTribute,
        thirdTribute,
      );

      for (let index = 0; index < 100; index += 1) {
        const resolution = resolveDefinition(
          definition,
          game,
          participantsByRole,
          (index + 0.5) / 100,
        );

        const acquisitions = getAcquisitions(resolution.changes);

        expect(acquisitions.length).toBeLessThanOrEqual(1);

        expect(new Set(acquisitions.map((change) => change.item.id)).size).toBe(
          acquisitions.length,
        );
      }
    }
  });
});
