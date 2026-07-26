import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  getAcquiredItemIds,
  getAppliedStatusIds,
  hasSurvivalCredit,
  requireEventDefinition,
  selectAndResolveEvent,
} from "~/game/events/testing/event-test-helpers";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { PronounSetId } from "~/game/tributes/pronouns";
import { ITEM_USE_EVENTS } from "./item-use-events";

function resolveItemEvent(
  eventId: string,
  itemId: ItemDefinitionId,
  randomValue: number,
  pronouns: PronounSetId = "they",
) {
  const tribute = withAuthoringTestItem(
    createAuthoringTestTribute({
      id: "tribute",
      name: "Fern",
      pronouns,
      stats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },
    }),
    itemId,
  );
  const definition = requireEventDefinition(ITEM_USE_EVENTS, eventId);
  const { resolution } = selectAndResolveEvent({
    definition,
    state: createAuthoringTestGame([tribute]),
    livingTributes: [tribute],
    randomValues: [randomValue],
  });

  return {
    tribute,
    resolution,
  };
}

function getSatisfiedNeeds(resolution: ReturnType<typeof resolveItemEvent>["resolution"]) {
  return resolution.changes.flatMap((change) =>
    change.type === "satisfy-survival-need" ? [change.need] : [],
  );
}

describe("item-use event content", () => {
  it("successful shelter renovation grants hidden and survival credit", () => {
    const { tribute, resolution } = resolveItemEvent("axe-based-shelter-renovation", "axe", 0.6);

    expect(getAppliedStatusIds(resolution)).toEqual(["hidden"]);
    expect(hasSurvivalCredit(resolution, tribute.id)).toBe(true);
  });

  it("the slingshot immediately provides food", () => {
    const failure = resolveItemEvent("slingshot-trick-shot", "slingshot", 0.2);
    expect(getAppliedStatusIds(failure.resolution)).toEqual(["hunted"]);

    const success = resolveItemEvent("slingshot-trick-shot", "slingshot", 0.6);
    expect(getAcquiredItemIds(success.resolution)).toEqual([]);
    expect(getSatisfiedNeeds(success.resolution)).toEqual(["food"]);
    expect(success.resolution.text).toMatch(/\b(eat|eats)\b/i);
    expect(hasSurvivalCredit(success.resolution, success.tribute.id)).toBe(true);
  });

  it("an exceptional shield experiment satisfies food and water", () => {
    const { tribute, resolution } = resolveItemEvent(
      "shield-used-for-everything-else",
      "shield",
      0.999,
    );

    expect(getAcquiredItemIds(resolution)).toEqual([]);
    expect(getSatisfiedNeeds(resolution)).toEqual(["food", "water"]);
    expect(resolution.text).toMatch(/\b(eat|eats)\b/i);
    expect(resolution.text).toMatch(/\b(drink|drinks)\b/i);
    expect(hasSurvivalCredit(resolution, tribute.id)).toBe(true);
  });

  it("renders tribute pronouns in item-use text", () => {
    const axeFailure = resolveItemEvent("axe-based-shelter-renovation", "axe", 0, "she");
    expect(axeFailure.resolution.text).toContain("drops part of a tree on herself");

    const shieldSuccess = resolveItemEvent("shield-used-for-everything-else", "shield", 0.6, "she");
    expect(shieldSuccess.resolution.text).toContain("uses her shield");
  });
});
