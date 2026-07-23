import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  getAcquiredItemIds,
  getAppliedStatusIds,
  getAppliedStatuses,
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

  const state = createAuthoringTestGame([tribute]);

  const definition = requireEventDefinition(ITEM_USE_EVENTS, eventId);

  const { resolution } = selectAndResolveEvent({
    definition,
    state,
    livingTributes: [tribute],
    randomValues: [randomValue],
  });

  return {
    tribute,
    resolution,
  };
}

describe("item-use event content", () => {
  it("the enormous fish can injure and exhaust its fisher", () => {
    const { resolution } = resolveItemEvent("fishing-gear-enormous-fish", "fishing-gear", 0);

    expect(
      getAppliedStatuses(resolution).map((status) => ({
        id: status.definitionId,
        severity: status.severity,
      })),
    ).toEqual([
      {
        id: "injured",
        severity: 1,
      },
      {
        id: "exhausted",
        severity: 2,
      },
    ]);
  });

  it("successful shelter renovation grants concealment and survival credit", () => {
    const { tribute, resolution } = resolveItemEvent("axe-based-shelter-renovation", "axe", 0.6);

    expect(getAppliedStatusIds(resolution)).toEqual(["concealed"]);

    expect(hasSurvivalCredit(resolution, tribute.id)).toBe(true);
  });

  it("the slingshot has distinct failure and success consequences", () => {
    const failure = resolveItemEvent("slingshot-trick-shot", "slingshot", 0.2);

    expect(getAppliedStatusIds(failure.resolution)).toEqual(["hunted"]);

    const success = resolveItemEvent("slingshot-trick-shot", "slingshot", 0.6);

    expect(getAcquiredItemIds(success.resolution)).toEqual(["food"]);

    expect(hasSurvivalCredit(success.resolution, success.tribute.id)).toBe(true);
  });

  it("an exceptional trap produces food and inspiration", () => {
    const { tribute, resolution } = resolveItemEvent(
      "trap-kit-instructions-missing",
      "trap-kit",
      0.999,
    );

    expect(getAcquiredItemIds(resolution)).toEqual(["food"]);

    expect(getAppliedStatusIds(resolution)).toEqual(["inspired"]);

    expect(hasSurvivalCredit(resolution, tribute.id)).toBe(true);
  });

  it("an exceptional shield experiment finds both food and water", () => {
    const { tribute, resolution } = resolveItemEvent(
      "shield-used-for-everything-else",
      "shield",
      0.999,
    );

    expect(getAcquiredItemIds(resolution)).toEqual(["food", "water"]);

    expect(hasSurvivalCredit(resolution, tribute.id)).toBe(true);
  });

  it("exceptional camouflage applies strong concealment", () => {
    const { resolution } = resolveItemEvent("camouflage-catastrophe", "camouflage-net", 0.999);

    expect(getAppliedStatuses(resolution)).toEqual([
      expect.objectContaining({
        definitionId: "concealed",
        severity: 2,
      }),
    ]);
  });

  it("renders tribute pronouns in item-use text", () => {
    const axeFailure = resolveItemEvent("axe-based-shelter-renovation", "axe", 0, "she");

    expect(axeFailure.resolution.text).toContain("drops part of a tree on herself");

    const shieldSuccess = resolveItemEvent("shield-used-for-everything-else", "shield", 0.6, "she");

    expect(shieldSuccess.resolution.text).toContain("uses her shield");
  });
});
