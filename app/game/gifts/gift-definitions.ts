export type GiftFrequency = "very-common" | "common" | "uncommon" | "disabled";

export type GiftDefinitionId =
  "bread" | "water" | "medicine" | "blanket" | "rope" | "matches" | "knife" | "bow";

export interface GiftDefinition {
  id: GiftDefinitionId;
  name: string;
  description: string;
}

export const GIFT_DEFINITIONS = [
  {
    id: "bread",
    name: "Loaf of bread",
    description: "Relieves hunger and provides short-term energy.",
  },
  {
    id: "water",
    name: "Water bottle",
    description: "Relieves thirst and can be carried between rounds.",
  },
  {
    id: "medicine",
    name: "Medicine",
    description: "Treats injuries and some harmful conditions.",
  },
  {
    id: "blanket",
    name: "Warm blanket",
    description: "Protects a tribute from cold nights.",
  },
  {
    id: "rope",
    name: "Rope",
    description: "A versatile survival and escape tool.",
  },
  {
    id: "matches",
    name: "Matches",
    description: "Allows a tribute to make fire and keep warm.",
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
] satisfies readonly GiftDefinition[];

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
  bread: "very-common",
  water: "very-common",
  medicine: "common",
  blanket: "common",
  rope: "common",
  matches: "uncommon",
  knife: "uncommon",
  bow: "uncommon",
} satisfies Record<GiftDefinitionId, GiftFrequency>;
