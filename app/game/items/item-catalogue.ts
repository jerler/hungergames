import type { ItemDefinition, ItemDefinitionId } from "./item-schema";

export const ITEM_CATALOGUE = [
  // Consumable resources
  {
    id: "water",
    label: "Water bottle",
    description: "Clean water that automatically treats dehydration.",
    origin: "natural-resource",
    tags: ["consumable", "water"],
    maxUses: 1,
    treatments: [
      {
        statusId: "dehydrated",
        severityReduction: 3,
        durationReduction: 3,
        priority: 10,
      },
    ],
  },
  {
    id: "food",
    label: "Food",
    description: "A supply of food that restores energy and automatically treats exhaustion.",
    origin: "natural-resource",
    tags: ["consumable", "food"],
    maxUses: 1,
    survivalBonus: 0.15,

    treatments: [
      {
        statusId: "exhausted",
        severityReduction: 2,
        durationReduction: 2,
        priority: 8,
      },
    ],
  },
  {
    id: "medicine",
    label: "Medicine",
    description: "Medical supplies that automatically treat wounds, illness, poison, and burns.",
    origin: "manufactured",
    tags: ["consumable", "medicine"],
    maxUses: 1,
    treatments: [
      {
        statusId: "bleeding",
        severityReduction: 3,
        durationReduction: 3,
        priority: 15,
      },
      {
        statusId: "poisoned",
        severityReduction: 3,
        durationReduction: 3,
        priority: 14,
      },
      {
        statusId: "burned",
        severityReduction: 2,
        durationReduction: 2,
        priority: 12,
      },
      {
        statusId: "sick",
        severityReduction: 2,
        durationReduction: 2,
        priority: 11,
      },
      {
        statusId: "injured",
        severityReduction: 2,
        durationReduction: 2,
        priority: 10,
      },
    ],
  },

  // Shelter and utility
  {
    id: "blanket",
    label: "Blanket",
    description: "A warm blanket that provides temporary shelter.",
    origin: "manufactured",
    tags: ["shelter", "tool"],
    survivalBonus: 0.35,
    treatments: [
      {
        statusId: "exposed",
        severityReduction: 3,
        durationReduction: 3,
        priority: 10,
      },
    ],
  },
  {
    id: "matches",
    label: "Matches",
    description: "A small supply of matches for starting fires.",
    origin: "manufactured",
    tags: ["fire", "shelter", "tool"],
    maxUses: 2,
    survivalBonus: 0.2,
    treatments: [
      {
        statusId: "exposed",
        severityReduction: 2,
        durationReduction: 2,
        priority: 7,
      },
    ],
  },
  {
    id: "rope",
    label: "Rope",
    description: "A versatile tool for climbing and crossing hazards.",
    origin: "manufactured",
    tags: ["tool"],
    survivalBonus: 0.25,
    foragingBonus: 0.2,
  },
  {
    id: "map",
    label: "Arena map",
    description:
      "A partial map of the arena that improves navigation and helps a disoriented tribute recover.",
    origin: "manufactured",
    tags: ["tool", "navigation"],
    awarenessBonus: 0.45,
    foragingBonus: 0.35,

    treatments: [
      {
        statusId: "disoriented",
        severityReduction: 3,
        durationReduction: 3,
        priority: 10,
      },
    ],
  },
  {
    id: "camouflage-net",
    label: "Camouflage net",
    description:
      "A portable camouflage net that improves concealment and helps a hunted tribute lose their pursuer.",
    origin: "manufactured",
    tags: ["tool", "shelter", "camouflage"],
    survivalBonus: 0.5,
    awarenessBonus: 0.1,

    treatments: [
      {
        statusId: "hunted",
        severityReduction: 3,
        durationReduction: 3,
        priority: 11,
      },
    ],
  },
  {
    id: "trap-kit",
    label: "Trap kit",
    description:
      "Wire, hooks, triggers, and other components for hunting or constructing arena traps.",
    origin: "manufactured",
    tags: ["tool", "trap", "hunting"],
    maxUses: 3,

    awarenessBonus: 0.2,
    foragingBonus: 0.55,
  },
  {
    id: "fishing-gear",
    label: "Fishing gear",
    description:
      "A compact fishing kit that greatly improves the tribute's ability to gather food near water.",
    origin: "manufactured",
    tags: ["tool", "fishing", "hunting"],
    maxUses: 3,

    survivalBonus: 0.15,
    foragingBonus: 0.7,
  },

  // Defensive and offensive gear
  {
    id: "slingshot",
    label: "Slingshot",
    description:
      "A light ranged weapon useful for hunting small animals and creating distractions.",
    origin: "manufactured",
    tags: ["weapon", "hunting"],

    combatBonus: 0.65,
    awarenessBonus: 0.1,
    foragingBonus: 0.25,
  },
  {
    id: "knife",
    label: "Knife",
    description: "A compact weapon that is also useful as a tool.",
    origin: "manufactured",
    tags: ["weapon", "tool"],
    combatBonus: 1,
    foragingBonus: 0.15,
  },
  {
    id: "spear",
    label: "Spear",
    description: "A strong close- and medium-range weapon.",
    origin: "manufactured",
    tags: ["weapon"],
    combatBonus: 1.35,
  },
  {
    id: "bow",
    label: "Bow and arrows",
    description: "A powerful ranged weapon with limited ammunition.",
    origin: "manufactured",
    tags: ["weapon"],
    combatBonus: 1.6,
    awarenessBonus: 0.2,
  },
  {
    id: "axe",
    label: "Axe",
    description:
      "A heavy weapon that is also useful for chopping wood, clearing paths, and building shelter.",
    origin: "manufactured",
    tags: ["weapon", "tool", "hunting"],

    combatBonus: 1.45,
    survivalBonus: 0.2,
    foragingBonus: 0.3,
  },
  {
    id: "shield",
    label: "Shield",
    description: "A sturdy shield that improves combat survivability and protection from hazards.",
    origin: "manufactured",
    tags: ["tool", "defense"],

    combatBonus: 0.45,
    survivalBonus: 0.55,
  },
] satisfies readonly ItemDefinition[];

export function getItemDefinition(itemId: ItemDefinitionId): ItemDefinition {
  const definition = ITEM_CATALOGUE.find((candidate) => candidate.id === itemId);

  if (!definition) {
    throw new Error(`Unknown item definition "${itemId}".`);
  }

  return definition;
}
