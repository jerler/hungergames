import {
  isStatAtLeast,
  resolveStatCheck,
  type EventStat,
  type StatCheckOutcome,
} from "~/game/events/event-outcomes";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import {
  getDefinitionPopulationMultiplier,
  getForagingScore,
  getVulnerabilityWeight,
} from "~/game/engine/stat-formulas";
import { selectRandomItem, type RandomSource } from "~/game/engine/random";
import {
  createInventoryItemInstance,
  findUsableInventoryItem,
} from "~/game/items/inventory-engine";
import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { GameChange, GameTribute, InventoryItem } from "~/game/types/game-state";
import type { TributeStatValue } from "~/game/types/tribute";
import { getCooperativeTruceWeight } from "~/game/truces/truce-selection";

const CACHE_ITEM_IDS = ["water", "food", "medicine"] satisfies readonly ItemDefinitionId[];

interface BrushfireProtection {
  item: InventoryItem;
  difficultyReduction: number;
}

function clampDifficulty(difficulty: number): TributeStatValue {
  return Math.max(1, Math.min(5, Math.round(difficulty))) as TributeStatValue;
}

function getLuckDifficultyAdjustment(luck: TributeStatValue): number {
  if (luck >= 4) {
    return -1;
  }

  if (luck <= 2) {
    return 1;
  }

  return 0;
}

function resolveAdjustedStatCheck(
  tribute: GameTribute,
  stat: EventStat,
  baseDifficulty: TributeStatValue,
  random: RandomSource,
  difficultyReduction = 0,
): StatCheckOutcome {
  const difficulty = clampDifficulty(
    baseDifficulty + getLuckDifficultyAdjustment(tribute.snapshot.stats.luck) - difficultyReduction,
  );

  return resolveStatCheck({
    stats: tribute.snapshot.stats,
    stat,
    difficulty,
    random,
  });
}

function createSurvivalChanges(tributes: readonly GameTribute[]): GameChange[] {
  return tributes.map((tribute) => ({
    type: "increment-statistic",
    tributeId: tribute.id,
    statistic: "eventsSurvived",
    amount: 1,
  }));
}

function createStatusChange(
  eventId: string,
  tribute: GameTribute,
  statusId: StatusEffectId,
  severity: 1 | 2 | 3,
  round: EventResolutionContext["round"],
): GameChange {
  return {
    type: "apply-status",
    tributeId: tribute.id,

    status: createStatusEffectInstance(eventId, tribute.id, statusId, severity, round),
  };
}

function createItemAcquisitionChanges(
  eventId: string,
  tribute: GameTribute,
  itemIds: readonly ItemDefinitionId[],
  round: EventResolutionContext["round"],
): GameChange[] {
  return [
    ...itemIds.map((itemId): GameChange => ({
      type: "acquire-item",
      tributeId: tribute.id,

      item: createInventoryItemInstance(eventId, tribute.id, itemId, round),
    })),

    ...createSurvivalChanges([tribute]),
  ];
}

function createItemConsumptionChange(
  tribute: GameTribute,
  item: InventoryItem,
  reason: string,
): GameChange {
  return {
    type: "consume-item",
    tributeId: tribute.id,
    itemInstanceId: item.id,
    uses: 1,
    reason,
  };
}

function getItemLabel(itemId: ItemDefinitionId): string {
  return getItemDefinition(itemId).label.toLowerCase();
}

function resolvePicnicParticipant(
  eventId: string,
  round: EventResolutionContext["round"],
  tribute: GameTribute,
  outcome: StatCheckOutcome,
): {
  sentence: string;
  changes: GameChange[];
} {
  switch (outcome) {
    case "critical-failure":
      return {
        sentence: `${tribute.snapshot.name} eats the fluorescent berries ` + "and is poisoned.",

        changes: [createStatusChange(eventId, tribute, "poisoned", 1, round)],
      };

    case "failure":
      return {
        sentence: `${tribute.snapshot.name} trusts the custard ` + "and becomes sick.",

        changes: [createStatusChange(eventId, tribute, "sick", 1, round)],
      };

    case "success":
      return {
        sentence: `${tribute.snapshot.name} identifies the safe dishes ` + "and pockets some food.",

        changes: createItemAcquisitionChanges(eventId, tribute, ["food"], round),
      };

    case "exceptional-success":
      return {
        sentence:
          `${tribute.snapshot.name} finds sealed food and water ` + "hidden beneath the table.",

        changes: createItemAcquisitionChanges(eventId, tribute, ["food", "water"], round),
      };
  }
}

function findBrushfireProtection(tribute: GameTribute): BrushfireProtection | null {
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
    const item = findUsableInventoryItem(tribute, {
      definitionIds: [candidate.itemId],
    });

    if (item) {
      return {
        item,
        difficultyReduction: candidate.difficultyReduction,
      };
    }
  }

  return null;
}

function describeBrushfireProtection(item: InventoryItem): string {
  switch (item.definitionId) {
    case "water":
      return "uses their water to clear a path through the flames";

    case "blanket":
      return "wraps themselves in a blanket and smothers the embers";

    case "shield":
      return "uses their shield against the sparks and falling debris";

    default:
      throw new Error(`Unsupported brushfire protection "${item.definitionId}".`);
  }
}

export const SURVIVAL_MISADVENTURE_EVENTS = [
  {
    id: "upside-down-map",
    category: "survival",
    tags: ["survival", "item", "tool", "status", "resource"],
    periods: ["day"],
    baseWeight: 4,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getForagingScore,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const outcome = resolveAdjustedStatCheck(tribute, "brains", 3, random);

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} follows an arena map for hours ` +
              "before realizing it was upside down.",

            changes: [createStatusChange(eventId, tribute, "disoriented", 2, round)],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} attempts to follow a damaged map ` +
              "and becomes hopelessly turned around.",

            changes: [createStatusChange(eventId, tribute, "disoriented", 1, round)],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} corrects an upside-down arena map ` +
              "and keeps it for later.",

            changes: createItemAcquisitionChanges(eventId, tribute, ["map"], round),
          };

        case "exceptional-success": {
          const cacheItemId = selectRandomItem(CACHE_ITEM_IDS, random);

          return {
            text:
              `${tribute.snapshot.name} corrects an upside-down map ` +
              `and follows it to a cache containing ${getItemLabel(cacheItemId)}.`,

            changes: createItemAcquisitionChanges(eventId, tribute, ["map", cacheItemId], round),
          };
        }
      }
    },
  },

  {
    id: "suspicious-picnic",
    category: "hazard",
    tags: ["hazard", "item", "status", "resource"],
    periods: ["day"],
    baseWeight: 4,

    roles: [
      {
        id: "tributes",
        count: 2,

        getWeight: (tribute, { state, participantsByRole }) =>
          getCooperativeTruceWeight(state, tribute, participantsByRole.tributes ?? []),
      },
    ],

    isEligible: ({ livingTributes }) => livingTributes.length >= 2,

    getWeightMultiplier: getDefinitionPopulationMultiplier,

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const [firstTribute, secondTribute] = requireParticipants(participantsByRole, "tributes");

      const firstOutcome = resolveAdjustedStatCheck(firstTribute, "brains", 3, random);

      const secondOutcome = resolveAdjustedStatCheck(secondTribute, "brains", 3, random);

      const firstResolution = resolvePicnicParticipant(eventId, round, firstTribute, firstOutcome);

      const secondResolution = resolvePicnicParticipant(
        eventId,
        round,
        secondTribute,
        secondOutcome,
      );

      return {
        text:
          `${firstTribute.snapshot.name} and ${secondTribute.snapshot.name} ` +
          "discover a fully prepared picnic in the middle of the arena. " +
          `${firstResolution.sentence} ${secondResolution.sentence}`,

        changes: [...firstResolution.changes, ...secondResolution.changes],
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

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const food = findUsableInventoryItem(tribute, {
        definitionIds: ["food"],
      });

      const outcome = resolveAdjustedStatCheck(tribute, "brawn", 3, random);

      switch (outcome) {
        case "critical-failure": {
          const changes: GameChange[] = [createStatusChange(eventId, tribute, "hunted", 2, round)];

          if (food) {
            changes.push(createItemConsumptionChange(tribute, food, "arena-goose-theft"));
          }

          return {
            text: food
              ? `${tribute.snapshot.name} loses some food to an arena goose, ` +
                "which then decides to pursue them across the arena."
              : `An arena goose decides ${tribute.snapshot.name} owes it food ` +
                "and begins relentlessly tracking them.",

            changes,
          };
        }

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} spends hours fleeing an arena goose ` +
              "and collapses from exhaustion.",

            changes: [createStatusChange(eventId, tribute, "exhausted", 1, round)],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} stands their ground against an arena goose. ` +
              "After a tense silence, both parties retreat.",

            changes: createSurvivalChanges([tribute]),
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} befriends an arena goose, ` +
              "which leads them to an abandoned package of food.",

            changes: createItemAcquisitionChanges(eventId, tribute, ["food"], round),
          };
      }
    },
  },

  {
    id: "camouflage-catastrophe",
    category: "hazard",
    tags: ["hazard", "item", "tool", "status"],
    periods: ["day", "night"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["camouflage-net"],
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const net = findUsableInventoryItem(tribute, {
        definitionIds: ["camouflage-net"],
      });

      if (!net) {
        throw new Error("Camouflage catastrophe selected a tribute without a camouflage net.");
      }

      const outcome = resolveAdjustedStatCheck(tribute, "brains", 3, random);

      const consumeNet = createItemConsumptionChange(tribute, net, "camouflage-catastrophe");

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} becomes completely tangled ` +
              "in their camouflage net and loses all sense of direction.",

            changes: [createStatusChange(eventId, tribute, "disoriented", 1, round), consumeNet],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} hangs their camouflage net backwards, ` +
              "creating an extremely visible tribute-shaped landmark.",

            changes: [createStatusChange(eventId, tribute, "hunted", 1, round), consumeNet],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} uses their camouflage net ` +
              "to disappear into the surrounding terrain.",

            changes: [createStatusChange(eventId, tribute, "concealed", 1, round), consumeNet],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} constructs an almost perfect hideout ` +
              "with their camouflage net.",

            changes: [createStatusChange(eventId, tribute, "concealed", 2, round), consumeNet],
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

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const protection = findBrushfireProtection(tribute);

      const outcome = resolveAdjustedStatCheck(
        tribute,
        "brawn",
        4,
        random,
        protection?.difficultyReduction ?? 0,
      );

      const protectionChanges = protection
        ? [createItemConsumptionChange(tribute, protection.item, "brushfire-protection")]
        : [];

      const protectionText = protection
        ? `${tribute.snapshot.name} ${describeBrushfireProtection(protection.item)}`
        : `${tribute.snapshot.name} runs through the brushfire without protection`;

      switch (outcome) {
        case "critical-failure":
          return {
            text: `${protectionText}, but is badly burned before reaching safety.`,

            changes: [
              createStatusChange(eventId, tribute, "burned", 2, round),
              ...protectionChanges,
            ],
          };

        case "failure":
          return {
            text: `${protectionText} and escapes with painful burns.`,

            changes: [
              createStatusChange(eventId, tribute, "burned", 1, round),
              ...protectionChanges,
            ],
          };

        case "success":
          return {
            text: `${protectionText} and successfully reaches the far side.`,

            changes: [...createSurvivalChanges([tribute]), ...protectionChanges],
          };

        case "exceptional-success": {
          const itemId = selectRandomItem(CACHE_ITEM_IDS, random);

          return {
            text:
              `${protectionText}, reaches an abandoned supply cache, ` +
              `and retrieves ${getItemLabel(itemId)} before the fire closes in.`,

            changes: [
              ...createItemAcquisitionChanges(eventId, tribute, [itemId], round),
              ...protectionChanges,
            ],
          };
        }
      }
    },
  },

  {
    id: "unexpected-pep-talk",
    category: "survival",
    tags: ["survival", "status"],
    periods: ["day", "night"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        isEligible: (tribute) => isStatAtLeast(tribute.snapshot.stats, "luck", 4),

        getWeight: (tribute) => tribute.snapshot.stats.luck,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const outcome = resolveStatCheck({
        stats: tribute.snapshot.stats,
        stat: "luck",
        difficulty: 3,
        random,
      });

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} receives an arena message advising them ` +
              'to "believe in the feet they can become." They are left deeply confused.',

            changes: [createStatusChange(eventId, tribute, "disoriented", 1, round)],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} receives an aggressively generic pep talk ` +
              "that provides no useful information whatsoever.",

            changes: createSurvivalChanges([tribute]),
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} hears a well-timed message of encouragement ` +
              "and feels newly determined.",

            changes: [createStatusChange(eventId, tribute, "inspired", 1, round)],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} receives exactly the encouragement ` +
              "they needed and feels unstoppable.",

            changes: [createStatusChange(eventId, tribute, "inspired", 2, round)],
          };
      }
    },
  },
] satisfies readonly EventDefinition[];
