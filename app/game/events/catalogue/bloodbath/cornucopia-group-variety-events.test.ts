import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { createSeededRandom } from "~/game/engine/random";
import type { EventDefinition, EventResolution } from "~/game/events/event-schema";
import { validateEventDefinition } from "~/game/events/validation/validate-event-definition";
import { validateEventResolution } from "~/game/events/validation/validate-event-resolution";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";

import {
  ADDITIONAL_CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
  ADDITIONAL_CORNUCOPIA_NONFATAL_TRIO_EVENTS,
} from "./cornucopia-group-variety-events";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const TRUCE_EVENT_IDS = new Set([
  "cornucopia-nonfatal-trio-crate-battering-ram",
  "cornucopia-nonfatal-trio-canned-peaches-ceasefire",
  "cornucopia-nonfatal-quartet-moving-barricade",
  "cornucopia-nonfatal-quartet-alliance-name",
]);

function createTestGame(): GameState {
  let nextId = 0;

  const game = createInitialGameState(
    {
      ...createDefaultGameConfig(),
      districtCount: 12,
    },
    createRandomTributeDrafts(12, DEFAULT_TRIBUTES, createSeededRandom("group-variety:reaping")),
    "random",
    {
      createId: () => {
        nextId += 1;
        return `group-variety-id-${nextId}`;
      },
      seed: "group-variety",
      now: "2026-07-29T12:00:00.000Z",
    },
  );

  return {
    ...game,
    tributes: game.tributes.map((tribute): GameTribute => ({
      ...tribute,
      snapshot: {
        ...tribute.snapshot,
        stats: {
          brains: 5,
          brawn: 5,
          luck: 5,
        },
      },
    })),
  };
}

function resolveDefinition(
  state: GameState,
  definition: EventDefinition,
  participants: readonly GameTribute[],
): EventResolution {
  const eventId = `test:${definition.id}`;
  const resolution = definition.resolve({
    state,
    round: DAY_ONE,
    livingTributes: state.tributes,
    eventId,
    random: createSeededRandom(eventId),
    participantsByRole: {
      tributes: [...participants],
    },
    unavailableItemInstanceIds: new Set<string>(),
  });

  validateEventResolution({
    eventId,
    definitionId: definition.id,
    round: DAY_ONE,
    resolution,
  });

  return resolution;
}

describe("additional Cornucopia group variety", () => {
  it("adds six unique trios and six unique quartets", () => {
    expect(ADDITIONAL_CORNUCOPIA_NONFATAL_TRIO_EVENTS).toHaveLength(6);
    expect(ADDITIONAL_CORNUCOPIA_NONFATAL_QUARTET_EVENTS).toHaveLength(6);

    const definitions = [
      ...ADDITIONAL_CORNUCOPIA_NONFATAL_TRIO_EVENTS,
      ...ADDITIONAL_CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
    ];

    expect(new Set(definitions.map((definition) => definition.id)).size).toBe(definitions.length);

    for (const definition of definitions) {
      expect(() => validateEventDefinition(definition)).not.toThrow();
      expect(definition.category).not.toBe("fatal");
      expect(definition.periods).toEqual(["day"]);
    }
  });

  it("gives every participant an acquisition and survival credit", () => {
    const state = createTestGame();

    const families = [
      {
        definitions: ADDITIONAL_CORNUCOPIA_NONFATAL_TRIO_EVENTS,
        participantCount: 3,
      },
      {
        definitions: ADDITIONAL_CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
        participantCount: 4,
      },
    ] as const;

    for (const family of families) {
      const participants = state.tributes.slice(0, family.participantCount);
      const participantIds = new Set(participants.map((tribute) => tribute.id));

      for (const definition of family.definitions) {
        const resolution = resolveDefinition(state, definition, participants);

        expect(resolution.text.trim().length).toBeGreaterThan(0);
        expect(resolution.changes.some((change) => change.type === "eliminate-tribute")).toBe(
          false,
        );

        const acquisitionIds = new Set(
          resolution.changes.flatMap((change) =>
            change.type === "acquire-item" ? [change.tributeId] : [],
          ),
        );
        const survivalIds = new Set(
          resolution.changes.flatMap((change) =>
            change.type === "increment-statistic" && change.statistic === "eventsSurvived"
              ? [change.tributeId]
              : [],
          ),
        );

        expect(acquisitionIds).toEqual(participantIds);
        expect(survivalIds).toEqual(participantIds);
      }
    }
  });

  it("forms temporary truces only for the cooperative group scenes", () => {
    const state = createTestGame();
    const definitions = [
      ...ADDITIONAL_CORNUCOPIA_NONFATAL_TRIO_EVENTS,
      ...ADDITIONAL_CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
    ];

    for (const definition of definitions) {
      const participantCount = definition.roles[0]?.count ?? 0;
      const participants = state.tributes.slice(0, participantCount);
      const resolution = resolveDefinition(state, definition, participants);
      const truceChanges = resolution.changes.filter((change) => change.type === "form-truce");

      expect(truceChanges).toHaveLength(TRUCE_EVENT_IDS.has(definition.id) ? 1 : 0);

      if (truceChanges.length === 1) {
        const [truceChange] = truceChanges;

        if (!truceChange || truceChange.type !== "form-truce") {
          throw new Error("Expected a truce change.");
        }

        expect(new Set(truceChange.truce.tributeIds)).toEqual(
          new Set(participants.map((tribute) => tribute.id)),
        );
      }
    }
  });
});
