import {
  resolveStatCheck,
  type EventStat,
  type StatCheckOutcome,
} from "~/game/events/event-outcomes";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import { getForagingScore, getVulnerabilityWeight } from "~/game/engine/stat-formulas";
import type { RandomSource } from "~/game/engine/random";
import {
  createInventoryItemInstance,
  findUsableInventoryItem,
} from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { GameChange, GameTribute, InventoryItem } from "~/game/types/game-state";
import type { TributeStatValue } from "~/game/types/tribute";

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
): StatCheckOutcome {
  const difficulty = clampDifficulty(
    baseDifficulty + getLuckDifficultyAdjustment(tribute.snapshot.stats.luck),
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

function requireEventItem(
  tribute: GameTribute,
  itemId: ItemDefinitionId,
  eventId: string,
): InventoryItem {
  const item = findUsableInventoryItem(tribute, {
    definitionIds: [itemId],
  });

  if (!item) {
    throw new Error(
      `Event "${eventId}" selected tribute "${tribute.id}" ` + `without a usable "${itemId}" item.`,
    );
  }

  return item;
}

export const TOOL_AND_WEAPON_EVENTS = [
  {
    id: "trap-kit-instructions-missing",
    category: "hazard",
    tags: ["hazard", "tool", "item", "status", "resource"],
    periods: ["day", "night"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["trap-kit"],

        getWeight: getForagingScore,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const trapKit = requireEventItem(tribute, "trap-kit", "trap-kit-instructions-missing");

      const outcome = resolveAdjustedStatCheck(tribute, "brains", 3, random);

      const consumeTrapKit = createItemConsumptionChange(
        tribute,
        trapKit,
        "trap-kit-instructions-missing",
      );

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} tries to assemble a trap kit ` +
              "without instructions and immediately catches themself.",

            changes: [createStatusChange(eventId, tribute, "injured", 1, round), consumeTrapKit],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} spends hours constructing a trap ` +
              "that repeatedly springs before anything approaches it.",

            changes: [createStatusChange(eventId, tribute, "exhausted", 1, round), consumeTrapKit],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} successfully assembles a trap ` +
              "and catches enough game for a meal.",

            changes: [
              ...createItemAcquisitionChanges(eventId, tribute, ["food"], round),
              consumeTrapKit,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} constructs an ingenious trap, ` +
              "secures food, and feels considerably more capable than before.",

            changes: [
              ...createItemAcquisitionChanges(eventId, tribute, ["food"], round),
              createStatusChange(eventId, tribute, "inspired", 1, round),
              consumeTrapKit,
            ],
          };
      }
    },
  },

  {
    id: "fishing-gear-enormous-fish",
    category: "hazard",
    tags: ["hazard", "tool", "item", "status", "resource"],
    periods: ["day"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["fishing-gear"],

        getWeight: getForagingScore,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const fishingGear = requireEventItem(tribute, "fishing-gear", "fishing-gear-enormous-fish");

      const outcome = resolveAdjustedStatCheck(tribute, "brawn", 3, random);

      const consumeFishingGear = createItemConsumptionChange(
        tribute,
        fishingGear,
        "fishing-gear-enormous-fish",
      );

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} hooks an enormous fish and is ` +
              "dragged violently through the water before cutting the line.",

            changes: [
              createStatusChange(eventId, tribute, "injured", 1, round),
              createStatusChange(eventId, tribute, "exhausted", 2, round),
              consumeFishingGear,
            ],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} battles an enormous fish for hours, ` +
              "only for it to escape at the last possible moment.",

            changes: [
              createStatusChange(eventId, tribute, "exhausted", 1, round),
              consumeFishingGear,
            ],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} lands an enormous fish ` +
              "and prepares enough food to keep going.",

            changes: [
              ...createItemAcquisitionChanges(eventId, tribute, ["food"], round),
              consumeFishingGear,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} lands a legendary arena fish ` +
              "and is briefly overwhelmed by their own competence.",

            changes: [
              ...createItemAcquisitionChanges(eventId, tribute, ["food"], round),
              createStatusChange(eventId, tribute, "inspired", 2, round),
              consumeFishingGear,
            ],
          };
      }
    },
  },

  {
    id: "axe-based-shelter-renovation",
    category: "hazard",
    tags: ["hazard", "environment", "weapon", "tool", "item", "status"],
    periods: ["day"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["axe"],
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const axe = requireEventItem(tribute, "axe", "axe-based-shelter-renovation");

      const outcome = resolveAdjustedStatCheck(tribute, "brains", 3, random);

      const consumeAxe = createItemConsumptionChange(tribute, axe, "axe-based-shelter-renovation");

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} attempts an ambitious shelter renovation, ` +
              "drops part of a tree on themself, and destroys the original shelter.",

            changes: [
              createStatusChange(eventId, tribute, "injured", 2, round),
              createStatusChange(eventId, tribute, "exposed", 1, round),
              consumeAxe,
            ],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} demolishes most of their shelter ` +
              "before realizing they had no clear renovation plan.",

            changes: [
              createStatusChange(eventId, tribute, "exhausted", 1, round),
              createStatusChange(eventId, tribute, "exposed", 1, round),
              consumeAxe,
            ],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} uses an axe to construct ` +
              "a sturdy shelter hidden among the trees.",

            changes: [
              createStatusChange(eventId, tribute, "concealed", 1, round),
              ...createSurvivalChanges([tribute]),
              consumeAxe,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} transforms a rough shelter ` +
              "into an exceptionally concealed arena hideout.",

            changes: [
              createStatusChange(eventId, tribute, "concealed", 2, round),
              createStatusChange(eventId, tribute, "inspired", 1, round),
              ...createSurvivalChanges([tribute]),
              consumeAxe,
            ],
          };
      }
    },
  },

  {
    id: "slingshot-trick-shot",
    category: "hazard",
    tags: ["hazard", "weapon", "item", "status", "resource"],
    periods: ["day"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["slingshot"],
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const slingshot = requireEventItem(tribute, "slingshot", "slingshot-trick-shot");

      const outcome = resolveAdjustedStatCheck(tribute, "brains", 3, random);

      const consumeSlingshot = createItemConsumptionChange(
        tribute,
        slingshot,
        "slingshot-trick-shot",
      );

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} attempts an elaborate ricochet shot ` +
              "and discovers exactly where the stone eventually returns.",

            changes: [createStatusChange(eventId, tribute, "injured", 1, round), consumeSlingshot],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} misses a trick shot completely ` +
              "and alerts something in the arena to their location.",

            changes: [createStatusChange(eventId, tribute, "hunted", 1, round), consumeSlingshot],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} uses a careful slingshot shot ` +
              "to knock edible fruit from a high branch.",

            changes: [
              ...createItemAcquisitionChanges(eventId, tribute, ["food"], round),
              consumeSlingshot,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} performs an impossible-looking trick shot, ` +
              "collects the fallen food, and feels extremely pleased with themself.",

            changes: [
              ...createItemAcquisitionChanges(eventId, tribute, ["food"], round),
              createStatusChange(eventId, tribute, "inspired", 1, round),
              consumeSlingshot,
            ],
          };
      }
    },
  },

  {
    id: "shield-used-for-everything-else",
    category: "hazard",
    tags: ["hazard", "tool", "item", "status", "resource"],
    periods: ["day", "night"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["shield"],

        getWeight: getVulnerabilityWeight,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const shield = requireEventItem(tribute, "shield", "shield-used-for-everything-else");

      const outcome = resolveAdjustedStatCheck(tribute, "brains", 3, random);

      const consumeShield = createItemConsumptionChange(
        tribute,
        shield,
        "shield-used-for-everything-else",
      );

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} uses their shield as a sled, ` +
              "discovers an unexpected ravine, and loses all sense of direction.",

            changes: [
              createStatusChange(eventId, tribute, "injured", 1, round),
              createStatusChange(eventId, tribute, "disoriented", 1, round),
              consumeShield,
            ],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} spends hours using their shield ` +
              "as a shovel before becoming firmly stuck in the mud.",

            changes: [createStatusChange(eventId, tribute, "exhausted", 1, round), consumeShield],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} uses their shield as a rain catcher ` +
              "and collects a clean supply of water.",

            changes: [
              ...createItemAcquisitionChanges(eventId, tribute, ["water"], round),
              consumeShield,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} uses their shield as a sled ` +
              "and accidentally glides directly into a hidden supply cache.",

            changes: [
              ...createItemAcquisitionChanges(eventId, tribute, ["food", "water"], round),
              consumeShield,
            ],
          };
      }
    },
  },
] satisfies readonly EventDefinition[];
