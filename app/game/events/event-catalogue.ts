import type { EventDefinition, EventResolution } from "~/game/events/event-schema";
import { requireParticipants, requireSingleParticipant } from "~/game/events/event-schema";
import {
  getAwarenessScore,
  getDefinitionPopulationMultiplier,
  getForagingScore,
  getSurvivalSelectionWeight,
  getVulnerabilityWeight,
} from "~/game/engine/stat-formulas";
import type { GameChange, GameTribute } from "~/game/types/game-state";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { EventResolutionContext } from "~/game/events/event-schema";
import { selectRandomItem } from "~/game/engine/random";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { createCombatantRole } from "~/game/events/participant-role-builders";

function createFatalChanges(
  victim: GameTribute,
  causeId: string,
  causeLabel: string,
  summary: string,
  killer: GameTribute | null,
): GameChange[] {
  const killerTributeIds = killer ? [killer.id] : [];

  const changes: GameChange[] = [
    {
      type: "eliminate-tribute",
      tributeId: victim.id,
      causeId,
      causeLabel,
      summary,
      killerTributeIds,
    },
  ];

  if (killer) {
    changes.push(
      {
        type: "increment-statistic",
        tributeId: killer.id,
        statistic: "attemptedKills",
        amount: 1,
      },
      {
        type: "increment-statistic",
        tributeId: killer.id,
        statistic: "kills",
        amount: 1,
      },
    );
  }

  return changes;
}

function createSurvivalChanges(participants: readonly GameTribute[]): GameChange[] {
  return participants.map((tribute) => ({
    type: "increment-statistic",
    tributeId: tribute.id,
    statistic: "eventsSurvived",
    amount: 1,
  }));
}

const victimRole = {
  id: "victim",
  count: 1,
  getWeight: getVulnerabilityWeight,
} as const;

const SUPPLY_ITEM_IDS = [
  "medicine",
  "blanket",
  "matches",
  "rope",
] satisfies readonly ItemDefinitionId[];

const WEAPON_ITEM_IDS = ["knife", "spear", "bow"] satisfies readonly ItemDefinitionId[];

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

export const EVENT_CATALOGUE = [
  {
    id: "knife-ambush",
    category: "fatal",
    tags: ["fatal", "combat", "weapon"],
    periods: ["day", "night"],
    baseWeight: 2.5,
    roles: [
      victimRole,
      createCombatantRole({
        requiredItemDefinitionIds: ["knife"],
      }),
    ],

    isEligible: ({ livingTributes }) => livingTributes.length >= 2,

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const killer = requireSingleParticipant(participantsByRole, "killer");

      const knife = killer.inventory.find(
        (item) => item.definitionId === "knife" && item.usesRemaining > 0,
      );

      if (!knife) {
        throw new Error("Knife ambush selected a killer without a knife.");
      }

      const text =
        `${killer.snapshot.name} catches ` +
        `${victim.snapshot.name} by surprise ` +
        "and kills them with a knife.";

      return {
        text,

        changes: [
          ...createFatalChanges(victim, "knife-ambush", "Knifed", text, killer),
          {
            type: "consume-item",
            tributeId: killer.id,
            itemInstanceId: knife.id,
            uses: 1,
            reason: "knife-ambush",
          },
        ],
      };
    },
  },
  {
    id: "spear-attack",
    category: "fatal",
    tags: ["fatal", "combat", "weapon"],
    periods: ["day"],
    baseWeight: 2.25,
    roles: [
      victimRole,
      createCombatantRole({
        requiredItemDefinitionIds: ["spear"],
      }),
    ],
    isEligible: ({ livingTributes }) => livingTributes.length >= 2,

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const killer = requireSingleParticipant(participantsByRole, "killer");

      const spear = killer.inventory.find(
        (item) => item.definitionId === "spear" && item.usesRemaining > 0,
      );

      if (!spear) {
        throw new Error("Spear attack selected a killer without a spear.");
      }

      const text =
        `${killer.snapshot.name} strikes ` + `${victim.snapshot.name} down with a spear.`;

      return {
        text,
        changes: [
          ...createFatalChanges(victim, "spear-attack", "Speared", text, killer),
          {
            type: "consume-item",
            tributeId: killer.id,
            itemInstanceId: spear.id,
            uses: 1,
            reason: "spear-attack",
          },
        ],
      };
    },
  },
  {
    id: "fallen-cliff",
    category: "fatal",
    tags: ["fatal", "hazard"],
    periods: ["day", "night"],
    baseWeight: 2,
    roles: [
      {
        ...victimRole,
        getWeight: (tribute) => Math.max(0.25, 6 - tribute.snapshot.stats.luck),
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const text =
        `${victim.snapshot.name} loses their footing ` + "near a cliff and falls to their death.";

      return {
        text,
        changes: createFatalChanges(victim, "fallen-cliff", "Fell", text, null),
      };
    },
  },

  {
    id: "poisonous-berries",
    category: "fatal",
    tags: ["fatal", "hazard"],
    periods: ["day"],
    baseWeight: 2,
    roles: [
      {
        id: "victim",
        count: 1,

        isEligible: (tribute) => tribute.snapshot.stats.brains <= 4,

        getWeight: (tribute) => Math.max(0.25, 6 - tribute.snapshot.stats.brains),
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const text = `${victim.snapshot.name} mistakes ` + "poisonous berries for food.";

      return {
        text,
        changes: createFatalChanges(victim, "poisonous-berries", "Poisoned", text, null),
      };
    },
  },

  {
    id: "freezing-night",
    category: "fatal",
    tags: ["fatal", "hazard"],
    periods: ["night"],
    baseWeight: 2.25,
    roles: [
      {
        ...victimRole,

        isEligible: (tribute) => tribute.snapshot.stats.brawn <= 4,
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const text =
        `${victim.snapshot.name} is unable to find ` + "shelter and freezes during the night.";

      return {
        text,
        changes: createFatalChanges(victim, "freezing-night", "Froze", text, null),
      };
    },
  },

  {
    id: "river-current",
    category: "fatal",
    tags: ["fatal", "hazard"],
    periods: ["day"],
    baseWeight: 2,
    roles: [
      {
        id: "victim",
        count: 1,

        isEligible: (tribute) => tribute.snapshot.stats.brawn <= 4,

        getWeight: (tribute) => Math.max(0.25, 6 - tribute.snapshot.stats.brawn),
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const text = `${victim.snapshot.name} is swept away ` + "while crossing a violent river.";

      return {
        text,
        changes: createFatalChanges(victim, "river-current", "Drowned", text, null),
      };
    },
  },
  {
    id: "rough-terrain",
    category: "hazard",
    tags: ["hazard", "status", "environment"],
    periods: ["day"],
    baseWeight: 6,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getVulnerabilityWeight,
      },
    ],

    resolve({ eventId, round, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} is injured while ` + "crossing rough terrain.",

        changes: [
          {
            type: "apply-status",
            tributeId: tribute.id,

            status: createStatusEffectInstance(eventId, tribute.id, "injured", 1, round),
          },
        ],
      };
    },
  },
  {
    id: "deep-cut",
    category: "hazard",
    tags: ["hazard", "status"],
    periods: ["day", "night"],
    baseWeight: 4,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getVulnerabilityWeight,
      },
    ],

    resolve({ eventId, round, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} suffers a deep cut and begins bleeding.`,

        changes: [
          {
            type: "apply-status",
            tributeId: tribute.id,

            status: createStatusEffectInstance(eventId, tribute.id, "bleeding", 2, round),
          },
        ],
      };
    },
  },
  {
    id: "contaminated-water",
    category: "hazard",
    tags: ["hazard", "status", "environment"],
    periods: ["day"],
    baseWeight: 5,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getVulnerabilityWeight,
      },
    ],

    resolve({ eventId, round, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} drinks contaminated water and becomes dehydrated.`,

        changes: [
          {
            type: "apply-status",
            tributeId: tribute.id,

            status: createStatusEffectInstance(eventId, tribute.id, "dehydrated", 2, round),
          },
        ],
      };
    },
  },
  {
    id: "cold-rain",
    category: "hazard",
    tags: ["hazard", "status", "environment"],
    periods: ["night"],
    baseWeight: 6,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getVulnerabilityWeight,
      },
    ],

    resolve({ eventId, round, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} is caught without shelter in freezing rain.`,

        changes: [
          {
            type: "apply-status",
            tributeId: tribute.id,

            status: createStatusEffectInstance(eventId, tribute.id, "exposed", 2, round),
          },
        ],
      };
    },
  },
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
        text: `${tribute.snapshot.name} discovers a discarded ${itemId}.`,

        changes: createItemAcquisitionChanges(eventId, tribute, itemId, round),
      };
    },
  },

  {
    id: "temporary-truce",
    category: "survival",
    tags: ["survival"],
    periods: ["day", "night"],
    baseWeight: 7,
    roles: [
      {
        id: "tributes",
        count: 2,
      },
    ],

    isEligible: ({ livingTributes }) => livingTributes.length >= 2,

    getWeightMultiplier: getDefinitionPopulationMultiplier,

    resolve({ participantsByRole }): EventResolution {
      const [firstTribute, secondTribute] = requireParticipants(participantsByRole, "tributes");

      return {
        text:
          `${firstTribute.snapshot.name} and ` +
          `${secondTribute.snapshot.name} agree ` +
          "to a temporary truce.",

        changes: createSurvivalChanges([firstTribute, secondTribute]),
      };
    },
  },
] satisfies readonly EventDefinition[];
