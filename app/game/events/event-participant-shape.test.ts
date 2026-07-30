import { describe, expect, it } from "vitest";

import { createEvent, customResolution, groupRole } from "~/game/events/authoring";
import {
  BLOODBATH_EVENT_CATALOGUE_FAMILIES,
  ORDINARY_EVENT_CATALOGUE_FAMILIES,
} from "~/game/events/catalogue/catalogue-families";
import {
  EVENT_PARTICIPANT_SHAPES,
  EVENT_PARTICIPANT_SHAPE_MULTIPLIERS,
  getEventParticipantCount,
  getEventParticipantShape,
  getEventParticipantShapeMultiplier,
  getParticipantShapeForCount,
  getParticipantShapeForTributeIds,
  getParticipantShapeMultiplier,
} from "~/game/events/event-participant-shape";
import type { EventDefinition } from "~/game/events/event-schema";
import { validateEventDefinition } from "~/game/events/validation/validate-event-definition";

function createDefinition(
  roles: EventDefinition["roles"],
  participantShape?: EventDefinition["participantShape"],
): EventDefinition {
  return {
    id: "participant-shape-test",
    category: "survival",
    periods: ["day"],
    baseWeight: 1,
    tags: ["survival"],
    ...(participantShape ? { participantShape } : {}),
    roles,
    resolve: () => ({
      text: "A participant-shape test occurs.",
      changes: [],
    }),
  };
}

describe("event participant shape", () => {
  it("classifies participant counts", () => {
    expect(getParticipantShapeForCount(1)).toBe("solo");
    expect(getParticipantShapeForCount(2)).toBe("pair");
    expect(getParticipantShapeForCount(3)).toBe("trio");
    expect(getParticipantShapeForCount(4)).toBe("group-four-plus");
    expect(getParticipantShapeForCount(12)).toBe("group-four-plus");
  });

  it("rejects invalid participant counts", () => {
    expect(() => getParticipantShapeForCount(0)).toThrow(/positive integer/i);
    expect(() => getParticipantShapeForCount(-1)).toThrow(/positive integer/i);
    expect(() => getParticipantShapeForCount(1.5)).toThrow(/positive integer/i);
  });

  it("counts distinct resolved participant IDs", () => {
    expect(getParticipantShapeForTributeIds(["one"])).toBe("solo");
    expect(getParticipantShapeForTributeIds(["one", "two"])).toBe("pair");
    expect(getParticipantShapeForTributeIds(["one", "two", "two"])).toBe("pair");
  });

  it("infers shape by summing compiled role counts", () => {
    const definition = createDefinition([
      { id: "actor", count: 1 },
      { id: "targets", count: 2 },
    ]);

    expect(getEventParticipantCount(definition)).toBe(3);
    expect(getEventParticipantShape(definition)).toBe("trio");
  });

  it("uses an explicit shape override when role count is not the intended model", () => {
    const definition = createDefinition(
      [
        { id: "actor", count: 1 },
        { id: "targets", count: 2 },
      ],
      "pair",
    );

    expect(getEventParticipantCount(definition)).toBe(3);
    expect(getEventParticipantShape(definition)).toBe("pair");
  });

  it("rejects invalid runtime participant-shape metadata", () => {
    const definition = {
      ...createDefinition([{ id: "tribute", count: 1 }]),
      participantShape: "crowd",
    } as unknown as EventDefinition;

    expect(() => validateEventDefinition(definition)).toThrow(
      /invalid participant-shape metadata/i,
    );
  });

  it("preserves participant-shape overrides through the authored builder", () => {
    const definition = createEvent("builder-participant-shape-test")
      .during("day")
      .roles(groupRole("tributes", 3))
      .participantShape("pair")
      .resolve(
        customResolution(() => ({
          text: "A builder participant-shape test occurs.",
          changes: [],
        })),
      );

    expect(definition.participantShape).toBe("pair");
    expect(getEventParticipantShape(definition)).toBe("pair");
  });

  it("defines a strong flat non-solo Bloodbath preference without escalating by size", () => {
    expect(EVENT_PARTICIPANT_SHAPE_MULTIPLIERS["bloodbath-cornucopia"]).toEqual({
      solo: 0.2,
      pair: 1,
      trio: 1,
      "group-four-plus": 1,
    });

    expect(EVENT_PARTICIPANT_SHAPE_MULTIPLIERS["bloodbath-flee"]).toEqual({
      solo: 0.2,
      pair: 1,
      trio: 1,
      "group-four-plus": 1,
    });
  });

  it("defines moderate later-Day weighting and neutral Night weighting", () => {
    expect(getParticipantShapeMultiplier("later-day", "solo")).toBe(0.8);
    expect(getParticipantShapeMultiplier("later-day", "pair")).toBe(1.1);
    expect(getParticipantShapeMultiplier("later-day", "trio")).toBe(1.15);
    expect(getParticipantShapeMultiplier("later-day", "group-four-plus")).toBe(1.15);

    for (const shape of EVENT_PARTICIPANT_SHAPES) {
      expect(getParticipantShapeMultiplier("night", shape)).toBe(1);
    }
  });

  it("returns the configured multiplier for a definition's inferred or overridden shape", () => {
    const inferredTrio = createDefinition([{ id: "tributes", count: 3 }]);
    const overriddenPair = createDefinition([{ id: "tributes", count: 3 }], "pair");

    expect(getEventParticipantShapeMultiplier("later-day", inferredTrio)).toBe(1.15);
    expect(getEventParticipantShapeMultiplier("later-day", overriddenPair)).toBe(1.1);
  });

  it("classifies every current catalogue definition", () => {
    const definitions = [
      ...BLOODBATH_EVENT_CATALOGUE_FAMILIES.flatMap((family) => family.events),
      ...ORDINARY_EVENT_CATALOGUE_FAMILIES.flatMap((family) => family.events),
    ] as readonly EventDefinition[];

    expect(definitions.length).toBeGreaterThan(0);

    for (const definition of definitions) {
      expect(EVENT_PARTICIPANT_SHAPES).toContain(getEventParticipantShape(definition));
    }
  });
});
