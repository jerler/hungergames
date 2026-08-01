import { describe, expect, it } from "vitest";

import { sequenceRoundEvents } from "~/game/engine/event-sequencer";
import { createSurvivalChanges } from "~/game/events/event-change-builders";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventDefinition } from "~/game/events/event-schema";
import { STANDARD_DISSOLUTION_EVENTS } from "~/game/events/catalogue/relationships/standard-dissolution-events";
import { createForcedStandardTruceSeparationEvents } from "~/game/truces/forced-truce-separation";
import { createTruceInstance, STANDARD_TRUCE_EXPIRY_ROUND } from "~/game/truces/truce-engine";
import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

const NIGHT_THREE = {
  day: 3,
  period: "night",
} as const satisfies RoundReference;

function requireItem(tribute: GameTribute) {
  const item = tribute.inventory[0];

  if (!item) {
    throw new Error("Expected an inventory item.");
  }

  return item;
}

function withTruce(state: GameState, members: readonly GameTribute[]): GameState {
  return {
    ...state,
    truces: [
      createTruceInstance(
        "reservation-truce",
        members.map((member) => member.id),
        {
          day: 1,
          period: "night",
        },
        STANDARD_TRUCE_EXPIRY_ROUND,
      ),
    ],
  };
}

describe("opportunistic item reservation safety", () => {
  it("leaves preparation-committed gear with its owner during amicable separation", () => {
    const owner = withAuthoringTestItem(createAuthoringTestTribute({ id: "owner" }), "med-kit");
    const second = createAuthoringTestTribute({
      id: "second",
    });
    const third = createAuthoringTestTribute({
      id: "third",
    });
    const medKit = requireItem(owner);
    const state = withTruce(createAuthoringTestGame([owner, second, third]), [
      owner,
      second,
      third,
    ]);
    const definition = STANDARD_DISSOLUTION_EVENTS.find(
      (candidate) => candidate.id === "amicable-truce-separation-3",
    );

    if (!definition) {
      throw new Error("Missing three-person amicable separation event.");
    }

    const resolution = definition.resolve({
      eventId: "test:amicable-separation",
      state,
      round: NIGHT_THREE,
      livingTributes: state.tributes,
      participantsByRole: {
        members: [owner, second, third],
      },
      random: () => 0,
      unavailableItemInstanceIds: new Set([medKit.id]),
    });

    expect(
      resolution.changes.some(
        (change) => change.type === "transfer-item" && change.itemInstanceId === medKit.id,
      ),
    ).toBe(false);
    expect(resolution.changes).toContainEqual({
      type: "break-truce",
      truceId: state.truces[0]?.id,
      reason: "amicable",
    });
  });

  it("leaves preparation-committed gear with its owner during forced separation", () => {
    const owner = withAuthoringTestItem(createAuthoringTestTribute({ id: "owner" }), "med-kit");
    const second = createAuthoringTestTribute({
      id: "second",
    });
    const third = createAuthoringTestTribute({
      id: "third",
    });
    const outsider = createAuthoringTestTribute({
      id: "outsider",
    });
    const medKit = requireItem(owner);
    const state = withTruce(createAuthoringTestGame([owner, second, third, outsider]), [
      owner,
      second,
      third,
    ]);

    const events = createForcedStandardTruceSeparationEvents(
      state,
      NIGHT_THREE,
      new Set([medKit.id]),
    );

    expect(events).toHaveLength(1);
    expect(
      events[0]?.changes.some(
        (change) => change.type === "transfer-item" && change.itemInstanceId === medKit.id,
      ),
    ).toBe(false);
    expect(events[0]?.changes).toContainEqual({
      type: "break-truce",
      truceId: state.truces[0]?.id,
      reason: "amicable",
    });
  });

  it("rejects any remaining resolved candidate that reuses a committed item", () => {
    const owner = withAuthoringTestItem(createAuthoringTestTribute({ id: "owner" }), "med-kit");
    const actor = createAuthoringTestTribute({
      id: "actor",
    });
    const fallback = createAuthoringTestTribute({
      id: "fallback",
    });
    const medKit = requireItem(owner);
    const state = createAuthoringTestGame([owner, actor, fallback]);

    const conflictingDefinition: EventDefinition = {
      id: "test-opportunistic-conflict",
      category: "survival",
      periods: ["day"],
      baseWeight: 1_000_000,
      tags: ["survival", "item"],
      roles: [
        {
          id: "actor",
          count: 1,
          isEligible: (tribute) => tribute.id === actor.id,
        },
      ],
      resolve: () => ({
        text: "A hidden item transfer conflicts with preparation.",
        changes: [
          {
            type: "transfer-item",
            itemInstanceId: medKit.id,
            fromTributeId: owner.id,
            toTributeId: actor.id,
            reason: "test-opportunistic-conflict",
          },
        ],
      }),
    };

    const fallbackDefinition: EventDefinition = {
      id: "test-reservation-safe-fallback",
      category: "survival",
      periods: ["day"],
      baseWeight: 1,
      tags: ["survival"],
      roles: [
        {
          id: "actor",
          count: 1,
          isEligible: (tribute) => tribute.id === fallback.id,
        },
      ],
      resolve: () => ({
        text: "A reservation-safe fallback resolves.",
        changes: createSurvivalChanges([fallback]),
      }),
    };

    const events = sequenceRoundEvents(state, DAY_TWO, new Set([medKit.id]), {
      definitions: [conflictingDefinition, fallbackDefinition],
      targetEventCount: 1,
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.definitionId).toBe(fallbackDefinition.id);
  });
});
