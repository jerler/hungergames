import type { ItemDefinition, ItemDefinitionId } from "./item-schema";
import {
  itemGrantsStatus,
  itemRemovesMedicalStatuses,
  itemRemovesStatuses,
  itemSatisfiesNeed,
} from "./item-effect-builders";
import { validateItemCatalogue } from "./item-validation";

export const ITEM_CATALOGUE = [
  // Consumable resources
  {
    id: "water",
    label: "Water bottle",
    description: "Clean water that satisfies hydration and treats dehydration.",
    origin: "natural-resource",
    tags: ["consumable", "water"],
    maxUses: 1,

    useEffects: [itemSatisfiesNeed("hydration"), itemRemovesStatuses("parched", "dehydrated")],
  },
  {
    id: "food",
    label: "Food",
    description: "A supply of food that satisfies hunger and leaves the tribute well-fed.",
    origin: "natural-resource",
    tags: ["consumable", "food"],
    maxUses: 1,

    survivalBonus: 0.15,

    useEffects: [
      itemSatisfiesNeed("food"),

      itemRemovesStatuses("hungry", "starving"),

      itemGrantsStatus("well-fed", 1),
    ],
  },
  {
    id: "medicine",
    label: "Medicine",
    description: "Medical supplies for treating wounds, poison, and burns.",
    origin: "manufactured",
    tags: ["consumable", "medicine"],
    maxUses: 1,

    useEffects: [itemRemovesMedicalStatuses()],
  },

  // Shelter and utility
  {
    id: "blanket",
    label: "Blanket",
    description: "A warm blanket that makes resting in the arena more comfortable.",
    origin: "manufactured",
    tags: ["shelter", "comfort", "tool"],

    survivalBonus: 0.35,

    rest: {
      quality: "comfortable",
    },
  },
  {
    id: "matches",
    label: "Matches",
    description: "A small supply of matches for starting fires and improving a night camp.",
    origin: "manufactured",
    tags: ["fire", "shelter", "tool"],

    maxUses: 2,
    survivalBonus: 0.2,

    rest: {
      quality: "sheltered",

      check: {
        stat: "brains",
        difficulty: 2,
      },
    },

    contextual: {
      nightAwarenessBonus: 0.35,
    },
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

    useEffects: [itemRemovesStatuses("disoriented")],
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

    useEffects: [itemRemovesStatuses("hunted"), itemGrantsStatus("hidden", 2)],

    contextual: {
      hostileTargetWeightMultiplier: 0.5,
    },
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

    minimumStats: {
      brawn: 2,
    },

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
    contextual: {
      hostileDefenseBonus: 0.75,
    },

    combatBonus: 0.45,
    survivalBonus: 0.55,
  },
] satisfies readonly ItemDefinition[];

validateItemCatalogue(ITEM_CATALOGUE);

export function getItemDefinition(itemId: ItemDefinitionId): ItemDefinition {
  const definition = ITEM_CATALOGUE.find((candidate) => candidate.id === itemId);

  if (!definition) {
    throw new Error(`Unknown item definition "${itemId}".`);
  }

  return definition;
}
