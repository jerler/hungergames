import { describe, expect, it } from "vitest";

import { always, createEvent, result } from "~/game/events/authoring";
import { notInSameTruce } from "~/game/events/authoring/requirements/relationship-requirements";
import { minimumStat } from "~/game/events/authoring/requirements/stat-requirements";
import { groupRole, soloRole } from "~/game/events/authoring/roles/role-presets";

function createStaticStrategy() {
  return always(
    result({
      text: "The event resolves.",
    }),
  );
}

describe("authored role validation", () => {
  it("rejects duplicate role IDs", () => {
    expect(() =>
      createEvent("duplicate-roles")
        .roles(
          soloRole("tribute"),

          soloRole("tribute"),
        )
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow('Event "duplicate-roles" declares duplicate participant role IDs.');
  });

  it("rejects an empty role ID", () => {
    expect(() =>
      createEvent("empty-role-id")
        .roles(soloRole(""))
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow('Event "empty-role-id" contains an empty participant role ID.');
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects invalid role count %s",
    (count) => {
      expect(() =>
        createEvent("invalid-role-count")
          .roles(groupRole("tributes", count))
          .during("day")
          .resolve(createStaticStrategy()),
      ).toThrow('Event "invalid-role-count" role "tributes" must have a positive integer count.');
    },
  );

  it("rejects an unknown opposed role", () => {
    expect(() =>
      createEvent("unknown-opposed-role")
        .roles(
          soloRole("attacker", {
            opposesRoleIds: ["victim"],
          }),
        )
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow('Event "unknown-opposed-role" role "attacker" opposes unknown role "victim".');
  });

  it("rejects a role opposing itself", () => {
    expect(() =>
      createEvent("self-opposed-role")
        .roles(
          soloRole("attacker", {
            opposesRoleIds: ["attacker"],
          }),
        )
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow('Event "self-opposed-role" role "attacker" cannot oppose itself.');
  });

  it("allows an opposed role declared later", () => {
    expect(() =>
      createEvent("valid-opposed-roles")
        .roles(
          soloRole("attacker", {
            opposesRoleIds: ["victim"],
          }),

          soloRole("victim"),
        )
        .during("day")
        .resolve(createStaticStrategy()),
    ).not.toThrow();
  });
});

describe("authored requirement validation", () => {
  it("rejects a requirement referencing an undefined role", () => {
    expect(() =>
      createEvent("unknown-requirement-role")
        .roles(soloRole("tribute"))
        .when(minimumStat("missing", "luck", 4))
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow(
      'Event "unknown-requirement-role": requirement "minimum-stat" references unknown role "missing".',
    );
  });

  it("rejects an unknown first relationship role", () => {
    expect(() =>
      createEvent("unknown-first-relationship-role")
        .roles(soloRole("victim"))
        .when(notInSameTruce("attacker", "victim"))
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow(
      'Event "unknown-first-relationship-role": requirement "not-in-same-truce" references unknown role "attacker".',
    );
  });

  it("rejects an unknown second relationship role", () => {
    expect(() =>
      createEvent("unknown-second-relationship-role")
        .roles(soloRole("attacker"))
        .when(notInSameTruce("attacker", "victim"))
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow(
      'Event "unknown-second-relationship-role": requirement "not-in-same-truce" references unknown role "victim".',
    );
  });

  it("rejects a same-role truce opposition requirement", () => {
    expect(() =>
      createEvent("same-role-truce-opposition")
        .roles(soloRole("attacker"))
        .when(notInSameTruce("attacker", "attacker"))
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow(
      'Event "same-role-truce-opposition": requirement "not-in-same-truce" must reference two different roles.',
    );
  });

  it("accepts valid role and relationship references", () => {
    expect(() =>
      createEvent("valid-role-references")
        .roles(
          soloRole("attacker"),

          soloRole("victim"),
        )
        .when(
          minimumStat("attacker", "brawn", 3),

          notInSameTruce("attacker", "victim"),
        )
        .during("day", "night")
        .resolve(createStaticStrategy()),
    ).not.toThrow();
  });
});

describe("authored event configuration validation", () => {
  it.each(["", "Not Kebab Case", "invalid_event"])("rejects invalid event ID %j", (eventId) => {
    expect(() => createEvent(eventId).solo().during("day").resolve(createStaticStrategy())).toThrow(
      "must be non-empty kebab-case text",
    );
  });

  it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects invalid event weight %s",
    (weight) => {
      expect(() =>
        createEvent("invalid-weight")
          .solo()
          .during("day")
          .weight(weight)
          .resolve(createStaticStrategy()),
      ).toThrow("must have a positive finite weight");
    },
  );

  it("requires at least one period", () => {
    expect(() => createEvent("missing-period").solo().resolve(createStaticStrategy())).toThrow(
      "must declare at least one period",
    );
  });

  it("requires at least one role", () => {
    expect(() => createEvent("missing-role").during("day").resolve(createStaticStrategy())).toThrow(
      "must declare at least one participant role",
    );
  });
});
