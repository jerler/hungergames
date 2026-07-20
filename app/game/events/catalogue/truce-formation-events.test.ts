import { describe, expect, it } from "vitest";

import { EVENT_CATALOGUE } from "~/game/events/catalogue/index";
import { TRUCE_FORMATION_EVENTS } from "~/game/events/catalogue/truce-formation-events";
import type { EventDefinition } from "~/game/events/event-schema";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { TRUCE_GROUP_SIZE_WEIGHTS } from "~/game/truces/truce-selection";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState } from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const NIGHT_ONE = {
  day: 1,
  period: "night",
} as const;

function createGame(): GameState {
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
        return `id-${nextId}`;
      },

      seed: "formation-event-tests",

      now: "2026-07-20T12:00:00.000Z",
    },
  );
}

function requireEvent(eventId: string): EventDefinition {
  const definition = TRUCE_FORMATION_EVENTS.find((candidate) => candidate.id === eventId);

  if (!definition) {
    throw new Error(`Missing truce event "${eventId}".`);
  }

  return definition;
}

describe("truce formation events", () => {
  it("includes every formation event in the main catalogue", () => {
    expect(
      TRUCE_FORMATION_EVENTS.every((event) =>
        EVENT_CATALOGUE.some((candidate) => candidate.id === event.id),
      ),
    ).toBe(true);
  });

  it.each(TRUCE_GROUP_SIZE_WEIGHTS)(
    "creates size-$size variants with the intended weight",
    ({ size, weight }) => {
      for (const theme of ["share-shelter", "split-supplies"] as const) {
        const event = requireEvent(`${theme}-truce-${size}`);

        expect(event.roles[0].count).toBe(size);

        expect(event.baseWeight).toBeCloseTo(7 * (weight / 100));
      }
    },
  );

  it.each(TRUCE_GROUP_SIZE_WEIGHTS)("forms a real size-$size shelter truce", ({ size }) => {
    const game = createGame();

    const participants = game.tributes.slice(0, size);

    const event = requireEvent(`share-shelter-truce-${size}`);

    const resolution = event.resolve({
      state: game,
      round: DAY_ONE,

      livingTributes: game.tributes,

      eventId: `shelter-test-${size}`,

      random: () => 0.5,

      participantsByRole: {
        tributes: participants,
      },
    });

    const formedTruces = resolution.changes.flatMap((change) =>
      change.type === "form-truce" ? [change.truce] : [],
    );

    expect(formedTruces).toEqual([
      expect.objectContaining({
        kind: "standard",

        tributeIds: participants.map((tribute) => tribute.id),

        createdRound: DAY_ONE,

        expiresAfterRound: NIGHT_ONE,
      }),
    ]);
  });

  it("distributes supplies across every member", () => {
    const game = createGame();

    const participants = game.tributes.slice(0, 4);

    const event = requireEvent("split-supplies-truce-4");

    const resolution = event.resolve({
      state: game,
      round: NIGHT_ONE,

      livingTributes: game.tributes,

      eventId: "split-supplies-test",

      random: () => 0.5,

      participantsByRole: {
        tributes: participants,
      },
    });

    const acquiredItems = resolution.changes.flatMap((change) =>
      change.type === "acquire-item"
        ? [
            {
              tributeId: change.tributeId,

              definitionId: change.item.definitionId,
            },
          ]
        : [],
    );

    expect(acquiredItems).toEqual([
      {
        tributeId: participants[0].id,
        definitionId: "food",
      },
      {
        tributeId: participants[1].id,
        definitionId: "water",
      },
      {
        tributeId: participants[2].id,
        definitionId: "food",
      },
      {
        tributeId: participants[3].id,
        definitionId: "water",
      },
    ]);
  });

  it("does not form a group when too few unaligned tributes remain", () => {
    const game = createGame();

    const existingTruce = {
      id: "existing-truce",
      kind: "standard",
      tributeIds: game.tributes.slice(0, 4).map((tribute) => tribute.id),

      createdRound: DAY_ONE,

      expiresAfterRound: NIGHT_ONE,
    } as const;

    const state = {
      ...game,

      truces: [existingTruce],
    };

    const event = requireEvent("share-shelter-truce-6");

    expect(
      event.isEligible?.({
        state,
        round: DAY_ONE,

        livingTributes: game.tributes,
      }),
    ).toBe(true);

    const mostlyAlignedState = {
      ...game,

      truces: [
        {
          ...existingTruce,

          tributeIds: game.tributes.slice(0, 7).map((tribute) => tribute.id),
        },
      ],
    };

    expect(
      event.isEligible?.({
        state: mostlyAlignedState,

        round: DAY_ONE,

        livingTributes: game.tributes,
      }),
    ).toBe(false);
  });
});
