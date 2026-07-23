import { describe, expect, it } from "vitest";

import { acquireNaturalResource, always, createEvent, result } from "~/game/events/authoring";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { resolveAuthoredEvent } from "~/game/events/authoring/testing/resolve-authored-event";
import type { ItemDefinitionId } from "~/game/items/item-schema";

describe("acquireNaturalResource", () => {
  it("creates a natural-foraging acquisition with event provenance", () => {
    const tribute = createAuthoringTestTribute({
      id: "forager",
    });

    const state = createAuthoringTestGame([tribute]);

    const definition = createEvent("natural-resource-acquisition")
      .solo()
      .during("day")
      .resolve(
        always(
          result({
            text: "The tribute gathers food.",

            effects: [acquireNaturalResource("tribute", "food")],
          }),
        ),
      );

    const resolution = resolveAuthoredEvent(
      definition,
      state,
      {
        tribute: [tribute],
      },
      [0.5],
    );

    expect(resolution.changes).toEqual([
      {
        type: "acquire-item",

        tributeId: tribute.id,
        acquisitionSource: "natural-foraging",

        item: {
          id: "test:natural-resource-acquisition:forager:food",

          definitionId: "food",
          usesRemaining: 1,

          sourceEventId: "test:natural-resource-acquisition",

          acquiredRound: {
            day: 2,
            period: "day",
          },
        },
      },
    ]);
  });

  it("rejects manufactured equipment", () => {
    expect(() =>
      createEvent("manufactured-resource-rejection")
        .solo()
        .during("day")
        .resolve(
          always(
            result({
              text: "The event resolves.",

              effects: [acquireNaturalResource("tribute", "map")],
            }),
          ),
        ),
    ).toThrow(
      'Event "manufactured-resource-rejection": effect "acquire-natural-resource" requires a natural-resource item, but "map" is manufactured.',
    );
  });

  it("rejects an unknown item definition", () => {
    expect(() =>
      createEvent("unknown-resource-rejection")
        .solo()
        .during("day")
        .resolve(
          always(
            result({
              text: "The event resolves.",

              effects: [acquireNaturalResource("tribute", "unknown-resource" as ItemDefinitionId)],
            }),
          ),
        ),
    ).toThrow(
      'Event "unknown-resource-rejection": effect "acquire-natural-resource" references unknown item "unknown-resource".',
    );
  });
});
