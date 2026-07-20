import {
  isStatAtLeast,
  isStatAtMost,
  isSuccessfulStatCheckOutcome,
  resolveStatCheck,
  type StatCheckOutcome,
} from "~/game/events/event-outcomes";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import { getDefinitionPopulationMultiplier } from "~/game/engine/stat-formulas";
import { selectRandomItem, type RandomSource } from "~/game/engine/random";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { StatusEffectId } from "~/game/statuses/status-schema";
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

function createSurvivalChanges(tributes: readonly GameTribute[]): GameChange[] {
  return tributes.map((tribute) => ({
    type: "increment-statistic",
    tributeId: tribute.id,
    statistic: "eventsSurvived",
    amount: 1,
  }));
}

function createItemAcquisitionChanges(
  eventId: string,
  tribute: GameTribute,
  itemIds: readonly ItemDefinitionId[],
  round: EventResolutionContext["round"],
  giftsReceived = 0,
): GameChange[] {
  const changes: GameChange[] = itemIds.map((itemId) => ({
    type: "acquire-item",
    tributeId: tribute.id,
    item: createInventoryItemInstance(eventId, tribute.id, itemId, round),
  }));

  if (giftsReceived > 0) {
    changes.push({
      type: "increment-statistic",
      tributeId: tribute.id,
      statistic: "giftsReceived",
      amount: giftsReceived,
    });
  }

  changes.push(...createSurvivalChanges([tribute]));

  return changes;
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

function getItemLabel(itemId: ItemDefinitionId): string {
  return getItemDefinition(itemId).label.toLowerCase();
}

function selectPrizeItem(outcome: StatCheckOutcome, random: RandomSource): ItemDefinitionId {
  const itemPool = outcome === "exceptional-success" ? WEAPON_ITEM_IDS : SUPPLY_ITEM_IDS;

  return selectRandomItem(itemPool, random);
}

function createFailedPrizeChanges(
  eventId: string,
  tribute: GameTribute,
  outcome: StatCheckOutcome,
  round: EventResolutionContext["round"],
): GameChange[] {
  if (outcome === "critical-failure") {
    return [createStatusChange(eventId, tribute, "injured", 1, round)];
  }

  return createSurvivalChanges([tribute]);
}

export const LUCK_EVENTS = [
  {
    id: "sponsor-drone-malfunction",
    category: "survival",
    tags: ["survival", "item", "resource", "status", "hazard"],
    periods: ["day", "night"],
    baseWeight: 4,

    roles: [
      {
        id: "tribute",
        count: 1,

        isEligible: (tribute) => isStatAtLeast(tribute.snapshot.stats, "luck", 4),

        getWeight: (tribute) => tribute.snapshot.stats.luck,
      },
    ],

    isEligible: ({ state }) => state.config.giftsEnabled,

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const outcome = resolveStatCheck({
        stats: tribute.snapshot.stats,
        stat: "luck",
        difficulty: 3,
        random,
      });

      switch (outcome) {
        case "critical-failure": {
          const text =
            `${tribute.snapshot.name} waves at a sponsor drone. ` +
            "It mistakes them for a landing pad.";

          return {
            text,
            changes: [createStatusChange(eventId, tribute, "injured", 1, round)],
          };
        }

        case "failure": {
          const text =
            `A sponsor drone circles ${tribute.snapshot.name}, ` +
            "broadcasts hold music for ten minutes, and flies away.";

          return {
            text,
            changes: createSurvivalChanges([tribute]),
          };
        }

        case "success": {
          const itemId = selectRandomItem(SUPPLY_ITEM_IDS, random);

          const text =
            `A sponsor drone drops ${getItemLabel(itemId)} ` +
            `at ${tribute.snapshot.name}'s feet.`;

          return {
            text,
            changes: createItemAcquisitionChanges(eventId, tribute, [itemId], round, 1),
          };
        }

        case "exceptional-success": {
          const text =
            `A sponsor drone's cargo hatch bursts open above ` +
            `${tribute.snapshot.name}, dropping medicine and a bow.`;

          return {
            text,
            changes: createItemAcquisitionChanges(eventId, tribute, ["medicine", "bow"], round, 2),
          };
        }
      }
    },
  },

  {
    id: "runaway-vending-machine",
    category: "hazard",
    tags: ["hazard", "item", "resource", "status"],
    periods: ["day"],
    baseWeight: 4,

    roles: [
      {
        id: "tribute",
        count: 1,

        isEligible: (tribute) => isStatAtMost(tribute.snapshot.stats, "luck", 2),

        getWeight: (tribute) => 6 - tribute.snapshot.stats.luck,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const outcome = resolveStatCheck({
        stats: tribute.snapshot.stats,
        stat: "luck",
        difficulty: 2,
        random,
      });

      switch (outcome) {
        case "critical-failure": {
          const text =
            `${tribute.snapshot.name} tries to tip over a vending machine. ` +
            "The vending machine wins.";

          return {
            text,
            changes: [createStatusChange(eventId, tribute, "injured", 2, round)],
          };
        }

        case "failure": {
          const text =
            `${tribute.snapshot.name} feeds a pebble into a vending machine. ` +
            "It accepts the payment and dispenses one warm olive.";

          return {
            text,
            changes: createSurvivalChanges([tribute]),
          };
        }

        case "success": {
          const text =
            `${tribute.snapshot.name} bumps a vending machine once. ` +
            "It dispenses a bottle of water and a receipt for $0.00.";

          return {
            text,
            changes: createItemAcquisitionChanges(eventId, tribute, ["water"], round),
          };
        }

        case "exceptional-success": {
          const text =
            `${tribute.snapshot.name} leans against a vending machine. ` +
            "Its entire front falls off, revealing medicine and matches.";

          return {
            text,
            changes: createItemAcquisitionChanges(eventId, tribute, ["medicine", "matches"], round),
          };
        }
      }
    },
  },

  {
    id: "capitol-prize-crate",
    category: "survival",
    tags: ["survival", "item", "resource", "status", "hazard"],
    periods: ["day", "night"],
    baseWeight: 4,

    roles: [
      {
        id: "tributes",
        count: 2,
      },
    ],

    isEligible: ({ livingTributes }) => livingTributes.length >= 2,

    getWeightMultiplier: getDefinitionPopulationMultiplier,

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const [firstTribute, secondTribute] = requireParticipants(participantsByRole, "tributes");

      const firstOutcome = resolveStatCheck({
        stats: firstTribute.snapshot.stats,
        stat: "luck",
        difficulty: 3,
        random,
      });

      const secondOutcome = resolveStatCheck({
        stats: secondTribute.snapshot.stats,
        stat: "luck",
        difficulty: 3,
        random,
      });

      const firstSucceeded = isSuccessfulStatCheckOutcome(firstOutcome);

      const secondSucceeded = isSuccessfulStatCheckOutcome(secondOutcome);

      if (firstSucceeded && secondSucceeded) {
        const firstItemId = selectPrizeItem(firstOutcome, random);

        const secondItemId = selectPrizeItem(secondOutcome, random);

        const text =
          `${firstTribute.snapshot.name} and ${secondTribute.snapshot.name} ` +
          "slap the buttons on a Capitol prize crate at exactly the same time. " +
          `${firstTribute.snapshot.name} wins ${getItemLabel(firstItemId)}, ` +
          `while ${secondTribute.snapshot.name} wins ${getItemLabel(secondItemId)}.`;

        return {
          text,
          changes: [
            ...createItemAcquisitionChanges(eventId, firstTribute, [firstItemId], round),

            ...createItemAcquisitionChanges(eventId, secondTribute, [secondItemId], round),
          ],
        };
      }

      if (firstSucceeded !== secondSucceeded) {
        const successfulTribute = firstSucceeded ? firstTribute : secondTribute;

        const unsuccessfulTribute = firstSucceeded ? secondTribute : firstTribute;

        const successfulOutcome = firstSucceeded ? firstOutcome : secondOutcome;

        const unsuccessfulOutcome = firstSucceeded ? secondOutcome : firstOutcome;

        const itemId = selectPrizeItem(successfulOutcome, random);

        const loserText =
          unsuccessfulOutcome === "critical-failure"
            ? `A spring-loaded boxing glove hits ${unsuccessfulTribute.snapshot.name}.`
            : `${unsuccessfulTribute.snapshot.name} receives a commemorative sticker.`;

        const text =
          `${successfulTribute.snapshot.name} opens one side of a Capitol prize crate ` +
          `and wins ${getItemLabel(itemId)}. ${loserText}`;

        return {
          text,
          changes: [
            ...createItemAcquisitionChanges(eventId, successfulTribute, [itemId], round),

            ...createFailedPrizeChanges(eventId, unsuccessfulTribute, unsuccessfulOutcome, round),
          ],
        };
      }

      const hasCriticalFailure =
        firstOutcome === "critical-failure" || secondOutcome === "critical-failure";

      const text = hasCriticalFailure
        ? `${firstTribute.snapshot.name} and ${secondTribute.snapshot.name} ` +
          "open a Capitol prize crate. It deploys spring-loaded boxing gloves " +
          'and displays "BETTER LUCK NEXT TIME."'
        : `${firstTribute.snapshot.name} and ${secondTribute.snapshot.name} ` +
          "open a Capitol prize crate. It plays the anthem and prints two coupons " +
          "that expired yesterday.";

      return {
        text,
        changes: [
          ...createFailedPrizeChanges(eventId, firstTribute, firstOutcome, round),

          ...createFailedPrizeChanges(eventId, secondTribute, secondOutcome, round),
        ],
      };
    },
  },
] satisfies readonly EventDefinition[];
