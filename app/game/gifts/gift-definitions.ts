import type { ItemDefinitionId } from "~/game/items/item-schema";

export type GiftFrequency = "very-common" | "common" | "uncommon" | "disabled";

export interface GiftDefinition {
  id: ItemDefinitionId;
  name: string;
  description: string;
}

export const GIFT_DEFINITIONS = [
  {
    id: "soup",
    name: "Bowl of soup",

    description: "Relieves hunger and thirst with one warm meal.",
  },

  {
    id: "bottled-water",
    name: "Bottled water",

    description: "Provides two servings of clean drinking water.",
  },

  {
    id: "med-kit",
    name: "Med kit",

    description: "A rare three-use medical kit capable of treating multiple harmful conditions.",
  },

  {
    id: "blanket",
    name: "Warm blanket",

    description: "Provides comfortable rest during the night.",
  },

  {
    id: "matches",
    name: "Matches",

    description: "Allows a tribute to attempt to establish a sheltered night camp.",
  },

  {
    id: "knife",
    name: "Knife",

    description: "A compact weapon and useful survival tool.",
  },

  {
    id: "bow",
    name: "Bow and arrows",

    description: "A powerful but comparatively rare ranged weapon.",
  },
] as const satisfies readonly GiftDefinition[];

export type GiftDefinitionId = (typeof GIFT_DEFINITIONS)[number]["id"];

export const GIFT_FREQUENCY_OPTIONS = [
  {
    value: "very-common",
    label: "Very common",
  },
  {
    value: "common",
    label: "Common",
  },
  {
    value: "uncommon",
    label: "Uncommon",
  },
  {
    value: "disabled",
    label: "Disabled",
  },
] satisfies readonly {
  value: GiftFrequency;
  label: string;
}[];

export const DEFAULT_GIFT_FREQUENCIES = {
  soup: "very-common",
  "bottled-water": "very-common",
  "med-kit": "uncommon",
  blanket: "common",
  matches: "uncommon",
  knife: "uncommon",
  bow: "uncommon",
} satisfies Record<GiftDefinitionId, GiftFrequency>;
