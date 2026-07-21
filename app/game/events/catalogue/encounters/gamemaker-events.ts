import { selectRandomItem, type RandomSource } from "~/game/engine/random";
import { getDefinitionPopulationMultiplier } from "~/game/engine/stat-formulas";
import {
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { getItemLabel } from "~/game/events/event-resolution-helpers";
import {
  isSuccessfulStatCheckOutcome,
  resolveStatCheck,
  type StatCheckOutcome,
} from "~/game/events/event-outcomes";
import {
  requireParticipants,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
} from "~/game/events/event-schema";
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

export const GAMEMAKER_EVENTS = [
  /* Day Only */

  /* Night Only */

  /* Day and Night */
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
            ...createItemAcquisitionAndSurvivalChanges(eventId, firstTribute, [firstItemId], round),

            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              secondTribute,
              [secondItemId],
              round,
            ),
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
            ...createItemAcquisitionAndSurvivalChanges(eventId, successfulTribute, [itemId], round),

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
