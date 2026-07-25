import { describe, expect, it } from "vitest";

import { requireEventDefinition } from "~/game/events/testing/event-test-helpers";

import { TACTICAL_EVENTS } from "./tactical-events";

const EXPECTED_TACTICAL_EVENT_IDS = [
  "blowgun-poison-attack",
  "poison-vial-attack",
  "bear-trap-attack",
  "tripwire-attack",
  "firebomb-attack",
] as const;

describe("tactical encounter catalogue", () => {
  it("contains every focused tactical attack exactly once", () => {
    expect(TACTICAL_EVENTS.map((event) => event.id).sort()).toEqual(
      [...EXPECTED_TACTICAL_EVENT_IDS].sort(),
    );

    expect(new Set(TACTICAL_EVENTS.map((event) => event.id)).size).toBe(
      EXPECTED_TACTICAL_EVENT_IDS.length,
    );
  });

  it.each([
    ["blowgun-poison-attack", "blowgun"],

    ["poison-vial-attack", "poison-vial"],

    ["bear-trap-attack", "bear-trap"],

    ["tripwire-attack", "tripwire"],

    ["firebomb-attack", "firebomb"],
  ] as const)("%s requires its intended tactical item", (eventId, itemId) => {
    const definition = requireEventDefinition(TACTICAL_EVENTS, eventId);

    expect(definition.category).toBe("hazard");
    expect(definition.safetyResolution).toBeUndefined();

    const attackerRole = definition.roles.find((role) => role.id === "killer");

    expect(attackerRole).toMatchObject({
      count: 1,
      requiredItemDefinitionIds: [itemId],
      requiredItemRequireUsable: true,
    });
  });

  it("keeps firebomb behavior single-target", () => {
    const definition = requireEventDefinition(TACTICAL_EVENTS, "firebomb-attack");

    expect(definition.roles).toHaveLength(2);

    expect(definition.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "killer",

          count: 1,
        }),

        expect.objectContaining({
          id: "victim",

          count: 1,
        }),
      ]),
    );
  });
});
