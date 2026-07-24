import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { ParticipantSelectionContext, ParticipantsByRole } from "~/game/events/event-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameState, GameTribute } from "~/game/types/game-state";

import { inActiveTruce, notInSameTruce } from "../requirements/relationship-requirements";
import { maximumStat, minimumStat } from "../requirements/stat-requirements";
import { hasAnyHarmfulStatus, hasStatus, lacksStatus } from "../requirements/status-requirements";
import { compileAuthoredRoles } from "./compile-roles";
import { groupRole, soloRole, victimRole } from "./role-presets";

const ROUND = {
  day: 2,
  period: "day",
} as const;

function createSelectionContext(
  state: GameState,
  participantsByRole: ParticipantsByRole = {},
): ParticipantSelectionContext {
  return {
    state,
    round: ROUND,

    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),

    participantsByRole,
  };
}

function addStatus(tribute: GameTribute, statusId: "injured" | "inspired"): GameTribute {
  return {
    ...tribute,

    statuses: [
      ...tribute.statuses,

      createStatusEffectInstance("compile-role-test", tribute.id, statusId, 1, ROUND),
    ],
  };
}

describe("compileAuthoredRoles immutability", () => {
  it("preserves role order, count, and weight", () => {
    const getWeight = () => 4;

    const compiled = compileAuthoredRoles([
      soloRole("attacker", {
        getWeight,
      }),

      groupRole("targets", 3),
    ]);

    expect(compiled.map((role) => role.id)).toEqual(["attacker", "targets"]);

    expect(compiled[0]).toMatchObject({
      id: "attacker",
      count: 1,
    });

    expect(compiled[0]?.getWeight).toBe(getWeight);

    expect(compiled[1]).toMatchObject({
      id: "targets",
      count: 3,
    });
  });

  it("compiles status requirements into role eligibility", () => {
    const baseTribute = createAuthoringTestTribute();

    const injuredTribute = addStatus(baseTribute, "injured");

    const inspiredTribute = addStatus(
      {
        ...baseTribute,
        id: "inspired-tribute",
      },
      "inspired",
    );

    const uninjuredTribute = {
      ...baseTribute,
      id: "uninjured-tribute",
    };

    const state = createAuthoringTestGame([injuredTribute, inspiredTribute, uninjuredTribute]);

    const context = createSelectionContext(state);

    const [injuredRole, uninspiredRole, harmfulRole] = compileAuthoredRoles(
      [soloRole("injured"), soloRole("uninspired"), soloRole("harmful")],

      [
        hasStatus("injured", "injured"),

        lacksStatus("uninspired", "inspired"),

        hasAnyHarmfulStatus("harmful"),
      ],
    );

    expect(injuredRole?.isEligible?.(injuredTribute, context)).toBe(true);

    expect(injuredRole?.isEligible?.(uninjuredTribute, context)).toBe(false);

    expect(uninspiredRole?.isEligible?.(uninjuredTribute, context)).toBe(true);

    expect(uninspiredRole?.isEligible?.(inspiredTribute, context)).toBe(false);

    expect(harmfulRole?.isEligible?.(injuredTribute, context)).toBe(true);

    expect(harmfulRole?.isEligible?.(inspiredTribute, context)).toBe(false);
  });

  it("combines multiple stat requirements for one role", () => {
    const tooWeak = createAuthoringTestTribute({
      stats: {
        brains: 2,
        brawn: 3,
        luck: 3,
      },
    });

    const eligible = createAuthoringTestTribute({
      id: "eligible",

      stats: {
        brains: 4,
        brawn: 3,
        luck: 3,
      },
    });

    const tooStrong = createAuthoringTestTribute({
      id: "too-strong",

      stats: {
        brains: 5,
        brawn: 3,
        luck: 3,
      },
    });

    const state = createAuthoringTestGame([tooWeak, eligible, tooStrong]);

    const context = createSelectionContext(state);

    const [role] = compileAuthoredRoles(
      [soloRole("tribute")],

      [minimumStat("tribute", "brains", 3), maximumStat("tribute", "brains", 4)],
    );

    expect(role?.isEligible?.(tooWeak, context)).toBe(false);

    expect(role?.isEligible?.(eligible, context)).toBe(true);

    expect(role?.isEligible?.(tooStrong, context)).toBe(false);
  });

  it("compiles active-truce eligibility", () => {
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

    const truce = createTruceInstance(
      "compile-role-truce",

      [member.id, partner.id],

      ROUND,

      {
        day: 3,
        period: "day",
      },
    );

    const state = {
      ...baseState,

      truces: [truce],
    };

    const context = createSelectionContext(state);

    const [role] = compileAuthoredRoles(
      [soloRole("member")],

      [inActiveTruce("member")],
    );

    expect(role?.isEligible?.(member, context)).toBe(true);

    expect(role?.isEligible?.(outsider, context)).toBe(false);
  });

  it("compiles separate-truce requirements into symmetric opposition", () => {
    const compiled = compileAuthoredRoles(
      [soloRole("attacker"), soloRole("victim")],

      [notInSameTruce("attacker", "victim")],
    );

    expect(compiled[0]?.opposesRoleIds).toEqual(["victim"]);

    expect(compiled[1]?.opposesRoleIds).toEqual(["attacker"]);

    /*
     * The truce relationship is delegated to the
     * existing opposition mechanism rather than
     * compiled into another eligibility callback.
     */
    expect(compiled[0]?.isEligible).toBeUndefined();

    expect(compiled[1]?.isEligible).toBeUndefined();
  });

  it("preserves existing opposed role IDs without duplicates", () => {
    const compiled = compileAuthoredRoles(
      [
        soloRole("attacker", {
          opposesRoleIds: ["victim"],
        }),

        soloRole("victim"),
      ],

      [notInSameTruce("attacker", "victim")],
    );

    expect(compiled[0]?.opposesRoleIds).toEqual(["victim"]);
  });
});

describe("compileAuthoredRoles compatibility", () => {
  it("does not add an eligibility callback without requirements", () => {
    const [compiledRole] = compileAuthoredRoles([soloRole("tribute")]);

    expect(compiledRole?.isEligible).toBeUndefined();
  });

  it("does not mutate authored opposition arrays", () => {
    const attacker = soloRole("attacker", {
      opposesRoleIds: ["victim"],
    });

    const victim = soloRole("victim");

    const originalOppositions = [...attacker.opposesRoleIds];

    compileAuthoredRoles(
      [attacker, victim],

      [notInSameTruce("attacker", "victim")],
    );

    expect(attacker.opposesRoleIds).toEqual(originalOppositions);
  });

  it("does not accumulate opposition across repeated compilation", () => {
    const roles = [soloRole("attacker"), soloRole("victim")];

    const requirements = [notInSameTruce("attacker", "victim")];

    const first = compileAuthoredRoles(roles, requirements);

    const second = compileAuthoredRoles(roles, requirements);

    expect(first[0]?.opposesRoleIds).toEqual(["victim"]);

    expect(second[0]?.opposesRoleIds).toEqual(["victim"]);

    expect(first[1]?.opposesRoleIds).toEqual(["attacker"]);

    expect(second[1]?.opposesRoleIds).toEqual(["attacker"]);
  });

  it("preserves role targeting metadata", () => {
    const [neutralRole, hostileRole] = compileAuthoredRoles([
      soloRole("environmental-victim"),
      victimRole("combat-victim"),
    ]);

    expect(neutralRole?.targeting).toBeUndefined();

    expect(hostileRole?.targeting).toBe("hostile");
  });
});
