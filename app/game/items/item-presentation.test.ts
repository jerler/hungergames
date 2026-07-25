import { describe, expect, it } from "vitest";

import { ITEM_CATALOGUE } from "~/game/items/item-catalogue";

import { createInventoryItemInstance } from "~/game/items/inventory-engine";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import { createDefaultTributeSurvivalState } from "~/game/survival/survival-schema";

import type { GameTribute, InventoryItem } from "~/game/types/game-state";

import type { TributeStats } from "~/game/types/tribute";

import { createInventoryItemPresentation } from "./item-presentation";

const TEST_ROUND = {
  day: 1,

  period: "day",
} as const;

function createTribute(stats: Partial<TributeStats> = {}): GameTribute {
  return {
    id: "tribute-1",

    sourceDefinitionId: null,

    district: 1,

    districtPosition: 1,

    snapshot: {
      name: "Avery Chen",

      pronouns: "they",

      portraitUrl: null,

      stats: {
        brains: 3,

        brawn: 3,

        luck: 3,

        ...stats,
      },
    },

    isAlive: true,

    death: null,

    survival: createDefaultTributeSurvivalState(),

    statuses: [],

    inventory: [],

    allianceId: null,

    statistics: {
      kills: 0,

      attemptedKills: 0,

      giftsReceived: 0,

      eventsSurvived: 0,
    },
  };
}

function createPresentation(
  definitionId: ItemDefinitionId,

  {
    stats = {},
    usesRemaining,
  }: {
    stats?: Partial<TributeStats>;
    usesRemaining?: number | null;
  } = {},
) {
  const baseTribute = createTribute(stats);

  const originalItem = createInventoryItemInstance(
    `event-${definitionId}`,

    baseTribute.id,

    definitionId,

    TEST_ROUND,
  );

  const item: InventoryItem =
    usesRemaining === undefined
      ? originalItem
      : {
          ...originalItem,
          usesRemaining,
        };

  const tribute: GameTribute = {
    ...baseTribute,
    inventory: [item],
  };

  return createInventoryItemPresentation(tribute, item);
}

describe("inventory item presentation", () => {
  it("provides meaningful presentation for every catalogue item", () => {
    for (const definition of ITEM_CATALOGUE) {
      const presentation = createPresentation(definition.id);

      expect(presentation.label).toBe(definition.label);

      expect(presentation.description).toBe(definition.description);

      expect(presentation.usesLabel).not.toBe("");

      expect(presentation.minimumRequirements.length).toBeGreaterThan(0);

      expect(
        presentation.capabilityGroups.length,
        `Expected "${definition.id}" to expose at least one purpose or capability.`,
      ).toBeGreaterThan(0);
    }
  });

  it("describes food and hydration effects", () => {
    expect(createPresentation("pizza-box")).toMatchObject({
      usesLabel: "3 of 3 uses remaining",
    });

    expect(createPresentation("pizza-box").capabilityGroups).toContainEqual({
      label: "Consumption",

      details: expect.arrayContaining(["Satisfies hunger."]),
    });

    expect(createPresentation("bottled-water").capabilityGroups).toContainEqual({
      label: "Consumption",

      details: expect.arrayContaining(["Restores hydration."]),
    });
  });

  it("describes complete medical treatment", () => {
    expect(createPresentation("med-kit").capabilityGroups).toContainEqual({
      label: "Medical treatment",

      details: ["Treats Injured, Bleeding, Poisoned, and Burned."],
    });
  });

  it("describes rest quality and checks", () => {
    expect(createPresentation("tent").capabilityGroups).toContainEqual({
      label: "Rest",

      details: ["Provides sheltered rest when used at night."],
    });

    expect(createPresentation("tarp").capabilityGroups).toContainEqual({
      label: "Rest",

      details: expect.arrayContaining([
        "Provides sheltered rest when used at night.",

        "Requires a check using the better of Brains or Luck at difficulty 2.",
      ]),
    });
  });

  it("uses centralized stat requirements and usability reasons", () => {
    const presentation = createPresentation(
      "warhammer",

      {
        stats: {
          brawn: 4,
        },
      },
    );

    expect(presentation.minimumRequirements).toContain("Brawn 5");

    expect(presentation.usable).toBe(false);

    expect(presentation.usabilityLabel).toBe("Avery Chen cannot use this item.");

    expect(presentation.unusableReasons).toContain("Requires Brawn 5; Avery Chen has 4.");
  });

  it("describes tactical offense and defensive equipment", () => {
    expect(createPresentation("firebomb").capabilityGroups).toContainEqual({
      label: "Combat",

      details: ["Enables risky area attacks that may harm the user on a critical failure."],
    });

    expect(createPresentation("shield").capabilityGroups).toContainEqual({
      label: "Defense",

      details: [
        "Adds +0.75 to checked attack defense when usable.",

        "Reduces ordinary hostile targeting by 25%.",
      ],
    });
  });

  it("describes hunting and night-only utility", () => {
    expect(createPresentation("slingshot").capabilityGroups).toContainEqual({
      label: "Utility",

      details: expect.arrayContaining(["Can be used during hunting events."]),
    });

    expect(createPresentation("night-vision-goggles").capabilityGroups).toContainEqual({
      label: "Contextual bonuses",

      details: [
        "+0.75 awareness score at night.",

        "Reduces hostile targeting during night ambushes by 45%.",
      ],
    });
  });

  it("distinguishes reusable, limited, and depleted items", () => {
    expect(createPresentation("tent").usesLabel).toBe("Reusable");

    expect(createPresentation("antidote").usesLabel).toBe("1 use remaining");

    const depleted = createPresentation(
      "antidote",

      {
        usesRemaining: 0,
      },
    );

    expect(depleted.usesLabel).toBe("No uses remaining");

    expect(depleted.usable).toBe(false);

    expect(depleted.unusableReasons).toContain("No uses remain.");
  });
});
