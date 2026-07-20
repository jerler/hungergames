import { selectRandomItem } from "~/game/engine/random";
import {
  getAwarenessScore,
  getForagingScore,
  getSurvivalSelectionWeight,
} from "~/game/engine/stat-formulas";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { GameChange, GameTribute } from "~/game/types/game-state";

const SUPPLY_ITEM_IDS = [
  "water",
  "food",
  "medicine",
  "blanket",
  "matches",
  "rope",
  "map",
  "trap-kit",
  "camouflage-net",
  "fishing-gear",
  "shield",
] satisfies readonly ItemDefinitionId[];

const WEAPON_ITEM_IDS = [
  "knife",
  "slingshot",
  "spear",
  "axe",
  "bow",
] satisfies readonly ItemDefinitionId[];

function createSurvivalChanges(participants: readonly GameTribute[]): GameChange[] {
  return participants.map((tribute) => ({
    type: "increment-statistic",
    tributeId: tribute.id,
    statistic: "eventsSurvived",
    amount: 1,
  }));
}

function createItemAcquisitionChanges(
  eventId: string,
  tribute: GameTribute,
  itemId: ItemDefinitionId,
  round: EventResolutionContext["round"],
): GameChange[] {
  return [
    {
      type: "acquire-item",
      tributeId: tribute.id,

      item: createInventoryItemInstance(eventId, tribute.id, itemId, round),
    },
    {
      type: "increment-statistic",
      tributeId: tribute.id,
      statistic: "eventsSurvived",
      amount: 1,
    },
  ];
}

export const SURVIVAL_EVENTS = [
  {
    id: "finds-water",
    category: "survival",
    tags: ["survival", "item", "resource"],
    periods: ["day"],
    baseWeight: 8,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getSurvivalSelectionWeight,
      },
    ],

    resolve({ eventId, round, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} discovers ` + "a bottle of clean water.",

        changes: createItemAcquisitionChanges(eventId, tribute, "water", round),
      };
    },
  },

  {
    id: "finds-hiding-place",
    category: "survival",
    tags: ["survival", "resource"],
    periods: ["day", "night"],
    baseWeight: 8,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getSurvivalSelectionWeight,
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} finds ` + "a concealed place to rest.",

        changes: createSurvivalChanges([tribute]),
      };
    },
  },

  {
    id: "keeps-watch",
    category: "survival",
    tags: ["survival", "resource"],
    periods: ["night"],
    baseWeight: 8,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getAwarenessScore,
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} stays awake ` + "through the night, listening for danger.",

        changes: createSurvivalChanges([tribute]),
      };
    },
  },

  {
    id: "searches-for-supplies",
    category: "survival",
    tags: ["survival", "item", "resource"],
    periods: ["day"],
    baseWeight: 8,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getForagingScore,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const itemId = selectRandomItem(SUPPLY_ITEM_IDS, random);

      return {
        text:
          `${tribute.snapshot.name} searches an abandoned ` + `supply crate and finds ${itemId}.`,

        changes: createItemAcquisitionChanges(eventId, tribute, itemId, round),
      };
    },
  },

  {
    id: "finds-weapon",
    category: "survival",
    tags: ["survival", "item", "weapon"],
    periods: ["day", "night"],
    baseWeight: 6,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getForagingScore,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const itemId = selectRandomItem(WEAPON_ITEM_IDS, random);

      return {
        text: `${tribute.snapshot.name} discovers ` + `a discarded ${itemId}.`,

        changes: createItemAcquisitionChanges(eventId, tribute, itemId, round),
      };
    },
  },
] satisfies readonly EventDefinition[];
