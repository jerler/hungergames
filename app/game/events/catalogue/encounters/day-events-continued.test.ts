import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { createTruceInstance } from "~/game/truces/truce-engine";

import { DAY_EVENTS_16_33 } from "./day-events-continued";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const;

function requireEvent(id: string): EventDefinition {
  const event = DAY_EVENTS_16_33.find((definition) => definition.id === id);

  if (!event) {
    throw new Error(`Missing Day event "${id}".`);
  }

  return event;
}

function context(
  definition: EventDefinition,
  state: EventResolutionContext["state"],
  participantsByRole: EventResolutionContext["participantsByRole"],
  randomValue: number,
  itemsByRole?: EventResolutionContext["itemsByRole"],
): EventResolutionContext {
  return {
    eventId: `test:${definition.id}`,
    state,
    round: DAY_TWO,
    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    participantsByRole,
    itemsByRole,
    random: () => randomValue,
  };
}

describe("Day events 3.16 through 3.33", () => {
  it("registers every remaining non-crafting concept", () => {
    expect(DAY_EVENTS_16_33).toHaveLength(19);
    expect(new Set(DAY_EVENTS_16_33.map((definition) => definition.id)).size).toBe(19);

    for (const definition of DAY_EVENTS_16_33) {
      expect(definition.periods).toEqual(["day"]);
    }
  });

  it("keeps the distant-shape event solo", () => {
    const definition = requireEvent("day-scaring-off-another-tribute");

    expect(definition.roles).toHaveLength(1);
    expect(definition.roles[0]?.id).toBe("actor");
  });

  it("uses exact-item transfer mechanics for distracted theft", () => {
    const actor = createAuthoringTestTribute({
      id: "actor",
      stats: {
        brains: 5,
        brawn: 3,
        luck: 5,
      },
    });
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "target",
      }),
      "knife",
    );
    const item = target.inventory[0];

    if (!item) {
      throw new Error("The theft item is missing.");
    }

    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent("day-theft-while-distracted");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        0.75,
        {
          target: [
            {
              userTributeId: target.id,
              owner: target,
              item,
            },
          ],
        },
      ),
    );

    expect(resolution.changes).toContainEqual({
      type: "transfer-item",
      itemInstanceId: item.id,
      fromTributeId: target.id,
      toTributeId: actor.id,
      reason: "theft",
    });
  });

  it("lets both tributes eat during poison substitution", () => {
    const actor = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "actor",
        stats: {
          brains: 5,
          brawn: 3,
          luck: 3,
        },
      }),
      "poison-berries",
    );
    const target = createAuthoringTestTribute({
      id: "target",
    });
    const poison = actor.inventory[0];

    if (!poison) {
      throw new Error("The poison item is missing.");
    }

    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent("day-poison-a-tribute");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        0.5,
        {
          actor: [
            {
              userTributeId: actor.id,
              owner: actor,
              item: poison,
            },
          ],
        },
      ),
    );

    expect(
      resolution.changes.filter(
        (change) => change.type === "satisfy-survival-need" && change.need === "food",
      ),
    ).toEqual([
      {
        type: "satisfy-survival-need",
        tributeId: actor.id,
        need: "food",
      },
      {
        type: "satisfy-survival-need",
        tributeId: target.id,
        need: "food",
      },
    ]);

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",
        tributeId: actor.id,
        itemInstanceId: poison.id,
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: target.id,
        status: expect.objectContaining({
          definitionId: "poisoned",
          sourceTributeId: actor.id,
        }),
      }),
    );
  });

  it("satisfies both needs for both allied searchers", () => {
    const actor = createAuthoringTestTribute({
      id: "actor",
    });
    const target = createAuthoringTestTribute({
      id: "target",
    });
    const baseState = createAuthoringTestGame([actor, target]);
    const state = {
      ...baseState,
      truces: [
        createTruceInstance(
          "search-truce",
          [actor.id, target.id],
          {
            day: 1,
            period: "night",
          },
          DAY_TWO,
        ),
      ],
    };
    const definition = requireEvent("day-splitting-up-to-search");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          tributes: [actor, target],
        },
        0.5,
      ),
    );

    expect(
      resolution.changes.filter((change) => change.type === "satisfy-survival-need"),
    ).toHaveLength(4);
  });

  it("reduces severe exhaustion by two on a successful nap", () => {
    const original = createAuthoringTestTribute({
      id: "actor",
      stats: {
        brains: 3,
        brawn: 3,
        luck: 5,
      },
    });
    const actor = {
      ...original,
      statuses: [
        createStatusEffectInstance("existing-exhaustion", original.id, "exhausted", 3, DAY_TWO),
      ],
    };
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent("day-sneaking-a-nap");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
        },
        0.5,
      ),
    );

    expect(resolution.changes).toContainEqual({
      type: "remove-status",
      tributeId: actor.id,
      statusId: actor.statuses[0]?.id,
    });

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: actor.id,
        status: expect.objectContaining({
          definitionId: "exhausted",
          severity: 1,
        }),
      }),
    );
  });

  it("splits cave discovery into failure and shelter definitions", () => {
    expect(DAY_EVENTS_16_33.map((definition) => definition.id)).toEqual(
      expect.arrayContaining(["day-discovering-cave-failure", "day-discovering-cave-shelter"]),
    );
  });
});
