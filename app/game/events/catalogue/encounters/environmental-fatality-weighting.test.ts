import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
import { ENVIRONMENTAL_EVENTS } from "./environmental-events";

function requireEvent(id: string): EventDefinition {
  const definition = ENVIRONMENTAL_EVENTS.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing environmental event "${id}".`);
  }

  return definition;
}

function createContext(day: number, period: "day" | "night"): EventSelectionContext {
  const tributes = Array.from({ length: 12 }, (_, index) =>
    createAuthoringTestTribute({
      id: `environmental-weight-${index + 1}`,
    }),
  );
  const round = {
    day,
    period,
  } as const;
  const state = {
    ...createAuthoringTestGame(tributes),
    currentRound: round,
  };

  return {
    state,
    round,
    livingTributes: state.tributes,
  };
}

describe("broad environmental fatality weighting", () => {
  it.each(["river-current", "fallen-cliff"] as const)(
    "reduces %s only during later Day rounds",
    (eventId) => {
      const definition = requireEvent(eventId);
      const openingDayWeight = getEventDefinitionWeight(definition, createContext(1, "day"));
      const laterDayWeight = getEventDefinitionWeight(definition, createContext(2, "day"));

      expect(definition.baseWeight).toBe(2);
      expect(laterDayWeight).toBeCloseTo(openingDayWeight * 0.6, 10);
    },
  );

  it("leaves fallen-cliff Night weighting unchanged", () => {
    const definition = requireEvent("fallen-cliff");
    const openingDayWeight = getEventDefinitionWeight(definition, createContext(1, "day"));
    const nightWeight = getEventDefinitionWeight(definition, createContext(2, "night"));

    expect(nightWeight).toBeCloseTo(openingDayWeight, 10);
  });

  it("retains broad eligibility while reducing concentration through weight", () => {
    const river = requireEvent("river-current");
    const fallenCliff = requireEvent("fallen-cliff");

    expect(river.isEligible).toBeUndefined();
    expect(river.roles[0]?.isEligible).toBeTypeOf("function");
    expect(fallenCliff.isEligible).toBeUndefined();
    expect(fallenCliff.roles[0]?.isEligible).toBeUndefined();
  });
});
