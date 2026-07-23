import { describe, expect, it } from "vitest";

import { applyStatus, createEvent, customResolution, result } from "~/game/events/authoring";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { resolveAuthoredEvent } from "~/game/events/authoring/testing/resolve-authored-event";

describe("customResolution", () => {
  it("resolves declared results through central effect compilation", () => {
    const tribute = createAuthoringTestTribute({
      id: "tribute",
      name: "Fern",
    });

    const game = createAuthoringTestGame([tribute]);

    const possibleResult = result({
      text: ({ tribute: character }) => `${character.name} becomes exhausted.`,

      effects: [applyStatus("tribute", "exhausted", 1)],
    });

    const definition = createEvent("custom-resolution-test")
      .solo("tribute")
      .category("hazard")
      .tags("hazard", "status")
      .during("day")
      .weight(1)
      .resolve(
        customResolution(
          (_context, { resolveResult }) => resolveResult(possibleResult),

          {
            possibleResults: [possibleResult],
          },
        ),
      );

    const resolution = resolveAuthoredEvent(
      definition,
      game,
      {
        tribute: [tribute],
      },
      [0],
    );

    expect(resolution.text).toBe("Fern becomes exhausted.");

    expect(resolution.changes).toEqual([
      expect.objectContaining({
        type: "apply-status",
        tributeId: tribute.id,

        status: expect.objectContaining({
          definitionId: "exhausted",
          severity: 1,
        }),
      }),
    ]);
  });

  it("validates every declared possible result", () => {
    const invalidResult = result({
      text: "Invalid.",

      effects: [applyStatus("missing-role", "injured", 1)],
    });

    expect(() =>
      createEvent("invalid-custom-resolution")
        .solo("tribute")
        .category("hazard")
        .tags("hazard")
        .during("day")
        .weight(1)
        .resolve(
          customResolution(
            () => ({
              text: "Invalid.",
              changes: [],
            }),

            {
              possibleResults: [invalidResult],
            },
          ),
        ),
    ).toThrow('references unknown role "missing-role"');
  });

  it("supports a dynamic intro with an appended result", () => {
    const tribute = createAuthoringTestTribute({
      id: "tribute",
      name: "Fern",
    });

    const game = createAuthoringTestGame([tribute]);

    const appendedResult = result({
      append: " and reaches safety.",
    });

    const definition = createEvent("custom-resolution-intro")
      .solo("tribute")
      .category("survival")
      .tags("survival")
      .during("day")
      .weight(1)
      .resolve(
        customResolution(
          (_context, { resolveResult }) =>
            resolveResult(
              appendedResult,
              undefined,
              ({ tribute: character }) => `${character.name} crosses the river`,
            ),
          { possibleResults: [appendedResult] },
        ),
      );

    expect(resolveAuthoredEvent(definition, game, { tribute: [tribute] }, [0]).text).toBe(
      "Fern crosses the river and reaches safety.",
    );
  });
});
