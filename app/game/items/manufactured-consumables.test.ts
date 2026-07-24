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

function compileItem(
  itemId: ItemDefinitionId,
  {
    random,
    statuses = [],
  }: {
    random?: () => number;
    statuses?: readonly StatusEffectId[];
  } = {},
) {
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

  const changes = compileItemUseEffects({
    eventId: `use:${itemId}`,

    round: ROUND,

    random,

    actingTribute: tribute,

    owner: tribute,

    item,
  });

  return {
    tribute,
    item,
    changes,
  };
}

function getSatisfiedNeeds(changes: ReturnType<typeof compileItemUseEffects>) {
  return changes.flatMap((change) =>
    change.type === "satisfy-survival-need" ? [change.need] : [],
  );
}

function getAppliedStatusIds(changes: ReturnType<typeof compileItemUseEffects>) {
  return changes.flatMap((change) =>
    change.type === "apply-status" ? [change.status.definitionId] : [],
  );
}

describe("manufactured consumables", () => {
  it("uses soup once to satisfy food and hydration", () => {
    const { item, changes } = compileItem("soup");

    expect(getSatisfiedNeeds(changes)).toEqual(["food", "water"]);

    expect(changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",

        itemInstanceId: item.id,

        uses: 1,
      }),
    );
  });

  it.each(["coffee", "coca-cola", "energy-drink"] as const)(
    "%s shares the caffeinated drink mechanics",
    (itemId) => {
      const { changes } = compileItem(itemId, {
        statuses: ["exhausted"],
      });

      expect(getSatisfiedNeeds(changes)).toEqual(["water"]);

      expect(getAppliedStatusIds(changes)).toContain("alert");

      expect(changes).toContainEqual(
        expect.objectContaining({
          type: "remove-status",
        }),
      );
    },
  );

  it("grants well-fed when the burger chance succeeds", () => {
    const { changes } = compileItem("burger-and-fries", {
      random: () => 0.49,
    });

    expect(getAppliedStatusIds(changes)).toContain("well-fed");
  });

  it("does not grant well-fed when the burger chance fails", () => {
    const { changes } = compileItem("burger-and-fries", {
      random: () => 0.5,
    });

    expect(getAppliedStatusIds(changes)).not.toContain("well-fed");
  });

  it("requires randomness for a probabilistic item", () => {
    expect(() => compileItem("burger-and-fries")).toThrow(/requires a random source/i);
  });

  it("gives hot chocolate a lucky effect", () => {
    const { changes } = compileItem("hot-chocolate");

    expect(getAppliedStatusIds(changes)).toContain("lucky");
  });

  it("makes herbal tea remove exhaustion without granting alert", () => {
    const { changes } = compileItem("herbal-tea", {
      statuses: ["exhausted"],
    });

    expect(changes).toContainEqual(
      expect.objectContaining({
        type: "remove-status",
      }),
    );

    expect(getAppliedStatusIds(changes)).not.toContain("alert");
  });

  it("configures multi-use packaged supplies", () => {
    expect(getItemDefinition("pizza-box").maxUses).toBe(3);

    expect(getItemDefinition("bottled-water").maxUses).toBe(2);

    expect(getItemDefinition("med-kit").maxUses).toBe(3);
  });
});

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
    const { tribute, changes } = compileItem(itemId, {
      statuses: ["injured", "bleeding", "poisoned", "burned", "exhausted"],
    });

    const removedIds = new Set(
      changes.flatMap((change) => (change.type === "remove-status" ? [change.statusId] : [])),
    );

    const removedDefinitions = tribute.statuses.flatMap((status) =>
      removedIds.has(status.id) ? [status.definitionId] : [],
    );

    expect(removedDefinitions).toEqual(expected);
  });

  it.each(["med-kit", "bandages", "painkillers", "burn-kit", "antidote"] as const)(
    "%s does not treat food or hydration",
    (itemId) => {
      const definition = getItemDefinition(itemId);

      expect(definition.useEffects?.some((effect) => effect.type === "satisfy-need")).toBe(false);
    },
  );
});
