import { describe, expect, it } from "vitest";

import { eliminate } from "~/game/events/authoring/effects/fatal-effects";
import { applyStatus } from "~/game/events/authoring/effects/status-effects";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  getAppliedStatusIds,
  getEliminations,
  selectAndResolveEvent,
} from "~/game/events/testing/event-test-helpers";
import type { GameChange, RoundReference } from "~/game/types/game-state";

import {
  createNightRestEvent,
  NIGHT_REST_ITEM_IDS,
  type NightRestEventResults,
} from "./night-rest-event";

const NIGHT_ROUND = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

const RESULTS = {
  criticalFailure: {
    text: "Critical shelter failure.",
  },
  failure: {
    text: "Shelter failure.",
  },
  success: {
    text: "Shelter success.",
  },
  exceptionalSuccess: {
    text: "Exceptional shelter success.",
  },
} satisfies NightRestEventResults;

function getRecordedRestQualities(changes: readonly GameChange[]) {
  return changes.flatMap((change) =>
    change.type === "record-night-rest"
      ? [
          {
            tributeId: change.tributeId,
            quality: change.quality,
          },
        ]
      : [],
  );
}

describe("createNightRestEvent", () => {
  it("supplies natural night-shelter defaults", () => {
    const definition = createNightRestEvent("natural-rest-defaults", {
      results: RESULTS,
    });

    expect(definition).toMatchObject({
      id: "natural-rest-defaults",
      category: "survival",
      tags: ["survival", "status"],
      periods: ["night"],
      baseWeight: 4,
      roles: [
        {
          id: "tribute",
          count: 1,
        },
      ],
    });
  });

  it("records natural shelter success and failure through one family path", () => {
    const tribute = createAuthoringTestTribute();
    const state = createAuthoringTestGame([tribute]);

    const definition = createNightRestEvent("natural-rest-results", {
      results: RESULTS,
    });

    const success = selectAndResolveEvent({
      definition,
      state,
      livingTributes: [tribute],
      randomValues: [0.6],
      round: NIGHT_ROUND,
    }).resolution;

    expect(getRecordedRestQualities(success.changes)).toEqual([
      {
        tributeId: tribute.id,
        quality: "sheltered",
      },
    ]);

    const failure = selectAndResolveEvent({
      definition,
      state,
      livingTributes: [tribute],
      randomValues: [0.2],
      round: NIGHT_ROUND,
    }).resolution;

    expect(getRecordedRestQualities(failure.changes)).toEqual([
      {
        tributeId: tribute.id,
        quality: "unsheltered",
      },
    ]);
  });

  it("selects and uses a valid item-assisted rest item", () => {
    const tribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "equipped-camper",
      }),
      "blanket",
    );

    const state = createAuthoringTestGame([tribute]);

    const definition = createNightRestEvent("item-assisted-rest", {
      method: {
        type: "item-assisted",
      },
      results: RESULTS,
    });

    const { selection, resolution } = selectAndResolveEvent({
      definition,
      state,
      livingTributes: [tribute],
      randomValues: [0.5],
      round: NIGHT_ROUND,
    });

    expect(definition.roles[0]).toMatchObject({
      requiredItemDefinitionIds: NIGHT_REST_ITEM_IDS,
      requiredItemRequireUsable: true,
      itemAccess: "accessible",
    });

    expect(selection.selectedItemInstanceIds).toEqual([tribute.inventory[0]?.id]);

    expect(getRecordedRestQualities(resolution.changes)).toEqual([
      {
        tributeId: tribute.id,
        quality: "comfortable",
      },
    ]);

    expect(resolution.changes).toContainEqual({
      type: "use-item",
      tributeId: tribute.id,
      itemInstanceId: tribute.inventory[0]?.id,
      reason: "item-assisted-rest",
    });
  });

  it("supports guaranteed and failed authored rest outcomes", () => {
    const tribute = createAuthoringTestTribute();
    const state = createAuthoringTestGame([tribute]);

    const guaranteed = selectAndResolveEvent({
      definition: createNightRestEvent("guaranteed-rest", {
        method: {
          type: "guaranteed",
          quality: "sheltered",
        },
        results: RESULTS,
      }),
      state,
      livingTributes: [tribute],
      randomValues: [0.5],
      round: NIGHT_ROUND,
    }).resolution;

    expect(getRecordedRestQualities(guaranteed.changes)[0]?.quality).toBe("sheltered");

    const failed = selectAndResolveEvent({
      definition: createNightRestEvent("failed-rest", {
        method: {
          type: "failed",
        },
        results: RESULTS,
      }),
      state,
      livingTributes: [tribute],
      randomValues: [0.5],
      round: NIGHT_ROUND,
    }).resolution;

    expect(getRecordedRestQualities(failed.changes)[0]?.quality).toBe("unsheltered");
  });

  it("records shared shelter for both participants", () => {
    const tribute = createAuthoringTestTribute({
      id: "primary-camper",
    });

    const companion = createAuthoringTestTribute({
      id: "companion-camper",
    });

    const state = createAuthoringTestGame([tribute, companion]);

    const definition = createNightRestEvent("shared-shelter", {
      method: {
        type: "guaranteed",
        quality: "sheltered",
      },
      companionRoleId: "companion",
      results: RESULTS,
    });

    const { resolution } = selectAndResolveEvent({
      definition,
      state,
      livingTributes: [tribute, companion],
      randomValues: [0.5],
      round: NIGHT_ROUND,
    });

    expect(getRecordedRestQualities(resolution.changes)).toEqual(
      expect.arrayContaining([
        {
          tributeId: tribute.id,
          quality: "sheltered",
        },
        {
          tributeId: companion.id,
          quality: "sheltered",
        },
      ]),
    );

    expect(definition.tags).toContain("cooperative");
  });

  it("supports dangerous and fatal shelter outcomes", () => {
    const tribute = createAuthoringTestTribute({
      id: "cave-camper",
    });

    const state = createAuthoringTestGame([tribute]);

    const definition = createNightRestEvent("dangerous-cave-shelter", {
      results: {
        criticalFailure: {
          text: "The cave shelter collapses and buries the tribute.",
          effects: [
            eliminate("tribute", {
              causeId: "shelter-collapse",
              causeLabel: "Shelter collapse",
            }),
          ],
        },
        failure: {
          text: "The cave shelter shifts and injures the tribute.",
          effects: [applyStatus("tribute", "injured", 2)],
        },
        success: RESULTS.success,
        exceptionalSuccess: RESULTS.exceptionalSuccess,
      },
    });

    const dangerous = selectAndResolveEvent({
      definition,
      state,
      livingTributes: [tribute],
      randomValues: [0.2],
      round: NIGHT_ROUND,
    }).resolution;

    expect(getAppliedStatusIds(dangerous)).toContain("injured");

    const fatal = selectAndResolveEvent({
      definition,
      state,
      livingTributes: [tribute],
      randomValues: [0],
      round: NIGHT_ROUND,
    }).resolution;

    expect(fatal.text.toLowerCase()).toContain("shelter");
    expect(getEliminations(fatal)).toHaveLength(1);

    expect(definition).toMatchObject({
      category: "fatal",
      tags: expect.arrayContaining(["survival", "status", "fatal"]),
    });
  });
});
