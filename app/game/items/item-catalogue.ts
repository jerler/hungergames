import type { ItemDefinition, ItemDefinitionId, ItemUseEffect } from "./item-schema";

import {
  itemGrantsStatus,
  itemMayGrantStatus,
  itemRemovesMedicalStatuses,
  itemRemovesStatuses,
  itemSatisfiesNeed,
} from "./item-effect-builders";
import { validateItemCatalogue } from "~/game/items/item-validation";

const HYDRATION_RECOVERY_EFFECTS = [
  itemSatisfiesNeed("hydration"),

  itemRemovesStatuses("thirsty", "dehydrated"),
] as const satisfies readonly ItemUseEffect[];

const FOOD_RECOVERY_EFFECTS = [
  itemSatisfiesNeed("food"),

  itemRemovesStatuses("hungry", "starving"),
] as const satisfies readonly ItemUseEffect[];

const HALLUCINOGENIC_FORAGE_EFFECTS = [
  itemGrantsStatus("disoriented", 1),
] as const satisfies readonly ItemUseEffect[];

const POISONOUS_FORAGE_EFFECTS = [
  itemGrantsStatus("poisoned", 1),
] as const satisfies readonly ItemUseEffect[];

const CAFFEINATED_DRINK_EFFECTS = [
  ...HYDRATION_RECOVERY_EFFECTS,

  itemRemovesStatuses("exhausted"),

  itemGrantsStatus("alert", 1),
] as const satisfies readonly ItemUseEffect[];

export const ITEM_CATALOGUE = [
  // Natural resources
  {
    id: "water",
    label: "Fresh water",

    description: "Clean fresh water collected from a natural source in the arena.",

    origin: "natural-resource",

    tags: ["consumable", "water"],

    maxUses: 1,

    useEffects: HYDRATION_RECOVERY_EFFECTS,
  },

  // Safe natural food
  {
    id: "wild-fruit-and-berries",

    label: "Wild fruit and berries",

    description: "Safely identified wild fruit and berries gathered from the arena.",

    origin: "natural-resource",

    tags: ["consumable", "food"],

    maxUses: 1,

    useEffects: FOOD_RECOVERY_EFFECTS,
  },

  {
    id: "mushrooms",
    label: "Mushrooms",

    description: "Safely identified edible mushrooms gathered from the arena.",

    origin: "natural-resource",

    tags: ["consumable", "food"],

    maxUses: 1,

    useEffects: FOOD_RECOVERY_EFFECTS,
  },

  {
    id: "eggs",
    label: "Eggs",

    description: "A clutch of eggs gathered from an arena nest and prepared as a meal.",

    origin: "natural-resource",

    tags: ["consumable", "food"],

    maxUses: 1,

    useEffects: FOOD_RECOVERY_EFFECTS,
  },

  {
    id: "rabbit",
    label: "Rabbit",

    description: "A rabbit caught in the arena and prepared as a meal.",

    origin: "natural-resource",

    tags: ["consumable", "food"],

    maxUses: 1,

    useEffects: FOOD_RECOVERY_EFFECTS,
  },

  {
    id: "chicken",
    label: "Chicken",

    description: "An arena chicken caught and prepared as a meal.",

    origin: "natural-resource",

    tags: ["consumable", "food"],

    maxUses: 1,

    useEffects: FOOD_RECOVERY_EFFECTS,
  },

  {
    id: "fish",
    label: "Fish",

    description: "A fish caught in the arena and prepared as a meal.",

    origin: "natural-resource",

    tags: ["consumable", "food"],

    maxUses: 1,

    useEffects: FOOD_RECOVERY_EFFECTS,
  },

  // Harmful natural forage
  {
    id: "hallucinogenic-berries",

    label: "Hallucinogenic berries",

    description: "Strange berries that cause confusion and disorientation when consumed.",

    origin: "natural-resource",

    tags: ["consumable"],

    maxUses: 1,

    useEffects: HALLUCINOGENIC_FORAGE_EFFECTS,
  },

  {
    id: "poison-berries",
    label: "Poisonous berries",

    description: "Toxic berries that poison anyone who consumes them.",

    origin: "natural-resource",

    tags: ["consumable"],

    maxUses: 1,

    useEffects: POISONOUS_FORAGE_EFFECTS,
  },

  {
    id: "hallucinogenic-mushrooms",

    label: "Hallucinogenic mushrooms",

    description: "Unusual mushrooms that cause confusion and disorientation when consumed.",

    origin: "natural-resource",

    tags: ["consumable"],

    maxUses: 1,

    useEffects: HALLUCINOGENIC_FORAGE_EFFECTS,
  },

  {
    id: "poison-mushrooms",
    label: "Poisonous mushrooms",

    description: "Toxic mushrooms that poison anyone who consumes them.",

    origin: "natural-resource",

    tags: ["consumable"],

    maxUses: 1,

    useEffects: POISONOUS_FORAGE_EFFECTS,
  },

  // Natural utility
  {
    id: "kindling",
    label: "Dry kindling",

    description: "Dry twigs and bark that can be burned to improve a night camp.",

    origin: "natural-resource",

    tags: ["fire", "shelter", "tool"],

    maxUses: 1,

    rest: {
      quality: "sheltered",

      check: {
        stat: "brains-or-luck",

        difficulty: 3,
      },
    },
  },

  // Manufactured food
  {
    id: "soup",
    label: "Soup",

    description: "A warm serving of soup that satisfies both hunger and hydration.",

    origin: "manufactured",

    tags: ["consumable", "food", "water"],

    maxUses: 1,

    useEffects: [...FOOD_RECOVERY_EFFECTS, ...HYDRATION_RECOVERY_EFFECTS],
  },

  {
    id: "burger-and-fries",
    label: "Burger and fries",

    description: "A rich Capitol meal that satisfies hunger and may leave the tribute well fed.",

    origin: "manufactured",

    tags: ["consumable", "food"],

    maxUses: 1,

    useEffects: [...FOOD_RECOVERY_EFFECTS, itemMayGrantStatus("well-fed", 1, 0.5)],
  },

  {
    id: "pizza-box",
    label: "Pizza box",

    description: "A box containing enough pizza for three separate meals.",

    origin: "manufactured",

    tags: ["consumable", "food"],

    maxUses: 3,

    useEffects: FOOD_RECOVERY_EFFECTS,
  },

  // Manufactured drinks
  {
    id: "bottled-water",
    label: "Bottled water",

    description: "A sealed bottle containing two servings of clean water.",

    origin: "manufactured",

    tags: ["consumable", "water"],

    maxUses: 2,

    useEffects: HYDRATION_RECOVERY_EFFECTS,
  },

  {
    id: "coffee",
    label: "Coffee",

    description:
      "A caffeinated drink that restores hydration, removes exhaustion, and improves alertness.",

    origin: "manufactured",

    tags: ["consumable", "water"],

    maxUses: 1,

    useEffects: CAFFEINATED_DRINK_EFFECTS,
  },

  {
    id: "coca-cola",
    label: "Coca-Cola",

    description:
      "A caffeinated soft drink that restores hydration, removes exhaustion, and improves alertness.",

    origin: "manufactured",

    tags: ["consumable", "water"],

    maxUses: 1,

    useEffects: CAFFEINATED_DRINK_EFFECTS,
  },

  {
    id: "energy-drink",
    label: "Energy drink",

    description:
      "A strongly caffeinated drink that restores hydration, removes exhaustion, and improves alertness.",

    origin: "manufactured",

    tags: ["consumable", "water"],

    maxUses: 1,

    useEffects: CAFFEINATED_DRINK_EFFECTS,
  },

  {
    id: "hot-chocolate",
    label: "Hot chocolate",

    description:
      "A comforting hot drink that restores hydration and brings a temporary stroke of luck.",

    origin: "manufactured",

    tags: ["consumable", "water"],

    maxUses: 1,

    useEffects: [...HYDRATION_RECOVERY_EFFECTS, itemGrantsStatus("lucky", 1)],
  },

  {
    id: "herbal-tea",
    label: "Herbal tea",

    description: "A restorative herbal drink that restores hydration and relieves exhaustion.",

    origin: "manufactured",

    tags: ["consumable", "water"],

    maxUses: 1,

    useEffects: [...HYDRATION_RECOVERY_EFFECTS, itemRemovesStatuses("exhausted")],
  },

  // Medical supplies
  {
    id: "med-kit",
    label: "Med kit",

    description:
      "A comprehensive medical kit with three uses that treats wounds, burns, and poisoning.",

    origin: "manufactured",

    tags: ["consumable", "medicine"],

    maxUses: 3,

    useEffects: [itemRemovesMedicalStatuses()],
  },

  {
    id: "bandages",
    label: "Bandages",

    description: "Sterile bandages for treating injuries and stopping bleeding.",

    origin: "manufactured",

    tags: ["consumable", "medicine"],

    maxUses: 1,

    useEffects: [itemRemovesStatuses("injured", "bleeding")],
  },

  {
    id: "painkillers",
    label: "Painkillers",

    description: "A dose of painkillers that helps a tribute recover from an injury.",

    origin: "manufactured",

    tags: ["consumable", "medicine"],

    maxUses: 1,

    useEffects: [itemRemovesStatuses("injured")],
  },

  {
    id: "burn-kit",
    label: "Burn kit",

    description: "Specialized dressings and ointment for treating burns.",

    origin: "manufactured",

    tags: ["consumable", "medicine"],

    maxUses: 1,

    useEffects: [itemRemovesStatuses("burned")],
  },

  {
    id: "antidote",
    label: "Antidote",

    description: "A rare antidote capable of neutralizing arena poisons.",

    origin: "manufactured",

    tags: ["consumable", "medicine"],

    maxUses: 1,

    useEffects: [itemRemovesStatuses("poisoned")],
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
    description: "A single book of matches for starting a fire and improving a night camp.",

    origin: "manufactured",

    tags: ["fire", "shelter", "tool"],

    maxUses: 1,

    survivalBonus: 0.2,

    rest: {
      quality: "sheltered",

      check: {
        stat: "brains-or-luck",
        difficulty: 2,

        criticalFailureStatus: {
          statusId: "burned",
          severity: 1,
        },
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
    id: "foraging-guidebook",

    label: "Foraging guidebook",

    description:
      "A reusable field guide that helps identify edible, hallucinogenic, and poisonous arena plants.",

    origin: "manufactured",

    tags: ["tool"],

    foragingBonus: 0.5,
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
