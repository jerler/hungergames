import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import type { EventDefinition } from "~/game/events/event-schema";

import { selectEventParticipants } from "~/game/events/participant-selection";

import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";

const DAY = {
  day: 2,
  period: "day",
} as const;

const NIGHT = {
  day: 2,
  period: "night",
} as const;

interface AmbushFixture {
  state: GameState;
  unprotected: GameTribute;
  protected: GameTribute;
}

function createFixture(): AmbushFixture {
  const unprotected: GameTribute = {
    ...createAuthoringTestTribute({
      id: "unprotected-target",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },
    }),

    district: 1,

    districtPosition: 1,
  };

  const protectedBase: GameTribute = {
    ...createAuthoringTestTribute({
      id: "protected-target",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },
    }),

    district: 1,

    districtPosition: 2,
  };

  const protectedTribute = withAuthoringTestItem(protectedBase, "night-vision-goggles");

  return {
    state: createAuthoringTestGame([unprotected, protectedTribute]),

    unprotected,

    protected: protectedTribute,
  };
}

function createTargetingDefinition(isAmbush: boolean): EventDefinition {
  const tags: EventDefinition["tags"] = isAmbush ? ["hazard", "ambush"] : ["hazard"];

  return {
    id: isAmbush ? "night-ambush-targeting-test" : "ordinary-hostile-targeting-test",

    category: "hazard",

    tags,

    periods: ["day", "night"],

    baseWeight: 1,

    roles: [
      {
        id: "target",

        count: 1,

        targeting: "hostile",

        getWeight: () => 1,
      },
    ],

    resolve: () => ({
      text: "Target-selection test.",

      changes: [],
    }),
  };
}

function selectTarget(
  fixture: AmbushFixture,
  round: RoundReference,
  isAmbush: boolean,
): string | undefined {
  const selection = selectEventParticipants(
    createTargetingDefinition(isAmbush),

    {
      state: fixture.state,

      round,

      livingTributes: [fixture.unprotected, fixture.protected],
    },

    /*
     * With equal weights:
     *
     *   0.6 selects the second tribute.
     *
     * During a night ambush:
     *
     *   unprotected = 1
     *   goggles     = 0.55
     *
     *   0.6 selects the first tribute.
     */
    () => 0.6,

    new Set(),
  );

  return selection?.participantsByRole.target?.[0]?.id;
}

describe("night ambush participant selection", () => {
  it("makes the goggle wearer less likely to be selected during a night ambush", () => {
    const fixture = createFixture();

    expect(selectTarget(fixture, NIGHT, true)).toBe(fixture.unprotected.id);
  });

  it("does not protect the goggle wearer during a daytime ambush", () => {
    const fixture = createFixture();

    expect(selectTarget(fixture, DAY, true)).toBe(fixture.protected.id);
  });

  it("does not protect the goggle wearer during a non-ambush night event", () => {
    const fixture = createFixture();

    expect(selectTarget(fixture, NIGHT, false)).toBe(fixture.protected.id);
  });
});
