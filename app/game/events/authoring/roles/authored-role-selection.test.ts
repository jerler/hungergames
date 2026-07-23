import { describe, expect, it } from "vitest";

import {
  always,
  createEvent,
  groupRole,
  hasStatus,
  inActiveTruce,
  maximumStat,
  minimumStat,
  notInSameTruce,
  result,
  soloRole,
} from "~/game/events/authoring";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameState, GameTribute } from "~/game/types/game-state";

const ROUND = {
  day: 2,
  period: "day",
} as const;

function createStaticStrategy() {
  return always(
    result({
      text: "The event resolves.",
    }),
  );
}

function addStatus(tribute: GameTribute, statusId: "injured" | "inspired"): GameTribute {
  return {
    ...tribute,

    statuses: [
      ...tribute.statuses,

      createStatusEffectInstance("authored-role-selection", tribute.id, statusId, 1, ROUND),
    ],
  };
}

function createSelectionContext(
  state: GameState,
  livingTributes: readonly GameTribute[] = state.tributes,
): EventSelectionContext {
  return {
    state,
    round: ROUND,

    livingTributes,
  };
}

function selectParticipants(
  definition: EventDefinition,
  state: GameState,
  random: () => number = () => 0,
  livingTributes: readonly GameTribute[] = state.tributes,
) {
  return selectEventParticipants(
    definition,
    createSelectionContext(state, livingTributes),
    random,
    new Set(),
  );
}

function createSequenceRandom(values: readonly number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index] ?? 0;

    index += 1;

    return value;
  };
}

describe("authored role participant selection", () => {
  it("selects a participant satisfying a single-role requirement", () => {
    const ineligible = createAuthoringTestTribute({
      id: "ineligible",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 2,
      },
    });

    const eligible = createAuthoringTestTribute({
      id: "eligible",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 5,
      },
    });

    const state = createAuthoringTestGame([ineligible, eligible]);

    const definition = createEvent("single-authored-role")
      .roles(soloRole("tribute"))
      .when(minimumStat("tribute", "luck", 4))
      .during("day")
      .resolve(createStaticStrategy());

    const selection = selectParticipants(definition, state);

    expect(selection?.participantsByRole.tribute).toEqual([eligible]);
  });

  it("selects participants for multiple authored roles", () => {
    const attacker = createAuthoringTestTribute({
      id: "attacker",

      stats: {
        brains: 3,
        brawn: 5,
        luck: 3,
      },
    });

    const victim = createAuthoringTestTribute({
      id: "victim",

      stats: {
        brains: 3,
        brawn: 1,
        luck: 3,
      },
    });

    const state = createAuthoringTestGame([attacker, victim]);

    const definition = createEvent("multiple-authored-roles")
      .pair(soloRole("attacker"), soloRole("victim"))
      .when(
        minimumStat("attacker", "brawn", 4),

        maximumStat("victim", "brawn", 2),
      )
      .during("day")
      .resolve(createStaticStrategy());

    const selection = selectParticipants(definition, state);

    expect(selection?.participantsByRole.attacker).toEqual([attacker]);

    expect(selection?.participantsByRole.victim).toEqual([victim]);

    expect(selection?.participantTributeIds).toEqual([attacker.id, victim.id]);
  });

  it("preserves same-role participant context for groups", () => {
    const leader = createAuthoringTestTribute({
      id: "leader",
    });

    const other = createAuthoringTestTribute({
      id: "other",
    });

    const preferredPartner = createAuthoringTestTribute({
      id: "preferred-partner",
    });

    const state = createAuthoringTestGame([leader, other, preferredPartner]);

    const definition = createEvent("same-role-context")
      .roles(
        groupRole("members", 2, {
          getWeight: (tribute, context) => {
            const selectedMembers = context.participantsByRole.members ?? [];

            if (selectedMembers.length === 0) {
              return tribute.id === leader.id ? 100 : 1;
            }

            return tribute.id === preferredPartner.id ? 100 : 1;
          },
        }),
      )
      .during("day")
      .resolve(createStaticStrategy());

    const selection = selectParticipants(definition, state, () => 0.5);

    expect(selection?.participantsByRole.members.map((tribute) => tribute.id)).toEqual([
      leader.id,
      preferredPartner.id,
    ]);
  });

  it("uses authored role weights during selection", () => {
    const lightlyWeighted = createAuthoringTestTribute({
      id: "light",
    });

    const heavilyWeighted = createAuthoringTestTribute({
      id: "heavy",
    });

    const state = createAuthoringTestGame([lightlyWeighted, heavilyWeighted]);

    const definition = createEvent("weighted-authored-role")
      .roles(
        soloRole("tribute", {
          getWeight: (tribute) => (tribute.id === heavilyWeighted.id ? 9 : 1),
        }),
      )
      .during("day")
      .resolve(createStaticStrategy());

    const selection = selectParticipants(definition, state, () => 0.5);

    expect(selection?.participantsByRole.tribute).toEqual([heavilyWeighted]);
  });

  it("compiles status requirements into real selection eligibility", () => {
    const healthy = createAuthoringTestTribute({
      id: "healthy",
    });

    const injured = addStatus(
      createAuthoringTestTribute({
        id: "injured",
      }),
      "injured",
    );

    const state = createAuthoringTestGame([healthy, injured]);

    const definition = createEvent("status-selection-requirement")
      .roles(soloRole("patient"))
      .when(hasStatus("patient", "injured"))
      .during("day")
      .resolve(createStaticStrategy());

    const selection = selectParticipants(definition, state);

    expect(selection?.participantsByRole.patient).toEqual([injured]);
  });

  it("compiles active-truce requirements into real selection eligibility", () => {
    const member = createAuthoringTestTribute({
      id: "member",
    });

    const partner = createAuthoringTestTribute({
      id: "partner",
    });

    const outsider = createAuthoringTestTribute({
      id: "outsider",
    });

    const baseState = createAuthoringTestGame([member, partner, outsider]);

    const truce = createTruceInstance("authored-selection-truce", [member.id, partner.id], ROUND, {
      day: 3,
      period: "day",
    });

    const state: GameState = {
      ...baseState,

      truces: [truce],
    };

    const definition = createEvent("active-truce-requirement")
      .roles(soloRole("member"))
      .when(inActiveTruce("member"))
      .during("day")
      .resolve(createStaticStrategy());

    const selection = selectParticipants(definition, state, () => 0, [outsider, member]);

    expect(selection?.participantsByRole.member).toEqual([member]);
  });

  it("does not select truce partners for opposed roles", () => {
    const attacker = createAuthoringTestTribute({
      id: "attacker",

      stats: {
        brains: 3,
        brawn: 5,
        luck: 3,
      },
    });

    const victim = createAuthoringTestTribute({
      id: "victim",

      stats: {
        brains: 3,
        brawn: 1,
        luck: 3,
      },
    });

    const baseState = createAuthoringTestGame([attacker, victim]);

    const truce = createTruceInstance("opposed-role-truce", [attacker.id, victim.id], ROUND, {
      day: 3,
      period: "day",
    });

    const state: GameState = {
      ...baseState,

      truces: [truce],
    };

    const definition = createEvent("opposed-truce-partners")
      .pair(soloRole("attacker"), soloRole("victim"))
      .when(
        minimumStat("attacker", "brawn", 4),

        maximumStat("victim", "brawn", 2),

        notInSameTruce("attacker", "victim"),
      )
      .during("day")
      .resolve(createStaticStrategy());

    expect(selectParticipants(definition, state)).toBeNull();
  });

  it("preserves later-role backtracking", () => {
    const blockedAttacker = createAuthoringTestTribute({
      id: "blocked-attacker",

      stats: {
        brains: 3,
        brawn: 5,
        luck: 3,
      },
    });

    const viableAttacker = createAuthoringTestTribute({
      id: "viable-attacker",

      stats: {
        brains: 3,
        brawn: 5,
        luck: 3,
      },
    });

    const target = createAuthoringTestTribute({
      id: "target",

      stats: {
        brains: 3,
        brawn: 1,
        luck: 3,
      },
    });

    const baseState = createAuthoringTestGame([blockedAttacker, viableAttacker, target]);

    const truce = createTruceInstance(
      "backtracking-truce",
      [blockedAttacker.id, target.id],
      ROUND,
      {
        day: 3,
        period: "day",
      },
    );

    const state: GameState = {
      ...baseState,

      truces: [truce],
    };

    const definition = createEvent("authored-role-backtracking")
      .pair(soloRole("attacker"), soloRole("target"))
      .when(
        minimumStat("attacker", "brawn", 4),

        maximumStat("target", "brawn", 2),

        notInSameTruce("attacker", "target"),
      )
      .during("day")
      .resolve(createStaticStrategy());

    /*
     * Zero selects blockedAttacker first.
     *
     * That path cannot fill the target role because the
     * only eligible target is their truce partner. The
     * existing selector must backtrack and retry using
     * viableAttacker.
     */
    const selection = selectParticipants(definition, state, () => 0);

    expect(selection?.participantsByRole.attacker).toEqual([viableAttacker]);

    expect(selection?.participantsByRole.target).toEqual([target]);
  });

  it("remains deterministic for identical random input", () => {
    const firstTribute = createAuthoringTestTribute({
      id: "first",
    });

    const secondTribute = createAuthoringTestTribute({
      id: "second",
    });

    const thirdTribute = createAuthoringTestTribute({
      id: "third",
    });

    const state = createAuthoringTestGame([firstTribute, secondTribute, thirdTribute]);

    const definition = createEvent("deterministic-authored-selection")
      .roles(groupRole("tributes", 2))
      .during("day")
      .resolve(createStaticStrategy());

    const firstSelection = selectParticipants(
      definition,
      state,
      createSequenceRandom([0.72, 0.18]),
    );

    const secondSelection = selectParticipants(
      definition,
      state,
      createSequenceRandom([0.72, 0.18]),
    );

    expect(secondSelection?.participantTributeIds).toEqual(firstSelection?.participantTributeIds);

    expect(secondSelection?.participantsByRole).toEqual(firstSelection?.participantsByRole);
  });
});
