import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { resolveAuthoredEvent } from "~/game/events/authoring/testing/resolve-authored-event";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import {
  always,
  applyStatus,
  createEvent,
  groupRole,
  maximumStat,
  minimumStat,
  notInSameTruce,
  result,
  soloRole,
  survived,
} from "~/game/events/authoring";

import type { ParticipantSelectionContext } from "~/game/events/event-schema";
import type { GameState } from "~/game/types/game-state";

const ROUND = {
  day: 2,
  period: "day",
} as const;

function createStaticStrategy() {
  return always(
    result({
      text: "The event resolves.",
    }),
  );
}

function createSelectionContext(state: GameState): ParticipantSelectionContext {
  return {
    state,
    round: ROUND,

    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),

    participantsByRole: {},
  };
}

describe("EventBuilder", () => {
  it("compiles a solo event into a plain EventDefinition", () => {
    const definition = createEvent("builder-smoke-test")
      .solo()
      .during("day")
      .weight(2)
      .category("survival")
      .tags("survival")
      .resolve(createStaticStrategy());

    expect(definition).toMatchObject({
      id: "builder-smoke-test",
      category: "survival",
      tags: ["survival"],
      periods: ["day"],
      baseWeight: 2,

      roles: [
        {
          id: "tribute",
          count: 1,
        },
      ],
    });

    expect(typeof definition.resolve).toBe("function");
  });

  it("keeps earlier builder values immutable", () => {
    const base = createEvent("immutable-builder").solo().during("day");

    const light = base.weight(2).resolve(createStaticStrategy());

    const heavy = base.weight(5).resolve(createStaticStrategy());

    expect(light.baseWeight).toBe(2);
    expect(heavy.baseWeight).toBe(5);
  });

  it("produces the same metadata regardless of method order", () => {
    const first = createEvent("method-order-first")
      .solo()
      .during("day", "night")
      .weight(3)
      .category("hazard")
      .tags("hazard", "status")
      .resolve(createStaticStrategy());

    const second = createEvent("method-order-second")
      .tags("hazard", "status")
      .category("hazard")
      .weight(3)
      .during("day", "night")
      .solo()
      .resolve(createStaticStrategy());

    expect({
      category: second.category,
      tags: second.tags,
      periods: second.periods,
      baseWeight: second.baseWeight,
      roles: second.roles,
    }).toEqual({
      category: first.category,
      tags: first.tags,
      periods: first.periods,
      baseWeight: first.baseWeight,
      roles: first.roles,
    });
  });

  it("rejects an invalid event ID", () => {
    expect(() =>
      createEvent("Invalid Event ID").solo().during("day").resolve(createStaticStrategy()),
    ).toThrow('Event ID "Invalid Event ID" must be non-empty kebab-case text.');
  });

  it("rejects an event without a period", () => {
    expect(() => createEvent("missing-period").solo().resolve(createStaticStrategy())).toThrow(
      'Event "missing-period" must declare at least one period.',
    );
  });

  it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN])("rejects invalid weight %s", (weight) => {
    expect(() =>
      createEvent("invalid-weight")
        .solo()
        .during("day")
        .weight(weight)
        .resolve(createStaticStrategy()),
    ).toThrow('Event "invalid-weight" must have a positive finite weight.');
  });

  it("rejects effects that reference an unknown role", () => {
    expect(() =>
      createEvent("unknown-effect-role")
        .solo()
        .during("day")
        .resolve(
          always(
            result({
              text: "Nothing happens.",

              effects: [survived("missing")],
            }),
          ),
        ),
    ).toThrow('Event "unknown-effect-role": effect "survived" references unknown role "missing".');
  });

  it("rejects an unknown status with an event-specific error", () => {
    expect(() =>
      createEvent("unknown-status")
        .solo()
        .during("day")
        .resolve(
          always(
            result({
              text: "Nothing happens.",

              effects: [applyStatus("tribute", "not-a-status" as StatusEffectId, 1)],
            }),
          ),
        ),
    ).toThrow(
      'Event "unknown-status": effect "apply-status" references unknown status "not-a-status".',
    );
  });

  it("compiles survival and status effects without mutating state", () => {
    const tribute = createAuthoringTestTribute({
      name: "Aloy",
    });

    const game = createAuthoringTestGame([tribute]);

    const definition = createEvent("effect-compilation")
      .solo()
      .during("day")
      .resolve(
        always(
          result({
            text: ({ tribute: character }) => `${character.name} keeps going.`,

            effects: [survived("tribute"), applyStatus("tribute", "inspired", 2)],
          }),
        ),
      );

    const resolution = resolveAuthoredEvent(
      definition,
      game,
      {
        tribute: [tribute],
      },
      [0.5],
    );

    expect(resolution.text).toBe("Aloy keeps going.");

    expect(resolution.changes).toContainEqual({
      type: "increment-statistic",
      tributeId: tribute.id,
      statistic: "eventsSurvived",
      amount: 1,
    });

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: tribute.id,

        status: expect.objectContaining({
          definitionId: "inspired",
          severity: 2,
        }),
      }),
    );

    expect(game.tributes[0].statuses).toEqual([]);

    expect(game.tributes[0].statistics.eventsSurvived).toBe(0);
  });

  it("rejects a result that defines text and append", () => {
    expect(() =>
      result({
        text: "Complete text.",
        append: " Additional text.",
      }),
    ).toThrow('An event result cannot define both "text" and "append".');
  });

  it("compiles an event weight multiplier", () => {
    const getWeightMultiplier = () => 2;

    const definition = createEvent("weighted-by-population")
      .solo()
      .category("survival")
      .tags("survival")
      .during("day")
      .weight(3)
      .weightMultiplier(getWeightMultiplier)
      .resolve(
        always(
          result({
            text: "Population-weighted event.",
          }),
        ),
      );

    expect(definition.getWeightMultiplier).toBe(getWeightMultiplier);
  });
});

describe("EventBuilder participant roles", () => {
  it("compiles roles in their authored order", () => {
    const firstWeight = () => 7;

    const definition = createEvent("ordered-authored-roles")
      .roles(
        soloRole("first", {
          getWeight: firstWeight,
        }),

        groupRole("second", 2),

        soloRole("third"),
      )
      .during("day")
      .resolve(createStaticStrategy());

    expect(definition.roles.map((role) => role.id)).toEqual(["first", "second", "third"]);

    expect(definition.roles[0]).toMatchObject({
      id: "first",
      count: 1,
    });

    expect(definition.roles[0]?.getWeight).toBe(firstWeight);

    expect(definition.roles[1]).toMatchObject({
      id: "second",
      count: 2,
    });

    expect(definition.roles[2]).toMatchObject({
      id: "third",
      count: 1,
    });
  });

  it("appends roles across repeated roles calls", () => {
    const definition = createEvent("repeated-roles-calls")
      .roles(soloRole("first"))
      .roles(
        soloRole("second"),

        soloRole("third"),
      )
      .during("day")
      .resolve(createStaticStrategy());

    expect(definition.roles.map((role) => role.id)).toEqual(["first", "second", "third"]);
  });

  it("keeps builder branches immutable", () => {
    const base = createEvent("immutable-role-builder").during("day");

    const soloDefinition = base.roles(soloRole("tribute")).resolve(createStaticStrategy());

    const pairDefinition = base
      .pair(
        soloRole("first"),

        soloRole("second"),
      )
      .resolve(createStaticStrategy());

    expect(soloDefinition.roles.map((role) => role.id)).toEqual(["tribute"]);

    expect(pairDefinition.roles.map((role) => role.id)).toEqual(["first", "second"]);
  });

  it("adds a pair in the supplied order", () => {
    const definition = createEvent("builder-pair")
      .pair(
        soloRole("attacker"),

        soloRole("victim"),
      )
      .during("day")
      .resolve(createStaticStrategy());

    expect(definition.roles).toEqual([
      expect.objectContaining({
        id: "attacker",
        count: 1,
      }),

      expect.objectContaining({
        id: "victim",
        count: 1,
      }),
    ]);
  });

  it("adds a repeated same-role group", () => {
    const definition = createEvent("builder-group")
      .group("tributes", 4)
      .during("night")
      .resolve(createStaticStrategy());

    expect(definition.roles).toEqual([
      expect.objectContaining({
        id: "tributes",
        count: 4,
      }),
    ]);
  });
});

describe("EventBuilder requirements", () => {
  it("combines requirements added through repeated when calls", () => {
    const tooLow = createAuthoringTestTribute({
      id: "too-low",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 2,
      },
    });

    const eligible = createAuthoringTestTribute({
      id: "eligible",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 4,
      },
    });

    const tooHigh = createAuthoringTestTribute({
      id: "too-high",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 5,
      },
    });

    const state = createAuthoringTestGame([tooLow, eligible, tooHigh]);

    const context = createSelectionContext(state);

    const definition = createEvent("repeated-when-calls")
      .roles(soloRole("tribute"))
      .when(minimumStat("tribute", "luck", 3))
      .when(maximumStat("tribute", "luck", 4))
      .during("day")
      .resolve(createStaticStrategy());

    const [role] = definition.roles;

    expect(role?.isEligible?.(tooLow, context)).toBe(false);

    expect(role?.isEligible?.(eligible, context)).toBe(true);

    expect(role?.isEligible?.(tooHigh, context)).toBe(false);
  });

  it("allows requirements to be declared before roles", () => {
    const definition = createEvent("requirements-before-roles")
      .when(minimumStat("tribute", "luck", 4))
      .roles(soloRole("tribute"))
      .during("day")
      .resolve(createStaticStrategy());

    expect(definition.roles[0]?.isEligible).toBeTypeOf("function");
  });

  it("compiles notInSameTruce into symmetric opposition", () => {
    const definition = createEvent("builder-truce-opposition")
      .pair(
        soloRole("attacker"),

        soloRole("victim"),
      )
      .when(notInSameTruce("attacker", "victim"))
      .during("day")
      .resolve(createStaticStrategy());

    expect(definition.roles[0]?.opposesRoleIds).toEqual(["victim"]);

    expect(definition.roles[1]?.opposesRoleIds).toEqual(["attacker"]);
  });

  it("produces equivalent roles regardless of builder method order", () => {
    const first = createEvent("method-order-first")
      .roles(soloRole("tribute"))
      .when(minimumStat("tribute", "brains", 3))
      .during("day")
      .resolve(createStaticStrategy());

    const second = createEvent("method-order-second")
      .during("day")
      .when(minimumStat("tribute", "brains", 3))
      .roles(soloRole("tribute"))
      .resolve(createStaticStrategy());

    expect(
      first.roles.map(({ id, count }) => ({
        id,
        count,
      })),
    ).toEqual(
      second.roles.map(({ id, count }) => ({
        id,
        count,
      })),
    );

    expect(first.roles[0]?.isEligible).toBeTypeOf("function");

    expect(second.roles[0]?.isEligible).toBeTypeOf("function");
  });
});
