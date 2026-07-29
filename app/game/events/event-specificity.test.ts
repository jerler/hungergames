// Phase 2 event specificity tests.
import { describe, expect, it } from "vitest";

import { createSeededRandom, selectWeightedItem } from "~/game/engine/random";
import { createEvent } from "~/game/events/authoring/builder/create-event";
import { hasItem } from "~/game/events/authoring/requirements/item-requirements";
import { inActiveTruce } from "~/game/events/authoring/requirements/relationship-requirements";
import { result } from "~/game/events/authoring/outcomes/result";
import { always } from "~/game/events/authoring/strategies/always";
import {
  getEventDefinitionSpecificityMultiplier,
  getEventSpecificityBreakdown,
  getEventSpecificityMultiplier,
} from "~/game/events/event-specificity";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

const DAY_ROUND = {
  day: 2,
  period: "day",
} as const;

function createContext(): EventSelectionContext {
  const tribute = createAuthoringTestTribute();
  const state = {
    ...createAuthoringTestGame([tribute]),
    currentRound: DAY_ROUND,
  };

  return {
    state,
    round: DAY_ROUND,
    livingTributes: state.tributes,
  };
}

function createGenericDefinition(id: string): EventDefinition {
  return {
    id,
    category: "survival",
    periods: ["day"],
    baseWeight: 2,
    tags: ["survival"],
    roles: [
      {
        id: "actor",
        count: 1,
      },
    ],
    resolve: () => ({
      text: "A general event occurs.",
      changes: [],
    }),
  };
}

describe("event specificity", () => {
  it("compiles declarative truce and item requirements into an explainable 3x multiplier", () => {
    const definition = createEvent("specific-truce-item-event")
      .solo("actor")
      .when(
        inActiveTruce("actor"),
        hasItem("actor", {
          definitionIds: ["knife"],
          access: "owned",
        }),
      )
      .category("survival")
      .tags("survival", "truce", "item")
      .during("day")
      .weight(2)
      .resolve(
        always(
          result({
            text: "A specific event occurs.",
          }),
        ),
      );

    expect(definition.selectionProfile).toEqual({
      specificityScore: 4,
      specificityReasons: ["truce-requirement", "item-requirement"],
    });

    expect(getEventSpecificityBreakdown(definition)).toMatchObject({
      score: 4,
      multiplier: 3,
      source: "authored",
    });

    expect(getEventDefinitionWeight(definition, createContext())).toBe(6);
  });

  it("leaves unrestricted flavour events at their authored base weight", () => {
    const definition = createGenericDefinition("generic-event");

    expect(getEventSpecificityBreakdown(definition)).toEqual({
      score: 0,
      multiplier: 1,
      source: "none",
      reasons: [],
    });

    expect(getEventDefinitionWeight(definition, createContext())).toBe(2);
  });

  it("gives direct legacy definitions a smaller structural fallback", () => {
    const definition: EventDefinition = {
      ...createGenericDefinition("legacy-required-item-event"),
      isEligible: () => true,
      roles: [
        {
          id: "actor",
          count: 1,
          isEligible: () => true,
          requiredItemDefinitionIds: ["knife"],
          itemAccess: "owned",
        },
      ],
    };

    expect(getEventSpecificityBreakdown(definition)).toMatchObject({
      score: 3,
      multiplier: 2.5,
      source: "structural",
      reasons: ["custom-eligibility", "item-requirement"],
    });
  });

  it("caps specificity rather than allowing a narrow event to become guaranteed", () => {
    expect(getEventSpecificityMultiplier(100)).toBe(4);
  });

  it("produces the expected deterministic selection advantage without guaranteeing the specific event", () => {
    const generic = createGenericDefinition("generic-choice");

    const specific: EventDefinition = {
      ...createGenericDefinition("specific-choice"),
      selectionProfile: {
        specificityScore: 4,
        specificityReasons: ["truce-requirement", "item-requirement"],
      },
    };

    const context = createContext();
    const random = createSeededRandom("phase-2-specificity-distribution");

    let specificSelections = 0;
    const iterations = 10_000;

    for (let index = 0; index < iterations; index += 1) {
      const selected = selectWeightedItem(
        [generic, specific],
        (definition) => getEventDefinitionWeight(definition, context),
        random,
      );

      if (selected.id === specific.id) {
        specificSelections += 1;
      }
    }

    const selectionRate = specificSelections / iterations;

    expect(selectionRate).toBeGreaterThan(0.72);
    expect(selectionRate).toBeLessThan(0.78);
    expect(getEventDefinitionSpecificityMultiplier(specific)).toBe(3);
  });
});
