import { describe, expect, it } from "vitest";

import { brains, createEvent, randomResult, result, statCheck } from "~/game/events/authoring";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { resolveAuthoredEvent } from "~/game/events/authoring/testing/resolve-authored-event";

describe("randomResult", () => {
  it("rejects an empty result list", () => {
    expect(() => randomResult()).toThrow("A random event result must contain at least one result.");
  });

  it("selects a deterministic result after the stat check", () => {
    const tribute = createAuthoringTestTribute();

    const state = createAuthoringTestGame([tribute]);

    const definition = createEvent("random-result-selection")
      .solo()
      .during("day")
      .resolve(
        statCheck("tribute", brains(3), {
          criticalFailure: result({
            text: "Critical failure.",
          }),

          failure: result({
            text: "Failure.",
          }),

          success: randomResult(
            result({
              text: "First success.",
            }),

            result({
              text: "Second success.",
            }),
          ),

          exceptionalSuccess: result({
            text: "Exceptional success.",
          }),
        }),
      );

    const first = resolveAuthoredEvent(
      definition,
      state,
      {
        tribute: [tribute],
      },
      [0.6, 0],
    );

    const second = resolveAuthoredEvent(
      definition,
      state,
      {
        tribute: [tribute],
      },
      [0.6, 0.999],
    );

    expect(first.text).toBe("First success.");

    expect(second.text).toBe("Second success.");
  });

  it("returns the same result for identical random input", () => {
    const tribute = createAuthoringTestTribute();

    const state = createAuthoringTestGame([tribute]);

    const definition = createEvent("deterministic-random-result")
      .solo()
      .during("day")
      .resolve(
        statCheck("tribute", brains(3), {
          criticalFailure: result({
            text: "Critical failure.",
          }),

          failure: result({
            text: "Failure.",
          }),

          success: randomResult(
            result({
              text: "First.",
            }),

            result({
              text: "Second.",
            }),
          ),

          exceptionalSuccess: result({
            text: "Exceptional success.",
          }),
        }),
      );

    const resolve = () =>
      resolveAuthoredEvent(
        definition,
        state,
        {
          tribute: [tribute],
        },
        [0.6, 0.8],
      );

    expect(resolve()).toEqual(resolve());
  });
});
