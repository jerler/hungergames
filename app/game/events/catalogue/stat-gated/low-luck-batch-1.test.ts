import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  STAT_GATED_BLOODBATH_EVENTS,
  STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES,
  STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
  STAT_GATED_FLEE_EVENTS,
} from "~/game/events/catalogue/bloodbath/stat-gated-events";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";
import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const satisfies RoundReference;

function withLuck(tribute: GameTribute, luck: 1 | 2 | 3 | 4 | 5): GameTribute {
  return {
    ...tribute,
    snapshot: {
      ...tribute.snapshot,
      stats: {
        ...tribute.snapshot.stats,
        luck,
      },
    },
  };
}

function requireEvent(definitions: readonly EventDefinition[], id: string): EventDefinition {
  const definition = definitions.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing Low-Luck Batch 1 event "${id}".`);
  }

  return definition;
}

function context(
  definition: EventDefinition,
  state: GameState,
  participantsByRole: EventResolutionContext["participantsByRole"],
  randomValue = 0.25,
): EventResolutionContext {
  return {
    eventId: `test:${definition.id}`,
    state: {
      ...state,
      currentRound: DAY_ONE,
    },
    round: DAY_ONE,
    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    participantsByRole,
    random: () => randomValue,
    unavailableItemInstanceIds: new Set<string>(),
  };
}

describe("Low-Luck Batch 1 opening expansion", () => {
  const openingIds = new Set([
    "cornucopia-low-luck-grab-and-go",
    "cornucopia-low-luck-loose-strap",
    "cornucopia-low-luck-butterfingers",
    "cornucopia-low-luck-perfectly-timed-sneeze",
    "bloodbath-flee-low-luck-almost-impressive",
    "bloodbath-flee-low-luck-lace-to-meet-you",
    "bloodbath-flee-low-luck-branch-manager",
    "bloodbath-flee-low-luck-dramatic-getaway",
  ]);

  it("registers all eight opening concepts exactly once", () => {
    expect(
      STAT_GATED_BLOODBATH_EVENTS.filter((definition) => openingIds.has(definition.id)),
    ).toHaveLength(8);
    expect(STAT_GATED_BLOODBATH_EVENTS).toHaveLength(46);
    expect(STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS).toHaveLength(16);
    expect(STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES).toHaveLength(14);
    expect(STAT_GATED_FLEE_EVENTS).toHaveLength(12);
  });

  it("keeps the opening catalogue meaningfully visible after balance tuning", () => {
    const weights = new Map(
      STAT_GATED_BLOODBATH_EVENTS.filter((definition) => openingIds.has(definition.id)).map(
        (definition) => [definition.id, definition.baseWeight],
      ),
    );

    expect(weights.get("cornucopia-low-luck-grab-and-go")).toBeGreaterThanOrEqual(1);
    expect(weights.get("cornucopia-low-luck-loose-strap")).toBeGreaterThanOrEqual(0.5);
    expect(weights.get("cornucopia-low-luck-butterfingers")).toBeGreaterThanOrEqual(0.5);
    expect(weights.get("cornucopia-low-luck-perfectly-timed-sneeze")).toBeGreaterThanOrEqual(0.5);
    expect(weights.get("bloodbath-flee-low-luck-almost-impressive")).toBeGreaterThanOrEqual(0.8);
    expect(weights.get("bloodbath-flee-low-luck-lace-to-meet-you")).toBeGreaterThanOrEqual(0.8);
    expect(weights.get("bloodbath-flee-low-luck-branch-manager")).toBeGreaterThanOrEqual(0.05);
    expect(weights.get("bloodbath-flee-low-luck-dramatic-getaway")).toBeGreaterThanOrEqual(0.05);
  });

  it("limits every actor role to luck one or two", () => {
    const low = withLuck(createAuthoringTestTribute({ id: "low" }), 2);
    const average = withLuck(createAuthoringTestTribute({ id: "average" }), 3);
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([low, average, target]);
    const roleContext = {
      state,
      round: DAY_ONE,
      livingTributes: state.tributes,
      participantsByRole: {},
    };

    for (const definition of STAT_GATED_BLOODBATH_EVENTS.filter((candidate) =>
      openingIds.has(candidate.id),
    )) {
      const actorRole = definition.roles.find(
        (role) => role.id === "actor" || role.id === "tribute",
      );

      expect(actorRole?.isEligible, definition.id).toBeDefined();
      expect(actorRole?.isEligible?.(low, roleContext), definition.id).toBe(true);
      expect(actorRole?.isEligible?.(average, roleContext), definition.id).toBe(false);
    }
  });

  it("leaves Grab and Go with no authored item beyond sequencer provisions", () => {
    const actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 1);
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(
      STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
      "cornucopia-low-luck-grab-and-go",
    );
    const resolution = definition.resolve(
      context(definition, state, {
        tribute: [actor],
      }),
    );

    expect(resolution.changes.some((change) => change.type === "acquire-item")).toBe(false);
  });

  it("credits the target in Loose Strap and Perfectly Timed Sneeze", () => {
    const actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 1);
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([actor, target]);

    for (const id of [
      "cornucopia-low-luck-loose-strap",
      "cornucopia-low-luck-perfectly-timed-sneeze",
    ]) {
      const definition = requireEvent(
        STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES.map(({ definition: candidate }) => candidate),
        id,
      );
      const resolution = definition.resolve(
        context(definition, state, {
          actor: [actor],
          target: [target],
        }),
      );

      expect(resolution.changes).toContainEqual(
        expect.objectContaining({
          type: "eliminate-tribute",
          tributeId: actor.id,
          killerTributeIds: [target.id],
        }),
      );
    }
  });

  it("awards Butterfingers' weapon to the surviving target", () => {
    const actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 1);
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent(
      STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES.map(({ definition: candidate }) => candidate),
      "cornucopia-low-luck-butterfingers",
    );
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        0.25,
      ),
    );

    expect(definition.cornucopiaAcquisitionPolicy).toEqual({
      preserveAuthoredItems: true,
    });
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: actor.id,
        killerTributeIds: [target.id],
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "acquire-item",
        tributeId: target.id,
        acquisitionSource: "cornucopia",
      }),
    );
  });

  it("provides four variants for each solo fleeing mishap", () => {
    const actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 2);
    const state = createAuthoringTestGame([actor]);

    for (const id of [
      "bloodbath-flee-low-luck-almost-impressive",
      "bloodbath-flee-low-luck-lace-to-meet-you",
    ]) {
      const definition = requireEvent(STAT_GATED_FLEE_EVENTS, id);
      const resolutions = [0, 0.26, 0.51, 0.76].map((randomValue) =>
        definition.resolve(
          context(
            definition,
            state,
            {
              actor: [actor],
            },
            randomValue,
          ),
        ),
      );

      expect(new Set(resolutions.map((resolution) => resolution.text)).size, id).toBe(4);

      for (const resolution of resolutions) {
        expect(resolution.changes).toContainEqual(
          expect.objectContaining({
            type: "apply-status",
            tributeId: actor.id,
            status: expect.objectContaining({
              definitionId: "injured",
            }),
          }),
        );
      }
    }
  });

  it("credits both fleeing pursuers for their deterministic kills", () => {
    const actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 1);
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([actor, target]);

    for (const id of [
      "bloodbath-flee-low-luck-branch-manager",
      "bloodbath-flee-low-luck-dramatic-getaway",
    ]) {
      const definition = requireEvent(STAT_GATED_FLEE_EVENTS, id);
      const resolution = definition.resolve(
        context(definition, state, {
          actor: [actor],
          target: [target],
        }),
      );

      expect(resolution.changes).toContainEqual(
        expect.objectContaining({
          type: "eliminate-tribute",
          tributeId: actor.id,
          killerTributeIds: [target.id],
        }),
      );
    }
  });
});
