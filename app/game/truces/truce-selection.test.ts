import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import type { RandomSource } from "~/game/engine/random";
import { selectEventParticipants } from "~/game/events/participant-selection";
import type { EventDefinition } from "~/game/events/event-schema";
import { SURVIVAL_EVENTS } from "~/game/events/catalogue/encounters/survival-events";
import { STANDARD_FORMATION_EVENTS } from "~/game/events/catalogue/relationships/standard-formation-events";

import {
  createTruceInstance,
  getTruceFormationPopulationMultiplier,
} from "~/game/truces/truce-engine";
import {
  getAverageDistrictAffinityWeight,
  getDistrictAffinityWeight,
} from "~/game/truces/truce-selection";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState } from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
  period: "day",
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

      seed: "truce-selection-tests",

      now: "2026-07-20T12:00:00.000Z",
    },
  );
}

function createSequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;

  const fallback = values[values.length - 1] ?? 0.5;

  return () => {
    const value = values[index] ?? fallback;

    index += 1;

    return value;
  };
}

function requireFormationEvent(eventId: string): EventDefinition {
  const definition = STANDARD_FORMATION_EVENTS.find((candidate) => candidate.id === eventId);

  if (!definition) {
    throw new Error(`Missing truce formation event "${eventId}".`);
  }

  return definition;
}

describe("truce selection", () => {
  it("uses the intended district affinity weights", () => {
    const game = createGame();

    const first = {
      ...game.tributes[0],
      district: 4,
    };

    expect(
      getDistrictAffinityWeight(first, {
        ...game.tributes[1],
        district: 4,
      }),
    ).toBe(3);

    expect(
      getDistrictAffinityWeight(first, {
        ...game.tributes[1],
        district: 5,
      }),
    ).toBe(2);

    expect(
      getDistrictAffinityWeight(first, {
        ...game.tributes[1],
        district: 6,
      }),
    ).toBe(1.35);

    expect(
      getDistrictAffinityWeight(first, {
        ...game.tributes[1],
        district: 12,
      }),
    ).toBe(0.3);
  });

  it("averages affinity across existing group members", () => {
    const game = createGame();

    const candidate = {
      ...game.tributes[0],
      district: 5,
    };

    const members = [
      {
        ...game.tributes[1],
        district: 4,
      },
      {
        ...game.tributes[2],
        district: 6,
      },
    ];

    expect(getAverageDistrictAffinityWeight(candidate, members)).toBe(2);
  });

  it("makes a nearby district more likely than a distant district", () => {
    const game = createGame();

    const anchor = {
      ...game.tributes[0],
      district: 4,
    };

    const nearby = {
      ...game.tributes[1],
      district: 5,
    };

    const distant = {
      ...game.tributes[2],
      district: 12,
    };

    const definition: EventDefinition = {
      id: "district-affinity-test",

      category: "survival",
      tags: ["survival", "truce"],
      periods: ["day"],
      baseWeight: 1,

      roles: [
        {
          id: "anchor",
          count: 1,

          isEligible: (tribute) => tribute.id === anchor.id,
        },
        {
          id: "partner",
          count: 1,

          getWeight: (tribute, { participantsByRole }) =>
            getAverageDistrictAffinityWeight(tribute, participantsByRole.anchor ?? []),
        },
      ],

      resolve: () => ({
        text: "Test event.",
        changes: [],
      }),
    };

    const selection = selectEventParticipants(
      definition,
      {
        state: game,
        round: DAY_ONE,

        livingTributes: [anchor, nearby, distant],
      },

      createSequenceRandom([0, 0.5]),

      new Set(),
    );

    expect(selection?.participantsByRole.partner[0].id).toBe(nearby.id);
  });

  it("selects the same formation for the same random sequence", () => {
    const game = createGame();

    const definition = requireFormationEvent("share-shelter-truce-4");

    const selectGroup = () =>
      selectEventParticipants(
        definition,
        {
          state: game,
          round: DAY_ONE,

          livingTributes: game.tributes,
        },

        createSequenceRandom([0.37, 0.18, 0.72, 0.41]),

        new Set(),
      );

    const firstSelection = selectGroup();

    const secondSelection = selectGroup();

    expect(secondSelection?.participantTributeIds).toEqual(firstSelection?.participantTributeIds);

    expect(firstSelection?.participantTributeIds).toHaveLength(4);
  });

  it("makes an existing truce pair more likely in a cooperative event", () => {
    const game = createGame();

    const firstTribute = game.tributes[0];

    const partner = game.tributes[1];

    const outsider = game.tributes[2];

    const truce = createTruceInstance("existing-truce", [firstTribute.id, partner.id], DAY_ONE, {
      day: 1,
      period: "night",
    });

    const state = {
      ...game,
      truces: [truce],
    };

    const picnic = SURVIVAL_EVENTS.find((event) => event.id === "unfamiliar-foraging-ground");

    if (!picnic) {
      throw new Error("Missing unfamiliar-foraging-ground event.");
    }

    const selection = selectEventParticipants(
      picnic,
      {
        state,
        round: DAY_ONE,

        livingTributes: [firstTribute, partner, outsider],
      },

      createSequenceRandom([0, 0.7]),

      new Set(),
    );

    expect(selection?.participantTributeIds).toEqual([firstTribute.id, partner.id]);
  });

  it("reduces formation weight as the population falls", () => {
    const game = createGame();

    const withLivingCount = (livingCount: number): GameState => ({
      ...game,

      tributes: game.tributes.map((tribute, index) => ({
        ...tribute,
        isAlive: index < livingCount,
      })),
    });

    expect(getTruceFormationPopulationMultiplier(withLivingCount(12))).toBe(1);

    expect(getTruceFormationPopulationMultiplier(withLivingCount(8))).toBe(0.65);

    expect(getTruceFormationPopulationMultiplier(withLivingCount(5))).toBe(0.25);

    expect(getTruceFormationPopulationMultiplier(withLivingCount(3))).toBe(0);
  });
});
