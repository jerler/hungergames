import { describe, expect, it } from "vitest";

import {
  always,
  createEvent,
  hasItem,
  hasItemTag,
  hasTreatmentFor,
  result,
  soloRole,
} from "~/game/events/authoring";
import { compileAuthoredRoles } from "~/game/events/authoring/roles/compile-roles";
import type { ItemDefinitionId, ItemTag } from "~/game/items/item-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";

function createStaticStrategy() {
  return always(
    result({
      text: "The event resolves.",
    }),
  );
}

describe("required-item requirement factories", () => {
  it("creates an accessible item-definition requirement by default", () => {
    expect(
      hasItem("tribute", {
        definitionIds: ["map"],
      }),
    ).toEqual({
      kind: "has-item",
      roleId: "tribute",

      definitionIds: ["map"],

      access: "accessible",
      requireUsable: true,
    });
  });

  it("creates an owned item-tag requirement", () => {
    expect(
      hasItem("tribute", {
        definitionIds: ["map"],
      }),
    ).toEqual({
      kind: "has-item",
      roleId: "tribute",

      definitionIds: ["map"],

      access: "accessible",
      requireUsable: true,
    });
  });

  it("creates a treatment requirement", () => {
    expect(hasTreatmentFor("patient", "injured")).toEqual({
      kind: "has-treatment-for",
      roleId: "patient",

      statusId: "injured",

      access: "accessible",
      requireUsable: true,
    });
  });

  it("supports narrative ownership checks without requiring usability", () => {
    expect(
      hasItem("owner", {
        definitionIds: ["spear"],
        access: "owned",
        requireUsable: false,
      }),
    ).toEqual({
      kind: "has-item",
      roleId: "owner",

      definitionIds: ["spear"],

      access: "owned",
      requireUsable: false,
    });
  });
});

describe("required-item role compilation", () => {
  it("compiles item definitions and owned access", () => {
    const [role] = compileAuthoredRoles(
      [soloRole("tribute")],

      [
        hasItem("tribute", {
          definitionIds: ["map"],

          access: "owned",
        }),
      ],
    );

    expect(role).toMatchObject({
      id: "tribute",
      count: 1,

      requiredItemDefinitionIds: ["map"],

      itemAccess: "owned",
    });
  });

  it("compiles item tags and accessible access", () => {
    const [role] = compileAuthoredRoles(
      [soloRole("forager")],

      [
        hasItemTag("forager", {
          tags: ["tool", "fishing"],
        }),
      ],
    );

    expect(role).toMatchObject({
      requiredItemTags: ["tool", "fishing"],

      itemAccess: "accessible",
    });
  });

  it("compiles treatment requirements into matching item definitions", () => {
    const [role] = compileAuthoredRoles(
      [soloRole("patient")],

      [hasTreatmentFor("patient", "bleeding")],
    );

    expect(role?.requiredItemDefinitionIds).toEqual(["medicine"]);
  });
});

describe("required-item validation", () => {
  it("rejects an empty item-definition list", () => {
    expect(() =>
      createEvent("empty-item-requirement")
        .roles(soloRole("tribute"))
        .when(
          hasItem("tribute", {
            definitionIds: [],
          }),
        )
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow(
      'Event "empty-item-requirement": requirement "has-item" must declare at least one item definition.',
    );
  });

  it("rejects an empty item-tag list", () => {
    expect(() =>
      createEvent("empty-item-tag-requirement")
        .roles(soloRole("tribute"))
        .when(
          hasItemTag("tribute", {
            tags: [],
          }),
        )
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow(
      'Event "empty-item-tag-requirement": requirement "has-item-tag" must declare at least one item tag.',
    );
  });

  it("rejects an unknown item definition", () => {
    expect(() =>
      createEvent("unknown-required-item")
        .roles(soloRole("tribute"))
        .when(
          hasItem("tribute", {
            definitionIds: ["unknown-item" as ItemDefinitionId],
          }),
        )
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow(
      'Event "unknown-required-item": requirement "has-item" references unknown item "unknown-item".',
    );
  });

  it("rejects an unknown item tag", () => {
    expect(() =>
      createEvent("unknown-required-item-tag")
        .roles(soloRole("tribute"))
        .when(
          hasItemTag("tribute", {
            tags: ["unknown-tag" as ItemTag],
          }),
        )
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow(
      'Event "unknown-required-item-tag": requirement "has-item-tag" references unknown item tag "unknown-tag".',
    );
  });

  it("rejects a treatment status without a matching item", () => {
    expect(() =>
      createEvent("missing-treatment-item")
        .roles(soloRole("patient"))
        .when(hasTreatmentFor("patient", "inspired"))
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow('Event "missing-treatment-item": no item can treat status "inspired".');
  });

  it("rejects an unknown treatment status", () => {
    expect(() =>
      createEvent("unknown-treatment-status")
        .roles(soloRole("patient"))
        .when(hasTreatmentFor("patient", "unknown-status" as StatusEffectId))
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow(
      'Event "unknown-treatment-status": requirement "has-treatment-for" references unknown status "unknown-status".',
    );
  });

  it("rejects multiple required-item requirements for one role", () => {
    expect(() =>
      createEvent("multiple-required-items")
        .roles(soloRole("tribute"))
        .when(
          hasItem("tribute", {
            definitionIds: ["map"],
          }),

          hasItemTag("tribute", {
            tags: ["tool"],
          }),
        )
        .during("day")
        .resolve(createStaticStrategy()),
    ).toThrow(
      'Event "multiple-required-items": role "tribute" declares more than one required-item requirement.',
    );
  });
});
