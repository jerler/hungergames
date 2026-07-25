import { describe, expect, it } from "vitest";

import { getForagingScore } from "~/game/engine/stat-formulas";
import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { ResolvedEvent } from "~/game/types/game-state";

import {
  getAcquiredItemIds,
  getAppliedStatuses,
  hasSurvivalCredit,
  selectAndResolveEvent,
} from "~/game/events/testing/event-test-helpers";

import { createHuntedFoodEvent, type HuntedFoodEventText } from "./hunted-food-event";

const TEXT = {
  criticalFailure: "Critical failure.",

  failure: "Failure.",

  success: "Success.",

  exceptionalSuccess: "Exceptional success.",
} satisfies HuntedFoodEventText;

describe("createHuntedFoodEvent", () => {
  it("supplies hunting defaults", () => {
    const definition = createHuntedFoodEvent("hunting-defaults", {
      foodId: "eggs",

      difficulty: 3,

      text: TEXT,
    });

    expect(definition).toMatchObject({
      id: "hunting-defaults",

      category: "survival",

      tags: ["survival", "item", "resource", "status"],

      periods: ["day"],

      baseWeight: 4,

      roles: [
        {
          id: "tribute",

          count: 1,
        },
      ],
    });

    expect(definition.roles[0]?.getWeight).toBe(getForagingScore);

    expect(definition.roles[0]?.requiredItemDefinitionIds).toBeUndefined();
  });

  it("compiles configured equipment as accessible and required", () => {
    const definition = createHuntedFoodEvent("equipped-hunt", {
      foodId: "rabbit",

      difficulty: 3,

      requiredEquipmentId: "trap-kit",

      text: TEXT,
    });

    expect(definition.roles[0]).toMatchObject({
      id: "tribute",

      requiredItemDefinitionIds: ["trap-kit"],

      requiredItemRequireUsable: true,

      itemAccess: "accessible",
    });
  });

  it("acquires natural food and consumes limited equipment", () => {
    const tribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "rabbit-hunter",

        stats: {
          brains: 3,
          brawn: 3,
          luck: 3,
        },
      }),

      "trap-kit",
    );

    const state = createAuthoringTestGame([tribute]);

    const definition = createHuntedFoodEvent("limited-equipment-hunt", {
      foodId: "rabbit",

      difficulty: 3,

      requiredEquipmentId: "trap-kit",

      text: TEXT,
    });

    const { selection, resolution } = selectAndResolveEvent({
      definition,
      state,

      livingTributes: [tribute],

      randomValues: [0.6],
    });

    expect(selection.selectedItemInstanceIds).toEqual([tribute.inventory[0]?.id]);

    expect(getAcquiredItemIds(resolution)).toEqual(["rabbit"]);
    expect(resolution.changes).not.toContainEqual(
      expect.objectContaining({
        type: "satisfy-survival-need",
      }),
    );
    expect(resolution.changes).toContainEqual({
      type: "consume-item",

      tributeId: tribute.id,

      itemInstanceId: tribute.inventory[0]?.id,

      uses: 1,

      reason: "limited-equipment-hunt",
    });

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "acquire-item",

        acquisitionSource: "natural-foraging",

        item: expect.objectContaining({
          definitionId: "rabbit",
        }),
      }),
    );

    expect(hasSurvivalCredit(resolution, tribute.id)).toBe(true);
  });

  it("records reusable equipment without consuming it", () => {
    const tribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "chicken-hunter",

        stats: {
          brains: 3,
          brawn: 3,
          luck: 3,
        },
      }),

      "slingshot",
    );

    const state = createAuthoringTestGame([tribute]);

    const definition = createHuntedFoodEvent("reusable-equipment-hunt", {
      foodId: "chicken",

      difficulty: 3,

      requiredEquipmentId: "slingshot",

      text: TEXT,
    });

    const { resolution } = selectAndResolveEvent({
      definition,
      state,

      livingTributes: [tribute],

      randomValues: [0.6],
    });

    expect(resolution.changes).toContainEqual({
      type: "use-item",

      tributeId: tribute.id,

      itemInstanceId: tribute.inventory[0]?.id,

      reason: "reusable-equipment-hunt",
    });
  });

  it("applies critical injury and ordinary failure exhaustion", () => {
    const tribute = createAuthoringTestTribute({
      id: "egg-hunter",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },
    });

    const state = createAuthoringTestGame([tribute]);

    const definition = createHuntedFoodEvent("dangerous-nest", {
      foodId: "eggs",

      difficulty: 3,

      text: TEXT,
    });

    const critical = selectAndResolveEvent({
      definition,
      state,

      livingTributes: [tribute],

      randomValues: [0],
    }).resolution;

    expect(getAppliedStatuses(critical)).toEqual([
      expect.objectContaining({
        definitionId: "injured",

        severity: 2,
      }),
    ]);

    const failure = selectAndResolveEvent({
      definition,
      state,

      livingTributes: [tribute],

      randomValues: [0.2],
    }).resolution;

    expect(getAppliedStatuses(failure)).toEqual([
      expect.objectContaining({
        definitionId: "exhausted",

        severity: 1,
      }),
    ]);
  });

  it("satisfies hunger and applies well-fed on exceptional success", () => {
    const baseTribute = createAuthoringTestTribute({
      id: "exceptional-hunter",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },
    });

    const tribute = {
      ...baseTribute,

      survival: {
        ...baseTribute.survival,
        roundsWithoutFood: 6,
      },

      statuses: [
        createStatusEffectInstance(
          "existing-starvation",
          baseTribute.id,
          "starving",
          1,
          AUTHORING_TEST_ROUND,
        ),
      ],
    };

    const state = createAuthoringTestGame([tribute]);

    const definition = createHuntedFoodEvent("exceptional-hunt", {
      foodId: "eggs",

      difficulty: 3,

      text: TEXT,
    });

    const { resolution } = selectAndResolveEvent({
      definition,
      state,

      livingTributes: [tribute],

      randomValues: [0.999],
    });

    expect(getAcquiredItemIds(resolution)).toEqual(["eggs"]);

    expect(resolution.changes).toContainEqual({
      type: "satisfy-survival-need",
      tributeId: tribute.id,
      need: "food",
    });

    expect(getAppliedStatuses(resolution)).toEqual([
      expect.objectContaining({
        definitionId: "well-fed",
        severity: 1,
      }),
    ]);

    const resolvedEvent = {
      id: `test:${definition.id}`,
      definitionId: definition.id,

      kind: "primary",
      resolutionMode: "standard",

      round: AUTHORING_TEST_ROUND,
      participantTributeIds: [tribute.id],

      text: resolution.text,
      changes: resolution.changes,
    } satisfies ResolvedEvent;

    const appliedState = applyResolvedEvent(state, resolvedEvent);
    const appliedTribute = appliedState.tributes.find((candidate) => candidate.id === tribute.id);

    if (!appliedTribute) {
      throw new Error("Expected the exceptional hunter after applying the event.");
    }

    expect(appliedTribute.survival.roundsWithoutFood).toBe(0);

    expect(appliedTribute.statuses.map((status) => status.definitionId)).toContain("well-fed");

    expect(appliedTribute.statuses.map((status) => status.definitionId)).not.toContain("hungry");

    expect(appliedTribute.statuses.map((status) => status.definitionId)).not.toContain("starving");
  });
});
