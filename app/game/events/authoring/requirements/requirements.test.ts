import { describe, expect, it } from "vitest";

import { getRequirementRoleIds } from "./requirement-schema";
import { inActiveTruce, notInSameTruce } from "./relationship-requirements";
import { maximumStat, minimumStat } from "./stat-requirements";
import { hasAnyHarmfulStatus, hasStatus, lacksStatus } from "./status-requirements";

describe("status requirements", () => {
  it("creates a has-status requirement", () => {
    expect(hasStatus("tribute", "injured")).toEqual({
      kind: "has-status",

      roleId: "tribute",
      statusId: "injured",
    });
  });

  it("creates a lacks-status requirement", () => {
    expect(lacksStatus("tribute", "inspired")).toEqual({
      kind: "lacks-status",

      roleId: "tribute",
      statusId: "inspired",
    });
  });

  it("creates a harmful-status requirement", () => {
    expect(hasAnyHarmfulStatus("patient")).toEqual({
      kind: "has-any-harmful-status",

      roleId: "patient",
    });
  });
});

describe("stat requirements", () => {
  it("creates a minimum-stat requirement", () => {
    expect(minimumStat("forager", "brains", 4)).toEqual({
      kind: "minimum-stat",

      roleId: "forager",
      stat: "brains",
      value: 4,
    });
  });

  it("creates a maximum-stat requirement", () => {
    expect(maximumStat("victim", "brawn", 2)).toEqual({
      kind: "maximum-stat",

      roleId: "victim",
      stat: "brawn",
      value: 2,
    });
  });
});

describe("relationship requirements", () => {
  it("creates an active-truce requirement", () => {
    expect(inActiveTruce("protector")).toEqual({
      kind: "in-active-truce",

      roleId: "protector",
    });
  });

  it("creates a separate-truce requirement", () => {
    expect(notInSameTruce("attacker", "victim")).toEqual({
      kind: "not-in-same-truce",

      firstRoleId: "attacker",

      secondRoleId: "victim",
    });
  });
});

describe("getRequirementRoleIds", () => {
  it.each([
    {
      requirement: hasStatus("tribute", "injured"),

      expectedRoleIds: ["tribute"],
    },

    {
      requirement: lacksStatus("patient", "inspired"),

      expectedRoleIds: ["patient"],
    },

    {
      requirement: hasAnyHarmfulStatus("patient"),

      expectedRoleIds: ["patient"],
    },

    {
      requirement: minimumStat("forager", "brains", 4),

      expectedRoleIds: ["forager"],
    },

    {
      requirement: maximumStat("victim", "brawn", 2),

      expectedRoleIds: ["victim"],
    },

    {
      requirement: inActiveTruce("protector"),

      expectedRoleIds: ["protector"],
    },

    {
      requirement: notInSameTruce("attacker", "victim"),

      expectedRoleIds: ["attacker", "victim"],
    },
  ])("returns referenced role IDs", ({ requirement, expectedRoleIds }) => {
    expect(getRequirementRoleIds(requirement)).toEqual(expectedRoleIds);
  });
});
