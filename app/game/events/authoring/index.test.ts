import { describe, expect, it } from "vitest";

import {
  always,
  attackerRole,
  createEvent,
  minimumStat,
  notInSameTruce,
  opposedTargetRole,
  result,
} from "~/game/events/authoring";

describe("event authoring public API", () => {
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
