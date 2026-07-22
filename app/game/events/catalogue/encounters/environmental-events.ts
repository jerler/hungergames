import { selectRandomItem } from "~/game/engine/random";
import { getVulnerabilityWeight } from "~/game/engine/stat-formulas";
import {
  createFatalChanges,
  createItemAcquisitionAndSurvivalChanges,
  createItemUseChange,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import {
  findAccessibleInventoryItem,
  type AccessibleInventoryItem,
} from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { GameChange, GameTribute, InventoryItem } from "~/game/types/game-state";

const NATURAL_RESOURCE_ITEM_IDS = ["food", "water"] satisfies readonly ItemDefinitionId[];

interface BrushfireProtection {
  accessibleItem: AccessibleInventoryItem;
  difficultyReduction: number;
}

function findBrushfireProtection(
  context: EventResolutionContext,
  tribute: GameTribute,
): BrushfireProtection | null {
  const candidates = [
    {
      itemId: "water",
      difficultyReduction: 2,
    },
    {
      itemId: "blanket",
      difficultyReduction: 1,
    },
    {
      itemId: "shield",
      difficultyReduction: 1,
    },
  ] satisfies readonly {
    itemId: ItemDefinitionId;
    difficultyReduction: number;
  }[];

  for (const candidate of candidates) {
    const accessibleItem = findAccessibleInventoryItem(context.state, tribute, {
      definitionIds: [candidate.itemId],

      unavailableItemInstanceIds: context.unavailableItemInstanceIds,
    });

    if (accessibleItem) {
      return {
        accessibleItem,
        difficultyReduction: candidate.difficultyReduction,
      };
    }
  }

  return null;
}

function describeBrushfireProtection(item: InventoryItem): string {
  switch (item.definitionId) {
    case "water":
      return "uses their water to clear a path " + "through the flames";

    case "blanket":
      return "wraps themselves in a blanket " + "and smothers the embers";

    case "shield":
      return "uses their shield against the " + "sparks and falling debris";

    default:
      throw new Error(`Unsupported brushfire protection ` + `"${item.definitionId}".`);
  }
}

const victimRole = {
  id: "victim",
  count: 1,
  getWeight: getVulnerabilityWeight,
} as const;

export const ENVIRONMENTAL_EVENTS = [
  /* Day Only */
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

        changes: createFatalChanges(victim, "poisonous-berries", "Poisoned", text),
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

        changes: createFatalChanges(victim, "river-current", "Drowned", text),
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
        text: `${tribute.snapshot.name} is injured ` + "while crossing rough terrain.",

        changes: [createStatusChange(eventId, tribute, "injured", 1, round)],
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
        text: `${tribute.snapshot.name} drinks ` + "contaminated water and becomes dehydrated.",

        changes: [createStatusChange(eventId, tribute, "dehydrated", 2, round)],
      };
    },
  },

  {
    id: "arena-goose",
    category: "hazard",
    tags: ["hazard", "status", "resource"],
    periods: ["day"],
    baseWeight: 4.5,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getVulnerabilityWeight,
      },
    ],

    resolve(context): EventResolution {
      const { eventId, round, random, participantsByRole } = context;

      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const food = findAccessibleInventoryItem(context.state, tribute, {
        definitionIds: ["food"],

        unavailableItemInstanceIds: context.unavailableItemInstanceIds,
      });

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brawn", 3, random);

      switch (outcome) {
        case "critical-failure": {
          const changes: GameChange[] = [createStatusChange(eventId, tribute, "hunted", 2, round)];

          if (food) {
            changes.push(createItemUseChange(food.owner, food.item, "arena-goose-theft"));
          }

          return {
            text: food
              ? `${tribute.snapshot.name} loses some ` +
                "food to an arena goose, which then " +
                "decides to pursue them across the arena."
              : `An arena goose decides ` +
                `${tribute.snapshot.name} owes it food ` +
                "and begins relentlessly tracking them.",

            changes,
          };
        }

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} spends hours ` +
              "fleeing an arena goose and collapses " +
              "from exhaustion.",

            changes: [createStatusChange(eventId, tribute, "exhausted", 1, round)],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} stands their ` +
              "ground against an arena goose. After a " +
              "tense silence, both parties retreat.",

            changes: createSurvivalChanges([tribute]),
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} befriends an ` +
              "arena goose, which leads them to a patch " +
              "of edible plants.",

            changes: createItemAcquisitionAndSurvivalChanges(
              eventId,
              tribute,
              ["food"],
              round,
              "natural-foraging",
            ),
          };
      }
    },
  },

  {
    id: "brushfire-supply-run",
    category: "hazard",
    tags: ["hazard", "environment", "item", "status", "resource"],
    periods: ["day"],
    baseWeight: 4,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getVulnerabilityWeight,
      },
    ],

    resolve(context): EventResolution {
      const { eventId, round, random, participantsByRole } = context;

      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const protection = findBrushfireProtection(context, tribute);

      const outcome = resolveLuckAdjustedStatCheck(
        tribute,
        "brawn",
        4,
        random,
        protection?.difficultyReduction ?? 0,
      );

      const protectionChanges = protection
        ? [
            createItemUseChange(
              protection.accessibleItem.owner,
              protection.accessibleItem.item,
              "brushfire-protection",
            ),
          ]
        : [];

      const protectionText = protection
        ? `${tribute.snapshot.name} ` + describeBrushfireProtection(protection.accessibleItem.item)
        : `${tribute.snapshot.name} runs ` + "through the brushfire without protection";

      switch (outcome) {
        case "critical-failure":
          return {
            text: `${protectionText}, but is badly ` + "burned before reaching safety.",

            changes: [
              createStatusChange(eventId, tribute, "burned", 2, round),

              ...protectionChanges,
            ],
          };

        case "failure":
          return {
            text: `${protectionText} and escapes with ` + "painful burns.",

            changes: [
              createStatusChange(eventId, tribute, "burned", 1, round),

              ...protectionChanges,
            ],
          };

        case "success":
          return {
            text: `${protectionText} and successfully ` + "reaches the far side.",

            changes: [...createSurvivalChanges([tribute]), ...protectionChanges],
          };

        case "exceptional-success": {
          const itemId = selectRandomItem(NATURAL_RESOURCE_ITEM_IDS, random);

          const resourceText = itemId === "water" ? "a clean stream" : "a patch of edible plants";

          return {
            text:
              `${protectionText}, reaches safety, and ` +
              `discovers ${resourceText} beyond the ` +
              "burned ground.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                [itemId],
                round,
                "natural-foraging",
              ),

              ...protectionChanges,
            ],
          };
        }
      }
    },
  },

  /* Night Only */
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

        changes: createFatalChanges(victim, "freezing-night", "Froze", text),
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
        text: `${tribute.snapshot.name} is caught ` + "without shelter in freezing rain.",

        changes: [createStatusChange(eventId, tribute, "exposed", 2, round)],
      };
    },
  },

  /* Day and Night */
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
        `${victim.snapshot.name} loses their ` + "footing near a cliff and falls to their death.";

      return {
        text,

        changes: createFatalChanges(victim, "fallen-cliff", "Fell", text),
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
        text: `${tribute.snapshot.name} suffers a deep ` + "cut and begins bleeding.",

        changes: [createStatusChange(eventId, tribute, "bleeding", 2, round)],
      };
    },
  },
] satisfies readonly EventDefinition[];
