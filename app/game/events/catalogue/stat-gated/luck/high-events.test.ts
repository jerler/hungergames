import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { EVENT_CATALOGUE } from "~/game/events/catalogue";
import { resolveAuthoredEvent } from "~/game/events/authoring/testing/resolve-authored-event";
import type { EventDefinition } from "~/game/events/event-schema";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";
import type { TributeStatValue } from "~/game/types/tribute";

import { HIGH_LUCK_EVENTS } from "./high-events";
import type { PronounSetId } from "~/game/tributes/pronouns";

const ROUND = {
  day: 1,
  period: "day",
} as const;

function createTestGame(): GameState {
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

        return `test-id-${nextId}`;
      },

      seed: "high-luck-event-tests",

      now: "2026-07-19T12:00:00.000Z",
    },
  );
}

function withLuck(
  tribute: GameTribute,
  luck: TributeStatValue,
  name: string,
  pronouns: PronounSetId = "they",
): GameTribute {
  return {
    ...tribute,

    snapshot: {
      ...tribute.snapshot,
      name,
      pronouns,

      stats: {
        ...tribute.snapshot.stats,
        luck,
      },
    },
  };
}

function requireHighLuckEvent(eventId: string): EventDefinition {
  const event = HIGH_LUCK_EVENTS.find((candidate) => candidate.id === eventId);

  if (!event) {
    throw new Error(`Missing high-Luck event "${eventId}".`);
  }

  return event;
}

describe("high-Luck events", () => {
  it("includes every high-Luck event in the main catalogue", () => {
    expect(HIGH_LUCK_EVENTS.every((event) => EVENT_CATALOGUE.includes(event))).toBe(true);
  });

  it("preserves the unexpected pep talk definition metadata", () => {
    const event = requireHighLuckEvent("unexpected-pep-talk");

    expect(event).toMatchObject({
      id: "unexpected-pep-talk",

      category: "survival",

      tags: ["survival", "status"],

      periods: ["day", "night"],

      baseWeight: 3.5,

      roles: [
        {
          id: "tribute",

          count: 1,
        },
      ],
    });
  });

  it("only accepts tributes with high Luck", () => {
    const game = createTestGame();

    const luckyTribute = withLuck(game.tributes[0], 5, "Fortuna");

    const averageTribute = withLuck(game.tributes[1], 3, "Average");

    const context = {
      state: game,
      round: ROUND,

      livingTributes: game.tributes.filter((tribute) => tribute.isAlive),

      participantsByRole: {},
    };

    for (const event of HIGH_LUCK_EVENTS) {
      const role = event.roles[0];

      expect(role.isEligible?.(luckyTribute, context)).toBe(true);

      expect(role.isEligible?.(averageTribute, context)).toBe(false);

      expect(role.getWeight?.(luckyTribute, context)).toBe(5);
    }
  });

  it.each([
    {
      randomValue: 0,

      expectedText:
        'Fortuna receives an arena message advising them to "believe in the feet they can become." They are left deeply confused.',

      expectedChangeType: "apply-status",

      expectedStatus: "disoriented",

      expectedSeverity: 1,
    },

    {
      randomValue: 0.1,

      expectedText:
        "Fortuna receives an aggressively generic pep talk that provides no useful information whatsoever.",

      expectedChangeType: "increment-statistic",

      expectedStatus: null,
      expectedSeverity: null,
    },

    {
      randomValue: 0.4,

      expectedText:
        "Fortuna hears a well-timed message of encouragement and feels newly determined.",

      expectedChangeType: "apply-status",

      expectedStatus: "inspired",

      expectedSeverity: 1,
    },

    {
      randomValue: 0.999,

      expectedText: "Fortuna receives exactly the encouragement they needed and feels unstoppable.",

      expectedChangeType: "apply-status",

      expectedStatus: "inspired",

      expectedSeverity: 2,
    },
  ] as const)(
    "preserves the legacy outcome for random value $randomValue",
    ({ randomValue, expectedText, expectedChangeType, expectedStatus, expectedSeverity }) => {
      const game = createTestGame();

      const tribute = withLuck(game.tributes[0], 5, "Fortuna");

      const resolution = resolveAuthoredEvent(
        requireHighLuckEvent("unexpected-pep-talk"),

        game,

        {
          tribute: [tribute],
        },

        [randomValue],

        ROUND,
      );

      expect(resolution.text).toBe(expectedText);

      expect(resolution.changes[0]?.type).toBe(expectedChangeType);

      if (expectedStatus === null) {
        expect(resolution.changes[0]).toEqual({
          type: "increment-statistic",

          tributeId: tribute.id,

          statistic: "eventsSurvived",

          amount: 1,
        });

        return;
      }

      expect(resolution.changes[0]).toEqual(
        expect.objectContaining({
          type: "apply-status",

          tributeId: tribute.id,

          status: expect.objectContaining({
            definitionId: expectedStatus,

            severity: expectedSeverity,
          }),
        }),
      );
    },
  );
});
