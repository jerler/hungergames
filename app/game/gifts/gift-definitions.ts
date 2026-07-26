import type { ItemDefinitionId } from "~/game/items/item-schema";

export type GiftFrequency = "very-common" | "common" | "uncommon" | "disabled";

export interface GiftDefinition {
  id: ItemDefinitionId;
  name: string;
  description: string;
}

export const GIFT_DEFINITIONS = [
  {
    id: "med-kit",
    name: "Med kit",
    description: "A multi-use medical kit.",
  },
  {
    id: "blanket",
    name: "Blanket",
    description: "Warmth and comfort for the arena night.",
  },
  {
    id: "matches",
    name: "Matches",
    description: "A limited means of starting a fire.",
  },
  {
    id: "knife",
    name: "Knife",
    description: "A compact direct-combat weapon.",
  },
  {
    id: "bow",
    name: "Bow",
    description: "A ranged direct-combat weapon.",
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
  "med-kit": "uncommon",
  blanket: "common",
  matches: "common",
  knife: "uncommon",
  bow: "uncommon",
} as const satisfies Record<GiftDefinitionId, GiftFrequency>;
