import { describe, expect, it } from "vitest";

import { getItemDefinition } from "~/game/items/item-catalogue";

import { DEFAULT_GIFT_FREQUENCIES, GIFT_DEFINITIONS } from "./gift-definitions";

const EXPECTED_GIFT_IDS = [
  "soup",
  "bottled-water",
  "med-kit",
  "blanket",
  "rope",
  "matches",
  "knife",
  "bow",
] as const;

describe("gift definitions", () => {
  it("uses real manufactured item IDs", () => {
    expect(GIFT_DEFINITIONS.map((gift) => gift.id)).toEqual([...EXPECTED_GIFT_IDS]);

    for (const gift of GIFT_DEFINITIONS) {
      expect(getItemDefinition(gift.id).origin).toBe("manufactured");
    }
  });

  it("defines a frequency for every gift", () => {
    expect(Object.keys(DEFAULT_GIFT_FREQUENCIES).sort()).toEqual([...EXPECTED_GIFT_IDS].sort());
  });

  it("keeps med kits uncommon", () => {
    expect(DEFAULT_GIFT_FREQUENCIES["med-kit"]).toBe("uncommon");
  });
});
