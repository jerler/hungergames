import { describe, expect, it } from "vitest";

import {
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { RoundReference } from "~/game/types/game-state";

import { resolveCornucopiaProvisionNeed } from "./cornucopia-provision-resolution";

const ROUND = {
  day: 3,
  period: "night",
} as const satisfies RoundReference;

describe("Cornucopia provision resolution", () => {
  it.each(["critical-failure", "failure", "success"] as const)(
    "satisfies food without a status on %s",
    (outcome) => {
      const tribute = withAuthoringTestItem(
        createAuthoringTestTribute({
          id: "provisioned-tribute",
          name: "Piglet",
          pronouns: "she",
        }),
        "cornucopia-provisions",
      );

      const resolution = resolveCornucopiaProvisionNeed({
        eventId: `food-${outcome}`,
        round: ROUND,
        tribute,
        need: "food",
        outcome,
      });

      expect(resolution.text).toMatch(/Cornucopia/i);
      expect(resolution.changes).toContainEqual({
        type: "satisfy-survival-need",
        tributeId: tribute.id,
        need: "food",
      });
      expect(resolution.changes.some((change) => change.type === "apply-status")).toBe(false);
    },
  );

  it("grants well-fed on exceptional success", () => {
    const tribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "exceptional-provisioned-tribute",
        name: "Snow White",
        pronouns: "she",
      }),
      "cornucopia-provisions",
    );

    const resolution = resolveCornucopiaProvisionNeed({
      eventId: "exceptional-water",
      round: ROUND,
      tribute,
      need: "water",
      outcome: "exceptional-success",
    });

    expect(resolution.changes).toContainEqual({
      type: "satisfy-survival-need",
      tributeId: tribute.id,
      need: "water",
    });
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: tribute.id,
        status: expect.objectContaining({
          definitionId: "well-fed",
        }),
      }),
    );
  });

  it("rejects a tribute without provisions", () => {
    const tribute = createAuthoringTestTribute({
      id: "unprovisioned-tribute",
    });

    expect(() =>
      resolveCornucopiaProvisionNeed({
        eventId: "invalid-provision-use",
        round: ROUND,
        tribute,
        need: "food",
        outcome: "success",
      }),
    ).toThrow(/without.*provisions/i);
  });
});
