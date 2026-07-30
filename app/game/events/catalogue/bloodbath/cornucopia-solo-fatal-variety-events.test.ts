import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { createSeededRandom } from "~/game/engine/random";
import { validateEventDefinition } from "~/game/events/validation/validate-event-definition";
import { validateEventResolution } from "~/game/events/validation/validate-event-resolution";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";

import { ADDITIONAL_CORNUCOPIA_SOLO_FATAL_EVENTS } from "./cornucopia-solo-fatal-variety-events";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

function createTestGame(seed = "solo-fatal-variety"): GameState {
  let nextId = 0;

  const game = createInitialGameState(
    {
      ...createDefaultGameConfig(),
      districtCount: 6,
    },
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, createSeededRandom(`${seed}:reaping`)),
    "random",
    {
      createId: () => {
        nextId += 1;

        return `${seed}-${nextId}`;
      },
      seed,
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

describe("additional solo Cornucopia fatalities", () => {
  it("adds seven unique one-person fatal variants", () => {
    expect(ADDITIONAL_CORNUCOPIA_SOLO_FATAL_EVENTS).toHaveLength(7);

    expect(
      new Set(ADDITIONAL_CORNUCOPIA_SOLO_FATAL_EVENTS.map((definition) => definition.id)).size,
    ).toBe(7);

    for (const definition of ADDITIONAL_CORNUCOPIA_SOLO_FATAL_EVENTS) {
      expect(() => validateEventDefinition(definition)).not.toThrow();

      expect(definition.category).toBe("fatal");
      expect(definition.roles).toEqual([
        {
          id: "actor",
          count: 1,
        },
      ]);
    }
  });

  it("makes exactly three seeded variants eligible in every game", () => {
    const observedIds = new Set<string>();

    for (let index = 0; index < 500; index += 1) {
      const state = createTestGame(`solo-slot-${index}`);
      const context = {
        state,
        round: DAY_ONE,
        livingTributes: state.tributes,
      };
      const eligibleDefinitions = ADDITIONAL_CORNUCOPIA_SOLO_FATAL_EVENTS.filter(
        (definition) => definition.isEligible?.(context) ?? true,
      );

      expect(eligibleDefinitions).toHaveLength(3);

      for (const definition of eligibleDefinitions) {
        observedIds.add(definition.id);
      }
    }

    expect(observedIds).toEqual(
      new Set(ADDITIONAL_CORNUCOPIA_SOLO_FATAL_EVENTS.map((definition) => definition.id)),
    );
  });

  it("resolves every variant as exactly one death without inventory", () => {
    const state = createTestGame();
    const actor = state.tributes[0];

    if (!actor) {
      throw new Error("Expected a tribute for solo fatal tests.");
    }

    for (const definition of ADDITIONAL_CORNUCOPIA_SOLO_FATAL_EVENTS) {
      const eventId = `test:${definition.id}`;
      const resolution = definition.resolve({
        state,
        round: DAY_ONE,
        livingTributes: state.tributes,
        eventId,
        random: createSeededRandom(eventId),
        participantsByRole: {
          actor: [actor],
        },
        unavailableItemInstanceIds: new Set<string>(),
      });

      validateEventResolution({
        eventId,
        definitionId: definition.id,
        round: DAY_ONE,
        resolution,
      });

      expect(
        resolution.changes.filter((change) => change.type === "eliminate-tribute"),
      ).toHaveLength(1);

      expect(resolution.changes.some((change) => change.type === "acquire-item")).toBe(false);
    }
  });
});
