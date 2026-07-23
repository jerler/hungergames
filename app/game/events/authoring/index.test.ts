import { describe, expect, it } from "vitest";

import {
  always,
  attackerRole,
  createEvent,
  groupRole,
  hasAnyHarmfulStatus,
  hasStatus,
  inActiveTruce,
  lacksStatus,
  maximumStat,
  minimumStat,
  notInSameTruce,
  opposedTargetRole,
  result,
  soloRole,
  victimRole,
} from "~/game/events/authoring";

describe("event authoring public API", () => {
  it("exports the Phase 2 role presets", () => {
    expect(soloRole()).toMatchObject({
      id: "tribute",
      count: 1,
    });

    expect(attackerRole()).toMatchObject({
      id: "attacker",
      count: 1,
    });

    expect(victimRole()).toMatchObject({
      id: "victim",
      count: 1,
    });

    expect(opposedTargetRole()).toMatchObject({
      id: "target",
      count: 1,

      opposesRoleIds: ["attacker"],
    });

    expect(groupRole("tributes", 3)).toMatchObject({
      id: "tributes",
      count: 3,
    });
  });

  it("exports the Phase 2 requirement factories", () => {
    expect(hasStatus("tribute", "injured")).toEqual({
      kind: "has-status",
      roleId: "tribute",
      statusId: "injured",
    });

    expect(lacksStatus("tribute", "inspired")).toEqual({
      kind: "lacks-status",
      roleId: "tribute",
      statusId: "inspired",
    });

    expect(hasAnyHarmfulStatus("patient")).toEqual({
      kind: "has-any-harmful-status",

      roleId: "patient",
    });

    expect(minimumStat("tribute", "luck", 4)).toEqual({
      kind: "minimum-stat",
      roleId: "tribute",
      stat: "luck",
      value: 4,
    });

    expect(maximumStat("victim", "brawn", 2)).toEqual({
      kind: "maximum-stat",
      roleId: "victim",
      stat: "brawn",
      value: 2,
    });

    expect(inActiveTruce("protector")).toEqual({
      kind: "in-active-truce",
      roleId: "protector",
    });

    expect(notInSameTruce("attacker", "victim")).toEqual({
      kind: "not-in-same-truce",

      firstRoleId: "attacker",
      secondRoleId: "victim",
    });
  });

  it("supports building an event entirely through public exports", () => {
    const definition = createEvent("public-api-test")
      .roles(attackerRole(), opposedTargetRole())
      .when(
        minimumStat("attacker", "brawn", 3),

        notInSameTruce("attacker", "target"),
      )
      .during("day")
      .category("hazard")
      .tags("hazard", "combat")
      .resolve(
        always(
          result({
            text: "The event resolves.",
          }),
        ),
      );

    expect(definition.roles.map((role) => role.id)).toEqual(["attacker", "target"]);

    expect(definition.roles[0]?.isEligible).toBeTypeOf("function");

    expect(definition.roles[0]?.opposesRoleIds).toEqual(["target"]);

    expect(definition.roles[1]?.opposesRoleIds).toEqual(["attacker"]);
  });
});
