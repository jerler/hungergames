import { describe, expect, it } from "vitest";

import { sequenceRoundEvents } from "~/game/engine/event-sequencer";
import { getRoundEventTargetCount } from "~/game/engine/stat-formulas";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { EVENT_CATALOGUE } from "~/game/events/catalogue";
import { ENVIRONMENTAL_EVENTS } from "~/game/events/catalogue/encounters/environmental-events";
import { isEventDefinitionEligible } from "~/game/events/event-eligibility";
import { selectEventParticipants } from "~/game/events/participant-selection";
import type { EventDefinition, EventTag } from "~/game/events/event-schema";
import { resolveEventWithParticipants } from "~/game/events/testing/event-test-helpers";
import { validateNightCataloguePolicy } from "~/game/events/validation/validate-event-catalogues";
import type { GameState, RoundReference } from "~/game/types/game-state";

const NIGHT_ROUND = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

function createPolicyEvent(id: string, tags: readonly EventTag[]): EventDefinition {
  return {
    id,
    category: "survival",

    periods: ["night"],
    baseWeight: 1,
    tags,

    roles: [
      {
        id: "tribute",
        count: 1,
      },
    ],

    resolve: () => ({
      text: "Policy test event.",
      changes: [],
    }),
  };
}

function createNightGame(livingTributeCount: number): GameState {
  const tributes = Array.from(
    {
      length: livingTributeCount,
    },
    (_, index) =>
      createAuthoringTestTribute({
        id: `night-tribute-${index + 1}`,
        name: `Night Tribute ${index + 1}`,
      }),
  );

  return {
    ...createAuthoringTestGame(tributes),

    seed: `night-catalogue-${livingTributeCount}`,
    currentRound: NIGHT_ROUND,
    phase: "round-events",
  };
}

function requireEnvironmentalEvent(eventId: string): EventDefinition {
  const definition = ENVIRONMENTAL_EVENTS.find((candidate) => candidate.id === eventId);

  if (!definition) {
    throw new Error(`Missing environmental event "${eventId}".`);
  }

  return definition;
}

describe("night catalogue", () => {
  it("rejects natural-resource creation at night", () => {
    expect(() =>
      validateNightCataloguePolicy([createPolicyEvent("night-foraging", ["resource"])]),
    ).toThrow(/natural-resource events must be day-only/i);
  });

  it("allows night events that transfer existing inventory", () => {
    expect(() =>
      validateNightCataloguePolicy([createPolicyEvent("night-theft", ["item"])]),
    ).not.toThrow();
  });

  it("contains no resource-tagged event that can run at night", () => {
    const violations = EVENT_CATALOGUE.filter(
      (event) =>
        event.periods.includes("night") && (event.tags as readonly EventTag[]).includes("resource"),
    ).map((event) => event.id);

    expect(violations).toEqual([]);
  });

  it("records both cold-weather events as failed shelter", () => {
    const state = createNightGame(2);
    const tribute = state.tributes[0];

    if (!tribute) {
      throw new Error("The night test game has no tribute.");
    }

    const coldRain = resolveEventWithParticipants({
      definition: requireEnvironmentalEvent("cold-rain"),
      state,

      participantsByRole: {
        tribute: [tribute],
      },

      randomValues: [0.5],
      round: NIGHT_ROUND,
    });

    expect(coldRain.text).toMatch(/shelter/i);

    expect(coldRain.changes).toContainEqual({
      type: "record-night-rest",

      tributeId: tribute.id,
      round: NIGHT_ROUND,
      quality: "unsheltered",
    });

    const freezingNight = resolveEventWithParticipants({
      definition: requireEnvironmentalEvent("freezing-night"),
      state,

      participantsByRole: {
        victim: [tribute],
      },

      randomValues: [0.5],
      round: NIGHT_ROUND,
    });

    expect(freezingNight.text).toMatch(/shelter/i);

    expect(freezingNight.changes).toContainEqual({
      type: "record-night-rest",

      tributeId: tribute.id,
      round: NIGHT_ROUND,
      quality: "unsheltered",
    });

    expect(freezingNight.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: tribute.id,
        causeId: "freezing-night",
      }),
    );
  });

  it.each([2, 3, 6, 12, 24] as const)(
    "retains enough eligible night events with %i living tributes",
    (livingTributeCount) => {
      const state = createNightGame(livingTributeCount);
      const livingTributes = state.tributes;

      const context = {
        state,
        round: NIGHT_ROUND,
        livingTributes,
      };

      const selectableDefinitions = EVENT_CATALOGUE.filter((definition) =>
        isEventDefinitionEligible(definition, context),
      ).filter(
        (definition) =>
          selectEventParticipants(definition, context, () => 0.5, new Set(), new Set()) !== null,
      );

      expect(selectableDefinitions.length).toBeGreaterThanOrEqual(
        getRoundEventTargetCount(livingTributeCount),
      );

      const events = sequenceRoundEvents(state, NIGHT_ROUND);

      expect(events.length).toBeGreaterThan(0);
    },
  );
});
