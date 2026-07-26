import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { StatusEffectId } from "~/game/statuses/status-schema";

import { getItemDefinition } from "./item-catalogue";
import { compileItemUseEffects } from "./item-effect-engine";
import { createInventoryItemInstance } from "./inventory-engine";
import type { ItemDefinitionId } from "./item-schema";

const ROUND = {
  day: 2,
  period: "day",
} as const;

function compileMedicine(itemId: ItemDefinitionId, statuses: readonly StatusEffectId[]) {
  const baseTribute = createAuthoringTestTribute({
    id: `user:${itemId}`,
  });
  const tribute = {
    ...baseTribute,
    statuses: statuses.map((statusId, index) =>
      createStatusEffectInstance(`status:${itemId}:${index}`, baseTribute.id, statusId, 1, ROUND),
    ),
  };
  const item = createInventoryItemInstance(`source:${itemId}`, tribute.id, itemId, ROUND);

  return {
    tribute,
    changes: compileItemUseEffects({
      eventId: `use:${itemId}`,
      round: ROUND,
      actingTribute: tribute,
      owner: tribute,
      item,
    }),
  };
}

describe("manufactured medicine", () => {
  const cases = [
    {
      itemId: "bandages",
      expected: ["injured", "bleeding"],
    },
    {
      itemId: "painkillers",
      expected: ["injured"],
    },
    {
      itemId: "burn-kit",
      expected: ["burned"],
    },
    {
      itemId: "antidote",
      expected: ["poisoned"],
    },
    {
      itemId: "med-kit",
      expected: ["injured", "bleeding", "poisoned", "burned"],
    },
  ] as const;

  it.each(cases)("$itemId removes only its declared medical statuses", ({ itemId, expected }) => {
    const { tribute, changes } = compileMedicine(itemId, [
      "injured",
      "bleeding",
      "poisoned",
      "burned",
      "exhausted",
      "hungry",
      "thirsty",
    ]);

    const removedIds = new Set(
      changes.flatMap((change) => (change.type === "remove-status" ? [change.statusId] : [])),
    );

    const removedDefinitions = tribute.statuses.flatMap((status) =>
      removedIds.has(status.id) ? [status.definitionId] : [],
    );

    expect(removedDefinitions).toEqual(expected);
  });

  it("does not let medicine satisfy food or water", () => {
    for (const itemId of ["med-kit", "bandages", "painkillers", "burn-kit", "antidote"] as const) {
      const definition = getItemDefinition(itemId);

      expect(
        definition.useEffects?.some(
          (effect) => (effect as { type: string }).type === "satisfy-need",
        ),
      ).toBe(false);
    }
  });
});
