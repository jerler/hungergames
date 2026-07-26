import type { ItemDefinition, ItemDefinitionId, ItemUseEffect } from "./item-schema";

import {
  itemGrantsStatus,
  itemMayGrantStatus,
  itemRemovesMedicalStatuses,
  itemRemovesStatuses,
} from "./item-effect-builders";

const HALLUCINOGENIC_FORAGE_EFFECTS = [
  itemGrantsStatus("disoriented", 1),
] as const satisfies readonly ItemUseEffect[];

const POISONOUS_FORAGE_EFFECTS = [
  itemGrantsStatus("poisoned", 1),
] as const satisfies readonly ItemUseEffect[];

const CAFFEINATED_DRINK_EFFECTS = [
  itemRemovesStatuses("exhausted"),
  itemGrantsStatus("alert", 1),
] as const satisfies readonly ItemUseEffect[];

export const ITEM_CATALOGUE = [
  // Natural resources
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
        difficulty: 4,

        criticalFailureStatus: {
          statusId: "burned",
          severity: 1,
        },
      },
    },
  },

  // Manufactured food and drink
  // Status-effect consumables
  {
    id: "burger-and-fries",
    label: "Burger and fries",
    description: "A rich Capitol meal that may leave the tribute feeling especially well fed.",
    origin: "manufactured",
    tags: ["consumable"],
    maxUses: 1,
    useEffects: [itemMayGrantStatus("well-fed", 1, 0.5)],
  },

  {
    id: "coffee",
    label: "Coffee",
    description: "A caffeinated drink that removes exhaustion and improves alertness.",
    origin: "manufactured",
    tags: ["consumable"],
    maxUses: 1,
    useEffects: CAFFEINATED_DRINK_EFFECTS,
  },

  {
    id: "coca-cola",
    label: "Coca-Cola",
    description: "A caffeinated soft drink that removes exhaustion and improves alertness.",
    origin: "manufactured",
    tags: ["consumable"],
    maxUses: 1,
    useEffects: CAFFEINATED_DRINK_EFFECTS,
  },

  {
    id: "energy-drink",
    label: "Energy drink",
    description: "A strongly caffeinated drink that removes exhaustion and improves alertness.",
    origin: "manufactured",
    tags: ["consumable"],
    maxUses: 1,
    useEffects: CAFFEINATED_DRINK_EFFECTS,
  },

  {
    id: "hot-chocolate",
    label: "Hot chocolate",
    description: "A comforting hot drink that brings a temporary stroke of luck.",
    origin: "manufactured",
    tags: ["consumable"],
    maxUses: 1,
    useEffects: [itemGrantsStatus("lucky", 1)],
  },

  {
    id: "herbal-tea",
    label: "Herbal tea",
    description: "A restorative herbal drink that relieves exhaustion.",
    origin: "manufactured",
    tags: ["consumable"],
    maxUses: 1,
    useEffects: [itemRemovesStatuses("exhausted")],
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

  // Comfort
  {
    id: "blanket",
    label: "Blanket",

    description: "A warm blanket that makes resting in the arena more comfortable.",

    origin: "manufactured",

    tags: ["shelter", "comfort", "tool"],

    rest: {
      quality: "comfortable",
    },
  },

  {
    id: "sleeping-bag",
    label: "Sleeping bag",

    description: "A reusable sleeping bag that provides a comfortable place to rest.",

    origin: "manufactured",

    tags: ["shelter", "comfort", "tool"],

    rest: {
      quality: "comfortable",
    },
  },

  {
    id: "thermal-blanket",
    label: "Thermal blanket",

    description:
      "An insulated emergency blanket that preserves warmth and provides comfortable rest.",

    origin: "manufactured",

    tags: ["shelter", "comfort", "tool"],

    rest: {
      quality: "comfortable",
    },
  },

  {
    id: "pillow",
    label: "Pillow",

    description:
      "A surprisingly luxurious pillow that makes an otherwise miserable night more comfortable.",

    origin: "manufactured",

    tags: ["comfort", "tool"],

    rest: {
      quality: "comfortable",
    },
  },

  // Shelter and fire
  {
    id: "tent",
    label: "Tent",

    description: "A reusable arena tent that reliably protects its occupant from the elements.",

    origin: "manufactured",

    tags: ["shelter", "tool"],

    rest: {
      quality: "sheltered",
    },
  },

  {
    id: "tarp",
    label: "Tarp",

    description: "A reusable waterproof tarp that can be arranged into a strong temporary shelter.",

    origin: "manufactured",

    tags: ["shelter", "tool"],

    rest: {
      quality: "sheltered",

      check: {
        stat: "brains-or-luck",
        difficulty: 2,
      },
    },
  },

  {
    id: "lighter",
    label: "Lighter",

    description: "A compact lighter with enough fuel to start three arena fires.",

    origin: "manufactured",

    tags: ["fire", "shelter", "tool"],

    maxUses: 3,

    rest: {
      quality: "sheltered",

      check: {
        stat: "brains-or-luck",
        difficulty: 1,

        criticalFailureStatus: {
          statusId: "burned",
          severity: 1,
        },
      },
    },
  },

  {
    id: "matches",
    label: "Matches",

    description: "A single book of matches for starting a fire and improving a night camp.",

    origin: "manufactured",

    tags: ["fire", "shelter", "tool"],

    maxUses: 1,

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
  },

  {
    id: "flint-stone",
    label: "Flint and stone",

    description: "A reusable fire-starting set that requires patience and careful handling.",

    origin: "manufactured",

    tags: ["fire", "shelter", "tool"],

    rest: {
      quality: "sheltered",

      check: {
        stat: "brains-or-luck",
        difficulty: 3,

        criticalFailureStatus: {
          statusId: "burned",
          severity: 1,
        },
      },
    },
  },

  // Navigation and utility
  {
    id: "map",
    label: "Arena map",

    description:
      "A partial one-use map that can guide its reader toward natural resources or a concealed route.",

    origin: "manufactured",

    tags: ["tool", "navigation"],

    maxUses: 1,

    awarenessBonus: 0.45,
    foragingBonus: 0.35,
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
    id: "bird-whistle",
    label: "Bird whistle",

    description: "A reusable whistle capable of imitating arena birds and revealing nearby nests.",

    origin: "manufactured",

    tags: ["tool", "hunting"],
  },

  {
    id: "binoculars",
    label: "Binoculars",

    description:
      "Reusable binoculars that help a tribute observe distant threats and opportunities.",

    origin: "manufactured",

    tags: ["tool", "navigation"],

    awarenessBonus: 0.6,
  },

  {
    id: "camouflage-net",
    label: "Camouflage net",

    description:
      "A reusable net that can be actively arranged to conceal a tribute within the surrounding terrain.",

    origin: "manufactured",

    tags: ["tool", "camouflage"],
  },

  {
    id: "camouflage-paint",
    label: "Camouflage paint",

    description: "A single-use supply of paint for disguising exposed skin and equipment.",

    origin: "manufactured",

    tags: ["tool", "camouflage"],

    maxUses: 1,
  },

  {
    id: "night-vision-goggles",
    label: "Night-vision goggles",

    description:
      "Reusable goggles that improve awareness in darkness and make nighttime ambushes easier to detect.",

    origin: "manufactured",

    tags: ["tool", "navigation"],

    contextual: {
      nightAwarenessBonus: 0.75,
      nightAmbushTargetWeightMultiplier: 0.55,
    },
  },

  {
    id: "trap-kit",
    label: "Trap kit",

    description: "Wire, hooks, and triggers for constructing one arena hunting trap.",

    origin: "manufactured",

    tags: ["tool", "trap", "hunting"],

    maxUses: 1,

    awarenessBonus: 0.2,
    foragingBonus: 0.55,
  },

  {
    id: "fishing-gear",
    label: "Fishing gear",

    description: "A compact three-use fishing kit for gathering food near water.",

    origin: "manufactured",

    tags: ["tool", "fishing", "hunting"],

    maxUses: 3,

    survivalBonus: 0.15,
    foragingBonus: 0.7,
  },

  // Hunting equipment that is not an ordinary lethal weapon
  {
    id: "slingshot",
    label: "Slingshot",

    description:
      "A light ranged weapon useful for hunting small animals and creating distractions.",

    origin: "manufactured",

    tags: ["weapon", "hunting"],

    awarenessBonus: 0.1,
    foragingBonus: 0.25,
  },

  // Bladed direct weapons
  {
    id: "knife",
    label: "Knife",

    description: "A compact blade suited to close combat and general arena utility.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon", "tool"],

    offense: {
      strategy: "direct",
      attackBonus: 0.9,
    },

    foragingBonus: 0.15,
  },

  {
    id: "short-sword",
    label: "Short sword",

    description: "A compact sword that balances reach, speed, and manageable weight.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon"],

    minimumStats: {
      brawn: 2,
    },

    offense: {
      strategy: "direct",
      attackBonus: 1.05,
    },
  },

  {
    id: "rapier",
    label: "Rapier",

    description: "A light thrusting sword that rewards speed and careful positioning.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon"],

    minimumStats: {
      brawn: 2,
    },

    offense: {
      strategy: "direct",
      attackBonus: 1.1,
    },
  },

  {
    id: "longsword",
    label: "Longsword",

    description: "A versatile two-handed sword requiring strength and control.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon"],

    minimumStats: {
      brawn: 3,
    },

    offense: {
      strategy: "direct",
      attackBonus: 1.35,
    },
  },

  {
    id: "greatsword",
    label: "Greatsword",

    description: "An enormous sword capable of devastating attacks in sufficiently strong hands.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon"],

    minimumStats: {
      brawn: 4,
    },

    offense: {
      strategy: "direct",
      attackBonus: 1.7,
    },
  },

  // Pole weapons
  {
    id: "spear",
    label: "Spear",

    description: "A strong close- and medium-range weapon with excellent reach.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon", "hunting"],

    minimumStats: {
      brawn: 2,
    },

    offense: {
      strategy: "direct",
      attackBonus: 1.15,
    },
  },

  {
    id: "pike",
    label: "Pike",

    description:
      "A very long pole weapon that provides exceptional reach but requires room to manoeuvre.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon"],

    minimumStats: {
      brawn: 2,
    },

    offense: {
      strategy: "direct",
      attackBonus: 1.35,
    },
  },

  {
    id: "trident",
    label: "Trident",

    description:
      "A three-pronged pole weapon effective at controlling distance and trapping opponents.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon", "hunting"],

    minimumStats: {
      brawn: 2,
    },

    offense: {
      strategy: "direct",
      attackBonus: 1.25,
    },
  },

  // Ranged direct weapons
  {
    id: "bow",
    label: "Bow and arrows",

    description: "A flexible ranged weapon that rewards awareness and careful aim.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon", "hunting"],

    offense: {
      strategy: "direct",
      attackBonus: 1.2,
    },

    awarenessBonus: 0.2,
  },

  {
    id: "longbow",
    label: "Longbow",

    description:
      "A powerful long-range bow that requires substantial strength to draw effectively.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon", "hunting"],

    minimumStats: {
      brawn: 3,
    },

    offense: {
      strategy: "direct",
      attackBonus: 1.5,
    },

    awarenessBonus: 0.2,
  },

  {
    id: "crossbow",
    label: "Crossbow",

    description:
      "A mechanical ranged weapon whose careful operation rewards technical understanding.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon"],

    minimumStats: {
      brains: 2,
    },

    offense: {
      strategy: "direct",
      attackBonus: 1.3,
    },
  },

  {
    id: "blowgun",
    label: "Blowgun",

    description: "A quiet poison-delivery weapon that requires knowledge and precise preparation.",

    origin: "manufactured",

    tags: ["weapon", "tactical"],

    minimumStats: {
      brains: 3,
    },

    offense: {
      strategy: "poison",
    },
  },

  // Axes and blunt direct weapons
  {
    id: "hand-axe",
    label: "Hand axe",

    description: "A compact chopping weapon that can be handled quickly at close range.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon", "tool", "hunting"],

    offense: {
      strategy: "direct",
      attackBonus: 1,
    },

    foragingBonus: 0.15,
  },

  {
    id: "axe",
    label: "Axe",

    description:
      "A heavy weapon also useful for chopping wood, clearing paths, and preparing shelter.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon", "tool", "hunting"],

    offense: {
      strategy: "direct",
      attackBonus: 1.35,
    },

    survivalBonus: 0.2,
    foragingBonus: 0.3,
  },

  {
    id: "club",
    label: "Club",

    description: "A simple blunt weapon requiring little specialized training.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon"],

    offense: {
      strategy: "direct",
      attackBonus: 0.7,
    },
  },

  {
    id: "warhammer",
    label: "Warhammer",

    description: "A brutally heavy weapon that is devastating only in exceptionally strong hands.",

    origin: "manufactured",

    tags: ["weapon", "direct-weapon"],

    minimumStats: {
      brawn: 5,
    },

    offense: {
      strategy: "direct",
      attackBonus: 1.9,
    },
  },

  // Tactical offensive items
  {
    id: "poison-vial",
    label: "Poison vial",

    description:
      "A single dose of concentrated poison requiring expert handling and careful delivery.",

    origin: "manufactured",

    tags: ["weapon", "tactical", "consumable"],

    maxUses: 1,

    minimumStats: {
      brains: 4,
    },

    offense: {
      strategy: "poison",
    },
  },

  {
    id: "bear-trap",
    label: "Bear trap",

    description:
      "A powerful single-use trap capable of grievously injuring an unsuspecting tribute.",

    origin: "manufactured",

    tags: ["weapon", "tactical", "trap", "tool"],

    maxUses: 1,

    minimumStats: {
      brains: 3,
    },

    offense: {
      strategy: "trap",
    },
  },

  {
    id: "tripwire",
    label: "Tripwire",

    description:
      "A single-use wire trap that turns terrain and momentum against an approaching tribute.",

    origin: "manufactured",

    tags: ["weapon", "tactical", "trap", "tool"],

    maxUses: 1,

    minimumStats: {
      brains: 3,
    },

    offense: {
      strategy: "trap",
    },
  },

  {
    id: "firebomb",
    label: "Firebomb",

    description:
      "A dangerous single-use incendiary weapon that threatens both its target and its user.",

    origin: "manufactured",

    tags: ["weapon", "tactical", "consumable"],

    maxUses: 1,

    minimumStats: {
      brains: 3,
    },

    offense: {
      strategy: "risky-area",
    },
  },

  // Defensive equipment
  {
    id: "helmet",
    label: "Helmet",

    description: "A sturdy helmet that provides modest protection against hostile attacks.",

    origin: "manufactured",

    tags: ["tool", "defense"],

    defense: {
      checkedAttackBonus: 0.35,
      hostileTargetWeightMultiplier: 0.9,
    },
  },

  {
    id: "padded-armour",
    label: "Padded armour",

    description:
      "Layered protective clothing that softens impacts and makes its wearer a less appealing target.",

    origin: "manufactured",

    tags: ["tool", "defense"],

    defense: {
      checkedAttackBonus: 0.6,
      hostileTargetWeightMultiplier: 0.82,
    },
  },

  {
    id: "shield",
    label: "Shield",

    description: "A sturdy shield that provides strong active protection against hostile attacks.",

    origin: "manufactured",

    tags: ["tool", "defense"],

    defense: {
      checkedAttackBonus: 0.75,
      hostileTargetWeightMultiplier: 0.75,
    },
  },

  {
    id: "reinforced-armour",
    label: "Reinforced armour",

    description:
      "Heavy reinforced armour offering the strongest ordinary personal protection in the arena.",

    origin: "manufactured",

    tags: ["tool", "defense"],

    defense: {
      checkedAttackBonus: 1.1,
      hostileTargetWeightMultiplier: 0.62,
    },
  },
] satisfies readonly ItemDefinition[];

export function getItemDefinition(itemId: ItemDefinitionId): ItemDefinition {
  const definition = ITEM_CATALOGUE.find((candidate) => candidate.id === itemId);

  if (!definition) {
    throw new Error(`Unknown item definition "${itemId}".`);
  }

  return definition;
}
