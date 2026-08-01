import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { createTruceInstance, STANDARD_TRUCE_EXPIRY_ROUND } from "~/game/truces/truce-engine";
import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";

import {
  STATUS_SPECIFIC_EVENT_CONCEPT_IDS,
  STATUS_SPECIFIC_EVENTS,
} from "./status-specific-events";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

const NIGHT_TWO = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

function requireEvent(id: string): EventDefinition {
  const definition = STATUS_SPECIFIC_EVENTS.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing status-specific event "${id}".`);
  }

  return definition;
}

function withStatus(
  tribute: GameTribute,
  statusId: "hungry" | "thirsty" | "exhausted" | "disoriented" | "poisoned",
  severity: 1 | 2 | 3 = 1,
  round: RoundReference = DAY_TWO,
): GameTribute {
  return {
    ...tribute,
    statuses: [
      ...tribute.statuses,
      createStatusEffectInstance(
        `fixture:${tribute.id}:${statusId}`,
        tribute.id,
        statusId,
        severity,
        round,
      ),
    ],
  };
}

function context(
  definition: EventDefinition,
  state: GameState,
  participantsByRole: EventResolutionContext["participantsByRole"],
  randomValue: number,
  round: RoundReference = DAY_TWO,
  itemsByRole?: EventResolutionContext["itemsByRole"],
): EventResolutionContext {
  return {
    eventId: `test:${definition.id}`,
    state: {
      ...state,
      currentRound: round,
    },
    round,
    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    participantsByRole,
    itemsByRole,
    random: () => randomValue,
  };
}

describe("status-specific events", () => {
  it("registers all 20 concepts as 28 unique definitions", () => {
    expect(STATUS_SPECIFIC_EVENT_CONCEPT_IDS).toHaveLength(20);
    expect(STATUS_SPECIFIC_EVENTS).toHaveLength(28);
    expect(new Set(STATUS_SPECIFIC_EVENTS.map((definition) => definition.id)).size).toBe(28);

    for (const definition of STATUS_SPECIFIC_EVENTS) {
      expect(definition.baseWeight).toBeGreaterThan(0);
      expect(definition.selectionProfile).toBeDefined();
    }
  });

  it("requires severe hunger for the bark buffet and can poison the actor", () => {
    const mild = withStatus(createAuthoringTestTribute({ id: "mild" }), "hungry", 1);
    const severe = withStatus(createAuthoringTestTribute({ id: "severe" }), "hungry", 2);
    const definition = requireEvent("status-emergency-bark-buffet");
    const role = definition.roles[0];

    if (!role?.isEligible) {
      throw new Error("Missing bark eligibility.");
    }

    const state = createAuthoringTestGame([mild, severe]);
    const selectionContext = {
      state,
      round: DAY_TWO,
      livingTributes: state.tributes,
      participantsByRole: {},
    };

    expect(role.isEligible(mild, selectionContext)).toBe(false);
    expect(role.isEligible(severe, selectionContext)).toBe(true);

    const resolution = definition.resolve(context(definition, state, { actor: [severe] }, 0));

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: severe.id,
        status: expect.objectContaining({
          definitionId: "poisoned",
        }),
      }),
    );
  });

  it("lets the last carrot produce its two-death critical failure", () => {
    const actor = withAuthoringTestItem(
      withStatus(createAuthoringTestTribute({ id: "actor" }), "hungry"),
      "knife",
    );
    const target = withAuthoringTestItem(
      withStatus(createAuthoringTestTribute({ id: "target" }), "hungry"),
      "map",
    );
    const bystander = createAuthoringTestTribute({
      id: "bystander",
    });
    const state = createAuthoringTestGame([actor, target, bystander]);
    const definition = requireEvent("status-last-edible-thing");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
          bystander: [bystander],
        },
        0,
      ),
    );
    const eliminations = resolution.changes.filter((change) => change.type === "eliminate-tribute");

    expect(eliminations).toHaveLength(2);
    expect(eliminations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tributeId: actor.id,
          killerTributeIds: [bystander.id],
        }),
        expect.objectContaining({
          tributeId: target.id,
          killerTributeIds: [bystander.id],
        }),
      ]),
    );
    expect(
      resolution.changes.filter(
        (change) => change.type === "transfer-item" && change.toTributeId === bystander.id,
      ),
    ).toHaveLength(2);
  });

  it("feeds every hungry member during truce rationing", () => {
    const actor = withStatus(createAuthoringTestTribute({ id: "actor" }), "hungry");
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({ id: "target" }),
      "cornucopia-provisions",
    );
    const bystander = withStatus(
      createAuthoringTestTribute({
        id: "bystander",
      }),
      "hungry",
    );
    const baseState = createAuthoringTestGame([actor, target, bystander]);
    const state = {
      ...baseState,
      truces: [
        createTruceInstance(
          "rationing-truce",
          [actor.id, target.id, bystander.id],
          {
            day: 1,
            period: "night",
          },
          STANDARD_TRUCE_EXPIRY_ROUND,
        ),
      ],
    };
    const definition = requireEvent("status-rationing-becomes-personal-3");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          members: [actor, target, bystander],
        },
        0.5,
        NIGHT_TWO,
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
        tributeId: bystander.id,
        need: "food",
      },
    ]);
  });

  it("transfers and consumes caffeine for the exhausted actor", () => {
    const actor = withStatus(createAuthoringTestTribute({ id: "actor" }), "exhausted", 2);
    const target = withAuthoringTestItem(createAuthoringTestTribute({ id: "target" }), "coffee");
    const coffee = target.inventory[0];

    if (!coffee) {
      throw new Error("Missing coffee fixture.");
    }

    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent("status-caffeine-arbitration");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        0.5,
        DAY_TWO,
        {
          target: [
            {
              userTributeId: target.id,
              owner: target,
              item: coffee,
            },
          ],
        },
      ),
    );

    expect(resolution.changes).toContainEqual({
      type: "transfer-item",
      itemInstanceId: coffee.id,
      fromTributeId: target.id,
      toTributeId: actor.id,
      reason: "caffeine-arbitration",
    });
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",
        tributeId: actor.id,
        itemInstanceId: coffee.id,
      }),
    );
    expect(resolution.changes).toContainEqual({
      type: "satisfy-survival-need",
      tributeId: actor.id,
      need: "water",
    });
  });

  it("lets a failed watch raid steal the truce inventory and kill the watcher", () => {
    const actor = withStatus(
      withAuthoringTestItem(createAuthoringTestTribute({ id: "actor" }), "map"),
      "exhausted",
    );
    const ally = withAuthoringTestItem(createAuthoringTestTribute({ id: "ally" }), "knife");
    const target = createAuthoringTestTribute({
      id: "target",
    });
    const baseState = createAuthoringTestGame([actor, ally, target]);
    const state = {
      ...baseState,
      truces: [
        createTruceInstance(
          "watch-truce",
          [actor.id, ally.id],
          {
            day: 1,
            period: "night",
          },
          STANDARD_TRUCE_EXPIRY_ROUND,
        ),
      ],
    };
    const definition = requireEvent("status-watch-ends-early-2");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          members: [ally],
          target: [target],
        },
        0.5,
        NIGHT_TWO,
      ),
    );

    expect(
      resolution.changes.filter(
        (change) => change.type === "transfer-item" && change.toTributeId === target.id,
      ),
    ).toHaveLength(2);
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: actor.id,
        killerTributeIds: [target.id],
      }),
    );
  });

  it("keeps the three hallucinatory deaths loot-free", () => {
    const actor = withStatus(createAuthoringTestTribute({ id: "actor" }), "disoriented", 2);
    const observer1 = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "observer-1",
      }),
      "knife",
    );
    const observer2 = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "observer-2",
      }),
      "map",
    );
    const observer3 = createAuthoringTestTribute({
      id: "observer-3",
    });
    const state = createAuthoringTestGame([actor, observer1, observer2, observer3]);
    const definition = requireEvent("status-hallucinatory-jury-crossfire");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          observers: [observer1, observer2, observer3],
        },
        0.5,
      ),
    );

    expect(resolution.changes.filter((change) => change.type === "eliminate-tribute")).toHaveLength(
      3,
    );
    expect(resolution.changes.some((change) => change.type === "transfer-item")).toBe(false);
  });

  it("trades the actor's pack for poison treatment", () => {
    const actor = withAuthoringTestItem(
      withStatus(createAuthoringTestTribute({ id: "actor" }), "poisoned"),
      "knife",
    );
    const target = withAuthoringTestItem(createAuthoringTestTribute({ id: "target" }), "antidote");
    const antidote = target.inventory[0];

    if (!antidote) {
      throw new Error("Missing antidote fixture.");
    }

    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent("status-antidote-price");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        0.5,
        DAY_TWO,
        {
          target: [
            {
              userTributeId: target.id,
              owner: target,
              item: antidote,
            },
          ],
        },
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "transfer-item",
        fromTributeId: actor.id,
        toTributeId: target.id,
      }),
    );
    expect(resolution.changes).toContainEqual({
      type: "remove-status",
      tributeId: actor.id,
      statusId: actor.statuses[0]?.id,
    });
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",
        tributeId: target.id,
        itemInstanceId: antidote.id,
      }),
    );
  });
});
