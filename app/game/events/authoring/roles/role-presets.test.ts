import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";

import {
  attackerRole,
  foragerRole,
  groupRole,
  opposedTargetRole,
  soloRole,
  victimRole,
} from "./role-presets";

describe("role presets", () => {
  it("creates the default solo role", () => {
    expect(soloRole()).toEqual({
      id: "tribute",
      count: 1,

      getWeight: undefined,

      opposesRoleIds: [],
    });
  });

  it("supports a custom solo role ID and weight", () => {
    const getWeight = () => 4;

    const role = soloRole("speaker", {
      getWeight,
    });

    expect(role).toEqual({
      id: "speaker",
      count: 1,

      getWeight,

      opposesRoleIds: [],
    });
  });

  it("weights foragers using the current foraging score", () => {
    const strongForager = createAuthoringTestTribute({
      stats: {
        brains: 5,
        brawn: 3,
        luck: 5,
      },
    });

    const weakForager = createAuthoringTestTribute({
      id: "tribute-2",

      stats: {
        brains: 1,
        brawn: 1,
        luck: 1,
      },
    });

    const role = foragerRole();

    expect(
      role.getWeight?.(strongForager, {
        state: {} as never,
        round: {} as never,
        livingTributes: [],
        participantsByRole: {},
      }),
    ).toBeGreaterThan(
      role.getWeight?.(weakForager, {
        state: {} as never,
        round: {} as never,
        livingTributes: [],
        participantsByRole: {},
      }) ?? 0,
    );
  });

  it("weights attackers toward stronger combatants", () => {
    const strongTribute = createAuthoringTestTribute({
      stats: {
        brains: 4,
        brawn: 5,
        luck: 4,
      },
    });

    const weakTribute = createAuthoringTestTribute({
      id: "tribute-2",

      stats: {
        brains: 1,
        brawn: 1,
        luck: 1,
      },
    });

    const role = attackerRole();

    const context = {
      state: {} as never,
      round: {} as never,
      livingTributes: [],
      participantsByRole: {},
    };

    expect(role.getWeight?.(strongTribute, context)).toBeGreaterThan(
      role.getWeight?.(weakTribute, context) ?? 0,
    );
  });

  it("weights victims toward more vulnerable tributes", () => {
    const strongTribute = createAuthoringTestTribute({
      stats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },
    });

    const vulnerableTribute = createAuthoringTestTribute({
      id: "tribute-2",

      stats: {
        brains: 1,
        brawn: 1,
        luck: 1,
      },
    });

    const role = victimRole();

    const context = {
      state: {} as never,
      round: {} as never,
      livingTributes: [],
      participantsByRole: {},
    };

    expect(role.getWeight?.(vulnerableTribute, context)).toBeGreaterThan(
      role.getWeight?.(strongTribute, context) ?? 0,
    );
  });

  it("creates an opposed target without duplicating role IDs", () => {
    const role = opposedTargetRole("victim", "attacker", {
      opposesRoleIds: ["attacker", "third-party"],
    });

    expect(role.opposesRoleIds).toEqual(["attacker", "third-party"]);
  });

  it("creates a same-role group", () => {
    expect(groupRole("tributes", 3)).toEqual({
      id: "tributes",
      count: 3,

      getWeight: undefined,

      opposesRoleIds: [],
    });
  });

  it("allows preset weights to be overridden", () => {
    const customWeight = () => 99;

    expect(
      attackerRole("attacker", {
        getWeight: customWeight,
      }).getWeight,
    ).toBe(customWeight);

    expect(
      foragerRole("forager", {
        getWeight: customWeight,
      }).getWeight,
    ).toBe(customWeight);

    expect(
      victimRole("victim", {
        getWeight: customWeight,
      }).getWeight,
    ).toBe(customWeight);
  });
});
