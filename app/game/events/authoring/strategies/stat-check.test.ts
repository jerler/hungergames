import { describe, expect, it } from "vitest";

import {
  applyStatus,
  brains,
  brawn,
  createEvent,
  luck,
  result,
  statCheck,
  survived,
} from "~/game/events/authoring";
import type { StatCheckResults } from "~/game/events/authoring/outcomes/outcome-schema";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { resolveAuthoredEvent } from "~/game/events/authoring/testing/resolve-authored-event";

function createFourOutcomeEvent(
  check: ReturnType<typeof brains> = brains(3),
  id = "four-outcome-test",
) {
  return createEvent(id)
    .solo()
    .during("day")
    .resolve(
      statCheck(
        "tribute",
        check,
        {
          criticalFailure: result({
            append: " critically fails.",

            effects: [applyStatus("tribute", "disoriented", 1)],
          }),

          failure: result({
            append: " fails.",
            effects: [],
          }),

          success: result({
            append: " succeeds.",

            effects: [survived("tribute")],
          }),

          exceptionalSuccess: result({
            append: " succeeds exceptionally.",

            effects: [applyStatus("tribute", "inspired", 1)],
          }),
        },
        {
          intro: ({ tribute }) => `${tribute.name} tries`,
        },
      ),
    );
}

describe("statCheck", () => {
  it.each([
    {
      randomValue: 0,
      text: "Test Tribute tries critically fails.",
      changeType: "apply-status",
      statusId: "disoriented",
    },
    {
      randomValue: 0.2,
      text: "Test Tribute tries fails.",
      changeType: null,
      statusId: null,
    },
    {
      randomValue: 0.6,
      text: "Test Tribute tries succeeds.",
      changeType: "increment-statistic",
      statusId: null,
    },
    {
      randomValue: 0.99,
      text: "Test Tribute tries succeeds exceptionally.",
      changeType: "apply-status",
      statusId: "inspired",
    },
  ] as const)(
    "reaches the expected branch for random value $randomValue",
    ({ randomValue, text, changeType, statusId }) => {
      const tribute = createAuthoringTestTribute();

      const game = createAuthoringTestGame([tribute]);

      const resolution = resolveAuthoredEvent(
        createFourOutcomeEvent(),
        game,
        {
          tribute: [tribute],
        },
        [randomValue],
      );

      expect(resolution.text).toBe(text);

      if (changeType === null) {
        expect(resolution.changes).toEqual([]);

        return;
      }

      expect(resolution.changes[0]?.type).toBe(changeType);

      if (statusId !== null) {
        expect(resolution.changes[0]).toEqual(
          expect.objectContaining({
            status: expect.objectContaining({
              definitionId: statusId,
            }),
          }),
        );
      }
    },
  );

  it("rejects an incomplete outcome map", () => {
    const incompleteOutcomes = {
      failure: result({
        text: "Failure.",
      }),

      success: result({
        text: "Success.",
      }),

      exceptionalSuccess: result({
        text: "Exceptional success.",
      }),
    } as unknown as StatCheckResults;

    expect(() =>
      createEvent("incomplete-outcomes")
        .solo()
        .during("day")
        .resolve(statCheck("tribute", brains(3), incompleteOutcomes)),
    ).toThrow('Event "incomplete-outcomes": stat check is missing outcome "criticalFailure".');
  });

  it("resolves identical inputs deterministically", () => {
    const tribute = createAuthoringTestTribute();

    const game = createAuthoringTestGame([tribute]);

    const definition = createFourOutcomeEvent();

    const participants = {
      tribute: [tribute],
    };

    const first = resolveAuthoredEvent(definition, game, participants, [0.73]);

    const second = resolveAuthoredEvent(definition, game, participants, [0.73]);

    expect(second).toEqual(first);
  });

  it("applies the existing Luck adjustment to Brains checks", () => {
    const highLuckTribute = createAuthoringTestTribute({
      stats: {
        brains: 3,
        brawn: 3,
        luck: 5,
      },
    });

    const lowLuckTribute = createAuthoringTestTribute({
      id: "tribute-2",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 1,
      },
    });

    const definition = createFourOutcomeEvent(brains(3), "brains-luck-adjustment");

    const highLuckResolution = resolveAuthoredEvent(
      definition,
      createAuthoringTestGame([highLuckTribute]),
      {
        tribute: [highLuckTribute],
      },
      [0.48],
    );

    const lowLuckResolution = resolveAuthoredEvent(
      definition,
      createAuthoringTestGame([lowLuckTribute]),
      {
        tribute: [lowLuckTribute],
      },
      [0.48],
    );

    expect(highLuckResolution.text).toBe("Test Tribute tries succeeds.");

    expect(lowLuckResolution.text).toBe("Test Tribute tries fails.");
  });

  it("applies the existing Luck adjustment to Brawn checks", () => {
    const highLuckTribute = createAuthoringTestTribute({
      stats: {
        brains: 3,
        brawn: 3,
        luck: 5,
      },
    });

    const lowLuckTribute = createAuthoringTestTribute({
      id: "tribute-2",

      stats: {
        brains: 3,
        brawn: 3,
        luck: 1,
      },
    });

    const definition = createFourOutcomeEvent(brawn(3), "brawn-luck-adjustment");

    const highLuckResolution = resolveAuthoredEvent(
      definition,
      createAuthoringTestGame([highLuckTribute]),
      {
        tribute: [highLuckTribute],
      },
      [0.48],
    );

    const lowLuckResolution = resolveAuthoredEvent(
      definition,
      createAuthoringTestGame([lowLuckTribute]),
      {
        tribute: [lowLuckTribute],
      },
      [0.48],
    );

    expect(highLuckResolution.text).toBe("Test Tribute tries succeeds.");

    expect(lowLuckResolution.text).toBe("Test Tribute tries fails.");
  });

  it("does not apply the Luck adjustment twice to Luck checks", () => {
    const tribute = createAuthoringTestTribute({
      stats: {
        brains: 3,
        brawn: 3,
        luck: 5,
      },
    });

    const definition = createFourOutcomeEvent(luck(3), "raw-luck-check");

    const resolution = resolveAuthoredEvent(
      definition,
      createAuthoringTestGame([tribute]),
      {
        tribute: [tribute],
      },
      [0.2],
    );

    /*
     * A raw Luck-5 check against difficulty 3
     * resolves this value as failure.
     *
     * Applying the Luck difficulty adjustment
     * to Luck itself would incorrectly turn it
     * into success.
     */
    expect(resolution.text).toBe("Test Tribute tries fails.");
  });

  it("allows complete outcome text to replace the shared intro", () => {
    const tribute = createAuthoringTestTribute();

    const definition = createEvent("replacement-text")
      .solo()
      .during("day")
      .resolve(
        statCheck(
          "tribute",
          brains(3),
          {
            criticalFailure: result({
              text: "Complete replacement text.",
            }),

            failure: result({
              append: " fails.",
            }),

            success: result({
              append: " succeeds.",
            }),

            exceptionalSuccess: result({
              append: " succeeds exceptionally.",
            }),
          },
          {
            intro: "This intro should be ignored",
          },
        ),
      );

    const resolution = resolveAuthoredEvent(
      definition,
      createAuthoringTestGame([tribute]),
      {
        tribute: [tribute],
      },
      [0],
    );

    expect(resolution.text).toBe("Complete replacement text.");
  });
});
