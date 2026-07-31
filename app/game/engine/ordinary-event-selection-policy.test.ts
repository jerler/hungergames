import { describe, expect, it } from "vitest";

import {
  canPreserveRemainingEventSlots,
  getOrdinaryEventParticipantShapeMultiplier,
  getSelectionReservedTributeIds,
} from "./ordinary-event-selection-policy";
import type { EventDefinition } from "~/game/events/event-schema";
import type { ParticipantSelection } from "~/game/events/participant-selection";
import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";

function createDefinition(id: string, participantCount: number): EventDefinition {
  return {
    id,
    category: "survival",
    tags: ["survival"],
    periods: ["day", "night"],
    baseWeight: 1,
    roles: [{ id: "tributes", count: participantCount }],
    resolve: () => ({
      text: `${id} occurs.`,
      changes: [],
    }),
  };
}

function createSelection(
  participantIds: readonly string[],
  hiddenOwnerIds: readonly string[] = [],
): ParticipantSelection {
  const participants = participantIds.map((id) => createAuthoringTestTribute({ id }));
  const hiddenOwners = hiddenOwnerIds.map((id) => createAuthoringTestTribute({ id }));

  return {
    participantsByRole: {
      tributes: participants,
    },
    participantTributeIds: [...participantIds],
    itemsByRole: {
      tributes: hiddenOwners.map((owner, index) => ({
        userTributeId: participantIds[0] ?? owner.id,
        owner,
        item: {
          id: `test-item-${index}`,
          definitionId: "knife",
          acquiredRound: {
            day: 1,
            period: "day",
          },
          sourceEventId: "test-source",
          usesRemaining: null,
        },
      })),
    },
    selectedItemInstanceIds: hiddenOwners.map((_, index) => `test-item-${index}`),
  };
}

describe("ordinary event selection policy", () => {
  it("uses moderate later-Day shape weighting", () => {
    const round = {
      day: 2,
      period: "day",
    } as const;

    expect(getOrdinaryEventParticipantShapeMultiplier(createDefinition("solo", 1), round)).toBe(
      0.8,
    );
    expect(getOrdinaryEventParticipantShapeMultiplier(createDefinition("pair", 2), round)).toBe(
      1.1,
    );
    expect(getOrdinaryEventParticipantShapeMultiplier(createDefinition("trio", 3), round)).toBe(
      1.15,
    );
    expect(getOrdinaryEventParticipantShapeMultiplier(createDefinition("group", 4), round)).toBe(
      1.15,
    );
  });

  it("keeps Night participant-shape weighting neutral", () => {
    const round = {
      day: 2,
      period: "night",
    } as const;

    for (const participantCount of [1, 2, 3, 4]) {
      expect(
        getOrdinaryEventParticipantShapeMultiplier(
          createDefinition(`night-${participantCount}`, participantCount),
          round,
        ),
      ).toBe(1);
    }
  });

  it("counts visible participants and hidden item owners once", () => {
    const selection = createSelection(["actor", "target"], ["actor", "hidden-owner"]);

    expect(getSelectionReservedTributeIds(selection)).toEqual(
      new Set(["actor", "target", "hidden-owner"]),
    );
  });

  it("blocks a large event when it would starve remaining event slots", () => {
    expect(
      canPreserveRemainingEventSlots({
        selection: createSelection(["one", "two", "three", "four", "five", "six"]),
        availableTributeCount: 6,
        remainingEventSlotCount: 1,
      }),
    ).toBe(false);

    expect(
      canPreserveRemainingEventSlots({
        selection: createSelection(["one", "two", "three", "four"]),
        availableTributeCount: 6,
        remainingEventSlotCount: 1,
      }),
    ).toBe(true);
  });

  it("allows a solo fallback when one tribute and one slot remain", () => {
    expect(
      canPreserveRemainingEventSlots({
        selection: createSelection(["last-tribute"]),
        availableTributeCount: 1,
        remainingEventSlotCount: 0,
      }),
    ).toBe(true);
  });
});
