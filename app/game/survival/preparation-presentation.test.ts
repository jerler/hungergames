import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";

import type {
  GameChange,
  GameTribute,
  PreparationEventDetails,
  ResolvedEvent,
} from "~/game/types/game-state";

import { createPreparationFeedPresentation } from "./preparation-presentation";

const TEST_ROUND = {
  day: 2,
  period: "night",
} as const;

function createNamedTribute(id: string, name: string): GameTribute {
  const tribute = createAuthoringTestTribute({
    id,
  });

  return {
    ...tribute,

    snapshot: {
      ...tribute.snapshot,
      name,
    },
  };
}

const ACTOR = createNamedTribute("actor", "Katniss");

const OWNER = createNamedTribute("owner", "Peeta");

function createPreparationEvent(
  id: string,
  preparation: PreparationEventDetails,
  changes: readonly GameChange[] = [],
): ResolvedEvent {
  return {
    id,
    definitionId: id,

    kind: "preparation",
    resolutionMode: "standard",

    round: TEST_ROUND,

    participantTributeIds: [preparation.actingTributeId],

    text: `${id} occurred.`,

    changes: [...changes],
    preparation,
  };
}

function createAppliedStatusChange(
  statusId: Extract<
    GameChange,
    {
      type: "apply-status";
    }
  >["status"]["definitionId"],
): Extract<
  GameChange,
  {
    type: "apply-status";
  }
> {
  return {
    type: "apply-status",

    tributeId: ACTOR.id,

    status: {
      id: `status-${statusId}`,
      definitionId: statusId,
      severity: 1,
      remainingRounds: 2,

      sourceEventId: `event-${statusId}`,

      sourceTributeId: null,

      appliedRound: TEST_ROUND,
    },
  };
}

describe("preparation feed presentation", () => {
  it("groups preparation in a stable player-facing order", () => {
    const events = [
      createPreparationEvent("camouflage", {
        mechanic: "camouflage-preparation",

        actingTributeId: ACTOR.id,
      }),

      createPreparationEvent("hydration", {
        mechanic: "hydration-consumption",

        actingTributeId: ACTOR.id,

        affectedNeed: "water",
      }),

      createPreparationEvent("medical", {
        mechanic: "medical-treatment",

        actingTributeId: ACTOR.id,
      }),
    ];

    const groups = createPreparationFeedPresentation(events, [ACTOR, OWNER]);

    expect(groups.map((group) => group.id)).toEqual([
      "medical-care",
      "food-and-hydration",
      "camouflage",
    ]);
  });

  it("shows borrowed ownership, remaining uses, and hydration impact", () => {
    const event = createPreparationEvent("hydration", {
      mechanic: "hydration-consumption",

      actingTributeId: ACTOR.id,

      itemInstanceId: "water-instance",

      itemDefinitionId: "water",

      itemOwnerTributeId: OWNER.id,

      usesRemainingAfter: 0,

      affectedNeed: "water",

      affectedStatusIds: ["thirsty", "dehydrated"],
    });

    const presentation = createPreparationFeedPresentation([event], [ACTOR, OWNER])[0]?.events[0];

    expect(presentation).toMatchObject({
      actingTributeName: "Katniss",

      itemLabel: "Fresh water",

      borrowedFromLabel: "Peeta",

      remainingUsesLabel: "No uses remaining",

      impactTone: "positive",
    });

    expect(presentation?.impactDetails).toEqual([
      "Need restored: Hydration.",

      "Statuses resolved: Thirsty and Dehydrated.",
    ]);
  });

  it("explains medical treatment impact", () => {
    const event = createPreparationEvent("medical", {
      mechanic: "medical-treatment",

      actingTributeId: ACTOR.id,

      affectedStatusIds: ["injured", "bleeding"],
    });

    const presentation = createPreparationFeedPresentation([event], [ACTOR])[0]?.events[0];

    expect(presentation?.impactDetails).toEqual(["Statuses treated: Injured and Bleeding."]);
  });

  it("shows failed rest and its additional consequence", () => {
    const event = createPreparationEvent(
      "night-rest",
      {
        mechanic: "night-rest-preparation",

        actingTributeId: ACTOR.id,

        restQuality: "unsheltered",
      },

      [createAppliedStatusChange("burned")],
    );

    const presentation = createPreparationFeedPresentation([event], [ACTOR])[0]?.events[0];

    expect(presentation?.impactTone).toBe("warning");

    expect(presentation?.impactDetails).toEqual([
      "Rest result: Unsheltered.",

      "Additional consequence: Burned.",
    ]);
  });

  it("shows successful camouflage", () => {
    const event = createPreparationEvent(
      "camouflage",
      {
        mechanic: "camouflage-preparation",

        actingTributeId: ACTOR.id,
      },

      [createAppliedStatusChange("hidden")],
    );

    const presentation = createPreparationFeedPresentation([event], [ACTOR])[0]?.events[0];

    expect(presentation?.impactDetails).toEqual(["Camouflage result: Hidden."]);

    expect(presentation?.impactTone).toBe("positive");
  });

  it("shows camouflage attempts without a lasting effect", () => {
    const event = createPreparationEvent("failed-camouflage", {
      mechanic: "camouflage-preparation",

      actingTributeId: ACTOR.id,
    });

    const presentation = createPreparationFeedPresentation([event], [ACTOR])[0]?.events[0];

    expect(presentation?.impactDetails).toEqual(["Camouflage result: No lasting concealment."]);

    expect(presentation?.impactTone).toBe("neutral");
  });

  it("shows morning rest consequences", () => {
    const event = createPreparationEvent(
      "morning-rest",
      {
        mechanic: "morning-rest-resolution",

        actingTributeId: ACTOR.id,

        restQuality: "comfortable",

        affectedStatusIds: ["well-rested"],
      },

      [createAppliedStatusChange("well-rested")],
    );

    const presentation = createPreparationFeedPresentation([event], [ACTOR])[0]?.events[0];

    expect(presentation?.impactDetails).toEqual([
      "Morning result: Rested comfortably.",

      "Status gained: Well Rested.",
    ]);
  });
});
