import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";

import { DAY_EVENTS } from "./day-events";

const ROUND = {
  day: 2,
  period: "day",
} as const;

function requireEvent(id: string): EventDefinition {
  const event = DAY_EVENTS.find((definition) => definition.id === id);

  if (!event) {
    throw new Error(`Missing Day event "${id}".`);
  }

  return event;
}

function createContext(
  definition: EventDefinition,
  participantsByRole: EventResolutionContext["participantsByRole"],
  randomValue: number,
  options: {
    itemsByRole?: EventResolutionContext["itemsByRole"];
    state?: EventResolutionContext["state"];
  } = {},
): EventResolutionContext {
  const tributes = Object.values(participantsByRole).flat();
  const state = options.state ?? createAuthoringTestGame(tributes);

  return {
    eventId: `test:${definition.id}`,
    state,
    round: ROUND,
    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    participantsByRole,
    itemsByRole: options.itemsByRole,
    random: () => randomValue,
  };
}

describe("Day events 3.1 through 3.15", () => {
  it("registers exactly the first fifteen authored Day events", () => {
    expect(DAY_EVENTS).toHaveLength(15);
    expect(DAY_EVENTS.map((definition) => definition.id)).toEqual([
      "day-exploring-arena",
      "day-collecting-fruit",
      "day-working-together",
      "day-overhearing-conversation",
      "day-practising-weaponry",
      "day-thinking-about-home",
      "day-pricked-by-thorns",
      "day-searching-for-firewood",
      "day-picking-flowers",
      "day-ignoring-distant-smoke",
      "day-reaching-higher-ground",
      "day-discovering-river",
      "day-questioning-sanity",
      "day-hunting-for-food",
      "day-accidental-self-injury",
    ]);
  });

  it("keeps every definition Day-only with unique IDs", () => {
    expect(new Set(DAY_EVENTS.map((definition) => definition.id)).size).toBe(DAY_EVENTS.length);

    for (const definition of DAY_EVENTS) {
      expect(definition.periods).toEqual(["day"]);
    }
  });

  it("forms a standard truce and alerts both tributes", () => {
    const actor = createAuthoringTestTribute({
      id: "actor",
      name: "Actor",
    });
    const target = createAuthoringTestTribute({
      id: "target",
      name: "Target",
    });
    const definition = requireEvent("day-working-together");
    const state = createAuthoringTestGame([actor, target]);
    const resolution = definition.resolve(
      createContext(
        definition,
        {
          actor: [actor],
          target: [target],
        },
        0.5,
        {
          state,
        },
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "form-truce",
        truce: expect.objectContaining({
          tributeIds: ["actor", "target"],
          expiresAfterRound: {
            day: 2,
            period: "night",
          },
        }),
      }),
    );

    expect(
      resolution.changes.filter(
        (change) => change.type === "apply-status" && change.status.definitionId === "alert",
      ),
    ).toHaveLength(2);
  });

  it("turns firewood into naturally foraged kindling", () => {
    const actor = createAuthoringTestTribute({
      id: "actor",
    });
    const definition = requireEvent("day-searching-for-firewood");
    const resolution = definition.resolve(
      createContext(
        definition,
        {
          actor: [actor],
        },
        0.5,
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "acquire-item",
        tributeId: actor.id,
        acquisitionSource: "natural-foraging",
        item: expect.objectContaining({
          definitionId: "kindling",
        }),
      }),
    );
  });

  it("allows any selected usable weapon to support hunting", () => {
    const actor = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "actor",
        stats: {
          brains: 3,
          brawn: 5,
          luck: 3,
        },
      }),
      "greatsword",
    );
    const definition = requireEvent("day-hunting-for-food");
    const item = actor.inventory[0];

    if (!item) {
      throw new Error("Test weapon is missing.");
    }

    const resolution = definition.resolve(
      createContext(
        definition,
        {
          actor: [actor],
        },
        0.5,
        {
          state: createAuthoringTestGame([actor]),
          itemsByRole: {
            actor: [
              {
                userTributeId: actor.id,
                owner: actor,
                item,
              },
            ],
          },
        },
      ),
    );

    expect(resolution.text).toContain("greatsword");
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "use-item",
        itemInstanceId: item.id,
      }),
    );
  });

  it("conditions accidental injury on failed Luck checks", () => {
    const lowLuck = createAuthoringTestTribute({
      id: "low-luck",
      stats: {
        brains: 3,
        brawn: 3,
        luck: 1,
      },
    });
    const highLuck = createAuthoringTestTribute({
      id: "high-luck",
      stats: {
        brains: 3,
        brawn: 3,
        luck: 5,
      },
    });
    const definition = requireEvent("day-accidental-self-injury");

    const lowContext = {
      state: createAuthoringTestGame([lowLuck]),
      round: ROUND,
      livingTributes: [lowLuck],
    };
    const highContext = {
      state: createAuthoringTestGame([highLuck]),
      round: ROUND,
      livingTributes: [highLuck],
    };

    expect(definition.getWeightMultiplier?.(lowContext)).toBeGreaterThan(
      definition.getWeightMultiplier?.(highContext) ?? 0,
    );

    for (const randomValue of [0, 0.25, 0.5, 0.75, 0.999]) {
      const resolution = definition.resolve(
        createContext(
          definition,
          {
            actor: [lowLuck],
          },
          randomValue,
          {
            state: lowContext.state,
          },
        ),
      );

      expect(resolution.changes).toContainEqual(
        expect.objectContaining({
          type: "apply-status",
          tributeId: lowLuck.id,
          status: expect.objectContaining({
            definitionId: "injured",
          }),
        }),
      );
    }
  });

  it("conditions river discovery on successful Awareness checks", () => {
    const actor = createAuthoringTestTribute({
      id: "actor",
    });
    const definition = requireEvent("day-discovering-river");

    for (const randomValue of [0, 0.25, 0.5, 0.75, 0.999]) {
      const resolution = definition.resolve(
        createContext(
          definition,
          {
            actor: [actor],
          },
          randomValue,
        ),
      );

      expect(resolution.changes).toContainEqual({
        type: "satisfy-survival-need",
        tributeId: actor.id,
        need: "water",
      });
    }
  });

  it("keeps practise events limited to reusable weapons", () => {
    const definition = requireEvent("day-practising-weaponry");
    const role = definition.roles[0];

    expect(role?.requiredItemDefinitionIds).toContain("knife");
    expect(role?.requiredItemDefinitionIds).not.toContain("poison-vial");
  });

  it("does not require a real target for distant-shape events", () => {
    const definition = requireEvent("day-questioning-sanity");

    expect(definition.roles).toEqual([
      expect.objectContaining({
        id: "actor",
        count: 1,
      }),
    ]);
  });
});
