import { describe, expect, it } from "vitest";

import { always, createEvent, eliminate, result } from "~/game/events/authoring";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { resolveAuthoredEvent } from "~/game/events/authoring/testing/resolve-authored-event";

describe("eliminate", () => {
  it("creates an environmental elimination using the rendered event text", () => {
    const tribute = createAuthoringTestTribute({
      id: "victim",
      name: "Hazel",
    });

    const game = createAuthoringTestGame([tribute]);

    const definition = createEvent("falling-tree-test")
      .solo("victim")
      .category("fatal")
      .tags("fatal", "hazard")
      .during("day")
      .weight(1)
      .resolve(
        always(
          result({
            text: ({ victim }) => `${victim.name} is crushed by a falling tree.`,

            effects: [
              eliminate("victim", {
                causeId: "falling-tree-test",
                causeLabel: "Crushed",
              }),
            ],
          }),
        ),
      );

    const resolution = resolveAuthoredEvent(
      definition,
      game,
      {
        victim: [tribute],
      },
      [0],
    );

    expect(resolution).toEqual({
      text: "Hazel is crushed by a falling tree.",

      changes: [
        {
          type: "eliminate-tribute",
          tributeId: tribute.id,
          causeId: "falling-tree-test",
          causeLabel: "Crushed",
          summary: "Hazel is crushed by a falling tree.",
          killerTributeIds: [],
        },
      ],
    });
  });

  it("rejects an empty cause label", () => {
    expect(() =>
      createEvent("empty-fatal-label")
        .solo("victim")
        .category("fatal")
        .tags("fatal")
        .during("day")
        .weight(1)
        .resolve(
          always(
            result({
              text: "Fatal event.",

              effects: [
                eliminate("victim", {
                  causeId: "empty-fatal-label",
                  causeLabel: "",
                }),
              ],
            }),
          ),
        ),
    ).toThrow("non-empty cause label");
  });
});
