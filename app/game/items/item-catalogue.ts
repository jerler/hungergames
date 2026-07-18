import type { ItemDefinition, ItemDefinitionId } from "./item-schema";

export const ITEM_CATALOGUE = [
  {
    id: "water",
    label: "Water bottle",
    description: "Clean water that automatically treats dehydration.",
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
    id: "medicine",
    label: "Medicine",
    description: "Medical supplies for bleeding and physical injuries.",
    tags: ["consumable", "medicine"],
    maxUses: 1,
    treatments: [
      {
        statusId: "bleeding",
        severityReduction: 3,
        durationReduction: 3,
        priority: 12,
      },
      {
        statusId: "injured",
        severityReduction: 2,
        durationReduction: 2,
        priority: 9,
      },
    ],
  },
  {
    id: "blanket",
    label: "Blanket",
    description: "A warm blanket that provides temporary shelter.",
    tags: ["shelter", "tool"],
    maxUses: 3,
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
    tags: ["tool"],
    maxUses: 3,
    survivalBonus: 0.25,
    foragingBonus: 0.2,
  },
  {
    id: "knife",
    label: "Knife",
    description: "A compact weapon that is also useful as a tool.",
    tags: ["weapon", "tool"],
    maxUses: 4,
    combatBonus: 1,
    foragingBonus: 0.15,
  },
  {
    id: "spear",
    label: "Spear",
    description: "A strong close- and medium-range weapon.",
    tags: ["weapon"],
    maxUses: 3,
    combatBonus: 1.35,
  },
  {
    id: "bow",
    label: "Bow and arrows",
    description: "A powerful ranged weapon with limited ammunition.",
    tags: ["weapon"],
    maxUses: 2,
    combatBonus: 1.6,
    awarenessBonus: 0.2,
  },
] satisfies readonly ItemDefinition[];

export function getItemDefinition(itemId: ItemDefinitionId): ItemDefinition {
  const definition = ITEM_CATALOGUE.find((candidate) => candidate.id === itemId);

  if (!definition) {
    throw new Error(`Unknown item definition "${itemId}".`);
  }

  return definition;
}
