import { describe, expect, it } from "vitest";

import { EVENT_CATALOGUE } from "~/game/events/catalogue/index";
import { STANDARD_FORMATION_EVENTS } from "./standard-formation-events";
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
  const definition = STANDARD_FORMATION_EVENTS.find((candidate) => candidate.id === eventId);

  if (!definition) {
    throw new Error(`Missing truce event "${eventId}".`);
  }

  return definition;
}

describe("truce formation events", () => {
  it("includes every formation event in the main catalogue", () => {
    expect(
      STANDARD_FORMATION_EVENTS.every((event) =>
        EVENT_CATALOGUE.some((candidate) => candidate.id === event.id),
      ),
    ).toBe(true);
  });

  it.each(TRUCE_GROUP_SIZE_WEIGHTS)(
    "creates size-$size variants with the intended weight",
    ({ size, weight }) => {
      for (const theme of ["travel-together", "keep-watch"] as const) {
        const event = requireEvent(`${theme}-truce-${size}`);

        expect(event.roles[0].count).toBe(size);

        expect(event.baseWeight).toBeCloseTo(7 * (weight / 100));
      }
    },
  );

  it.each(TRUCE_GROUP_SIZE_WEIGHTS)("forms a real size-$size daytime travel truce", ({ size }) => {
    const game = createGame();

    const participants = game.tributes.slice(0, size);

    const event = requireEvent(`travel-together-truce-${size}`);

    const resolution = event.resolve({
      state: game,
      round: DAY_ONE,

      livingTributes: game.tributes,

      eventId: `travel-test-${size}`,

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

        expiresAfterRound: {
          day: 4,
          period: "day",
        },
      }),
    ]);

    expect(resolution.text).not.toMatch(/shelter|sleep|rest/i);
  });

  it("forms a night watch truce and records sheltered rest for every member", () => {
    const game = createGame();

    const participants = game.tributes.slice(0, 4);

    const event = requireEvent("keep-watch-truce-4");

    const resolution = event.resolve({
      state: game,
      round: NIGHT_ONE,

      livingTributes: game.tributes,

      eventId: "keep-watch-test",
      random: () => 0.5,

      participantsByRole: {
        tributes: participants,
      },
    });

    const formedTruce = resolution.changes.find((change) => change.type === "form-truce");

    expect(formedTruce).toMatchObject({
      type: "form-truce",

      truce: {
        kind: "standard",
        tributeIds: participants.map((tribute) => tribute.id),
        createdRound: NIGHT_ONE,

        expiresAfterRound: {
          day: 4,
          period: "day",
        },
      },
    });

    expect(resolution.changes.some((change) => change.type === "acquire-item")).toBe(false);

    expect(resolution.changes.filter((change) => change.type === "record-night-rest")).toEqual(
      participants.map((tribute) => ({
        type: "record-night-rest",

        tributeId: tribute.id,
        round: NIGHT_ONE,
        quality: "sheltered",
      })),
    );

    expect(resolution.text).toMatch(/sleep in shifts|keeps watch|rest/i);
    expect(event.periods).toEqual(["night"]);
  });

  it("does not form a group when too few unaligned tributes remain", () => {
    const game = createGame();

    const existingTruce = {
      id: "existing-truce",
      kind: "standard",
      tributeIds: game.tributes.slice(0, 4).map((tribute) => tribute.id),

      createdRound: DAY_ONE,

      expiresAfterRound: {
        day: 4,
        period: "day",
      },
    } as const;

    const state = {
      ...game,

      truces: [existingTruce],
    };

    const event = requireEvent("travel-together-truce-6");

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
