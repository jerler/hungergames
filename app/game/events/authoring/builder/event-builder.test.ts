import { describe, expect, it } from "vitest";

import { always, applyStatus, createEvent, result, survived } from "~/game/events/authoring";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { resolveAuthoredEvent } from "~/game/events/authoring/testing/resolve-authored-event";
import type { StatusEffectId } from "~/game/statuses/status-schema";

function createStaticStrategy() {
  return always(
    result({
      text: ({ tribute }) => `${tribute.name} survives.`,

      effects: [survived("tribute")],
    }),
  );
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
});
