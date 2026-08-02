import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { EVENT_CATALOGUE } from "~/game/events/catalogue";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";

import { LOW_LUCK_EVENTS } from "./low-events";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

function withLuck(tribute: GameTribute, luck: 1 | 2 | 3 | 4 | 5): GameTribute {
  return {
    ...tribute,
    snapshot: {
      ...tribute.snapshot,
      stats: {
        ...tribute.snapshot.stats,
        luck,
      },
    },
  };
}

function withStatus(tribute: GameTribute, statusId: "hungry" | "thirsty"): GameTribute {
  return {
    ...tribute,
    statuses: [
      ...tribute.statuses,
      createStatusEffectInstance(
        `fixture:${tribute.id}:${statusId}`,
        tribute.id,
        statusId,
        1,
        DAY_TWO,
      ),
    ],
  };
}

function requireEvent(id: string): EventDefinition {
  const definition = LOW_LUCK_EVENTS.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing Low-Luck Batch 2 event "${id}".`);
  }

  return definition;
}

function context(
  definition: EventDefinition,
  state: GameState,
  participantsByRole: EventResolutionContext["participantsByRole"],
  itemsByRole?: EventResolutionContext["itemsByRole"],
): EventResolutionContext {
  return {
    eventId: `test:${definition.id}`,
    state: {
      ...state,
      currentRound: DAY_TWO,
    },
    round: DAY_TWO,
    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    participantsByRole,
    itemsByRole,
    random: () => 0.5,
    unavailableItemInstanceIds: new Set<string>(),
  };
}

describe("low-Luck events", () => {
  it("registers all thirteen Batch 2 Day concepts exactly once", () => {
    expect(LOW_LUCK_EVENTS).toHaveLength(13);
    expect(new Set(LOW_LUCK_EVENTS.map((event) => event.id)).size).toBe(13);
    expect(LOW_LUCK_EVENTS.every((event) => EVENT_CATALOGUE.includes(event))).toBe(true);
    expect(
      LOW_LUCK_EVENTS.every((event) => event.periods.length === 1 && event.periods[0] === "day"),
    ).toBe(true);
  });

  it("limits every actor role to luck one or two", () => {
    const low = withStatus(
      withStatus(withLuck(createAuthoringTestTribute({ id: "low" }), 2), "hungry"),
      "thirsty",
    );
    const average = withStatus(
      withStatus(withLuck(createAuthoringTestTribute({ id: "average" }), 3), "hungry"),
      "thirsty",
    );
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([low, average, target]);
    const roleContext = {
      state,
      round: DAY_TWO,
      livingTributes: state.tributes,
      participantsByRole: {},
    };

    for (const definition of LOW_LUCK_EVENTS) {
      const actorRole = definition.roles.find((role) => role.id === "actor");

      expect(actorRole?.isEligible, definition.id).toBeDefined();
      expect(actorRole?.isEligible?.(low, roleContext), definition.id).toBe(true);
      expect(actorRole?.isEligible?.(average, roleContext), definition.id).toBe(false);
    }
  });

  it("resolves Camoufailure as a credited kill with death loot", () => {
    const actor = withAuthoringTestItem(
      withLuck(createAuthoringTestTribute({ id: "actor" }), 1),
      "map",
    );
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent("low-luck-camoufailure");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        target: [target],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: actor.id,
        killerTributeIds: [target.id],
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "transfer-item",
        fromTributeId: actor.id,
        toTributeId: target.id,
        reason: "death-loot",
      }),
    );
  });

  it("uses an owned weapon for Nature Calls when one is selected", () => {
    const actor = withAuthoringTestItem(
      withLuck(createAuthoringTestTribute({ id: "actor" }), 1),
      "map",
    );
    const target = withAuthoringTestItem(createAuthoringTestTribute({ id: "target" }), "knife");
    const weapon = target.inventory[0];

    if (!weapon) {
      throw new Error("Missing Nature Calls weapon fixture.");
    }

    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent("low-luck-nature-calls");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        {
          target: [
            {
              userTributeId: target.id,
              owner: target,
              item: weapon,
            },
          ],
        },
      ),
    );

    expect(resolution.text).toContain("knife");
    expect(resolution.text).not.toContain("suplexes");
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "use-item",
        tributeId: target.id,
        itemInstanceId: weapon.id,
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: actor.id,
        killerTributeIds: [target.id],
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "transfer-item",
        fromTributeId: actor.id,
        toTributeId: target.id,
      }),
    );
  });

  it("uses the unarmed Nature Calls ending when no weapon is selected", () => {
    const actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 2);
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent("low-luck-nature-calls");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        target: [target],
      }),
    );

    expect(resolution.text).toContain("suplexes");
    expect(
      resolution.changes.some(
        (change) => change.type === "use-item" || change.type === "consume-item",
      ),
    ).toBe(false);
  });

  it("supports bow, non-bow, and unarmed wasp-nest endings", () => {
    const actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 1);
    const unarmedTarget = createAuthoringTestTribute({
      id: "unarmed-target",
    });
    const bowTarget = withAuthoringTestItem(
      createAuthoringTestTribute({ id: "bow-target" }),
      "bow",
    );
    const knifeTarget = withAuthoringTestItem(
      createAuthoringTestTribute({ id: "knife-target" }),
      "knife",
    );
    const definition = requireEvent("low-luck-step-on-a-wasp-nest");

    const cases = [
      {
        target: bowTarget,
        item: bowTarget.inventory[0],
        expectedText: "lines up the shot",
      },
      {
        target: knifeTarget,
        item: knifeTarget.inventory[0],
        expectedText: "knife",
      },
      {
        target: unarmedTarget,
        item: undefined,
        expectedText: "swift twist",
      },
    ] as const;

    for (const testCase of cases) {
      const state = createAuthoringTestGame([actor, testCase.target]);
      const resolution = definition.resolve(
        context(
          definition,
          state,
          {
            actor: [actor],
            target: [testCase.target],
          },
          testCase.item
            ? {
                target: [
                  {
                    userTributeId: testCase.target.id,
                    owner: testCase.target,
                    item: testCase.item,
                  },
                ],
              }
            : undefined,
        ),
      );

      expect(resolution.text).toContain(testCase.expectedText);
      expect(resolution.changes).toContainEqual(
        expect.objectContaining({
          type: "eliminate-tribute",
          tributeId: actor.id,
          killerTributeIds: [testCase.target.id],
        }),
      );
    }
  });

  it("satisfies thirst while applying each authored consequence", () => {
    const actor = withStatus(withLuck(createAuthoringTestTribute({ id: "actor" }), 1), "thirsty");
    const state = createAuthoringTestGame([actor]);

    const cases = [
      {
        id: "low-luck-stuck-in-the-mud",
        statusId: "exhausted",
      },
      {
        id: "low-luck-water-landing",
        statusId: "injured",
      },
    ] as const;

    for (const testCase of cases) {
      const definition = requireEvent(testCase.id);
      const resolution = definition.resolve(
        context(definition, state, {
          actor: [actor],
        }),
      );

      expect(resolution.changes).toContainEqual({
        type: "satisfy-survival-need",
        tributeId: actor.id,
        need: "water",
      });
      expect(resolution.changes).toContainEqual(
        expect.objectContaining({
          type: "apply-status",
          tributeId: actor.id,
          status: expect.objectContaining({
            definitionId: testCase.statusId,
          }),
        }),
      );
    }
  });

  it("leaves failed hungry and thirsty searches unresolved", () => {
    const hungry = withStatus(withLuck(createAuthoringTestTribute({ id: "hungry" }), 2), "hungry");
    const thirsty = withStatus(
      withLuck(createAuthoringTestTribute({ id: "thirsty" }), 2),
      "thirsty",
    );

    for (const id of [
      "low-luck-rabbit-hole",
      "low-luck-foraging-dignity",
      "low-luck-foraging-dignity-again",
      "low-luck-berry-unfortunate",
    ]) {
      const definition = requireEvent(id);
      const state = createAuthoringTestGame([hungry]);
      const resolution = definition.resolve(
        context(definition, state, {
          actor: [hungry],
        }),
      );

      expect(
        resolution.changes.some(
          (change) => change.type === "satisfy-survival-need" && change.need === "food",
        ),
        id,
      ).toBe(false);
    }

    const lastSip = requireEvent("low-luck-last-sip");
    const resolution = lastSip.resolve(
      context(lastSip, createAuthoringTestGame([thirsty]), {
        actor: [thirsty],
      }),
    );

    expect(
      resolution.changes.some(
        (change) => change.type === "satisfy-survival-need" && change.need === "water",
      ),
    ).toBe(false);
  });

  it("injures Rabbit Hole without satisfying hunger", () => {
    const actor = withStatus(withLuck(createAuthoringTestTribute({ id: "actor" }), 1), "hungry");
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent("low-luck-rabbit-hole");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: actor.id,
        status: expect.objectContaining({
          definitionId: "injured",
        }),
      }),
    );
    expect(
      resolution.changes.some(
        (change) => change.type === "satisfy-survival-need" && change.need === "food",
      ),
    ).toBe(false);
  });

  it("applies Grounded Hog and Bird Strike statuses", () => {
    const actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 2);
    const state = createAuthoringTestGame([actor]);

    const cases = [
      {
        id: "low-luck-grounded-hog",
        statusId: "injured",
      },
      {
        id: "low-luck-bird-strike",
        statusId: "disoriented",
      },
    ] as const;

    for (const testCase of cases) {
      const definition = requireEvent(testCase.id);
      const resolution = definition.resolve(
        context(definition, state, {
          actor: [actor],
        }),
      );

      expect(resolution.changes).toContainEqual(
        expect.objectContaining({
          type: "apply-status",
          tributeId: actor.id,
          status: expect.objectContaining({
            definitionId: testCase.statusId,
          }),
        }),
      );
    }
  });

  it("keeps Personal Rain Cloud mechanically harmless", () => {
    const actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 1);
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent("low-luck-personal-rain-cloud");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
      }),
    );

    expect(resolution.changes).toEqual([
      {
        type: "increment-statistic",
        tributeId: actor.id,
        statistic: "eventsSurvived",
        amount: 1,
      },
    ]);
  });
});
