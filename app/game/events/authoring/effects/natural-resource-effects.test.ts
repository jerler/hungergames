import { describe, expect, it } from "vitest";

import {
  acquirePersistentNaturalResource,
  always,
  createEvent,
  result,
} from "~/game/events/authoring";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { resolveAuthoredEvent } from "~/game/events/authoring/testing/resolve-authored-event";
import type { PersistentNaturalResourceItemId } from "~/game/items/item-schema";

describe("acquirePersistentNaturalResource", () => {
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
            text: "The tribute gathers kindling.",

            effects: [acquirePersistentNaturalResource("tribute", "kindling")],
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
          id: "test:natural-resource-acquisition:forager:kindling",

          definitionId: "kindling",
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

              effects: [
                acquirePersistentNaturalResource(
                  "tribute",
                  "map" as PersistentNaturalResourceItemId,
                ),
              ],
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

              effects: [
                acquirePersistentNaturalResource(
                  "tribute",
                  "unknown-resource" as PersistentNaturalResourceItemId,
                ),
              ],
            }),
          ),
        ),
    ).toThrow(
      'Event "unknown-resource-rejection": effect "acquire-natural-resource" references unknown item "unknown-resource".',
    );
  });
});
