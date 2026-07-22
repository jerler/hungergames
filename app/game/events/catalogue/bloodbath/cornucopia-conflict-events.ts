import { selectRandomItem } from "~/game/engine/random";
import { getCombatScore } from "~/game/engine/stat-formulas";
import {
  createFatalChanges,
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { resolveLuckAdjustedStatCheck } from
  "~/game/events/event-resolution-helpers";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { GameTribute } from "~/game/types/game-state";
import type { TributeStatValue } from "~/game/types/tribute";

const CONTESTED_WEAPON_ITEM_IDS = [
  "knife",
  "slingshot",
  "spear",
  "axe",
  "bow",
] satisfies readonly ItemDefinitionId[];

const CONTESTED_PACK_ITEM_IDS = [
  "medicine",
  "blanket",
  "matches",
  "rope",
  "map",
  "camouflage-net",
  "fishing-gear",
  "trap-kit",
  "shield",
] satisfies readonly ItemDefinitionId[];

interface CornucopiaConflictDefinitionOptions {
  id: string;
  baseWeight: number;
  itemIds: readonly ItemDefinitionId[];
  resourceDescription: string;
}

function getConflictDifficulty(
  defender: GameTribute,
): TributeStatValue {
  return Math.max(
    1,
    Math.min(
      5,
      Math.round(getCombatScore(defender)),
    ),
  ) as TributeStatValue;
}

function getBrainsDifficultyReduction(
  tribute: GameTribute,
): number {
  if (tribute.snapshot.stats.brains === 5) {
    return 2;
  }

  if (tribute.snapshot.stats.brains === 4) {
    return 1;
  }

  return 0;
}

function createCornucopiaConflictEvent({
  id,
  baseWeight,
  itemIds,
  resourceDescription,
}: CornucopiaConflictDefinitionOptions): EventDefinition {
  return {
    id,
    category: "hazard",

    tags: [
      "hazard",
      "combat",
      "item",
      "resource",
    ],

    periods: ["day"],
    baseWeight,

    roles: [
      {
        id: "attacker",
        count: 1,
        opposesRoleIds: ["defender"],
      },
      {
        id: "defender",
        count: 1,
        opposesRoleIds: ["attacker"],
      },
    ],

    resolve({
      eventId,
      round,
      random,
      participantsByRole,
    }): EventResolution {
      const attacker = requireSingleParticipant(
        participantsByRole,
        "attacker",
      );

      const defender = requireSingleParticipant(
        participantsByRole,
        "defender",
      );

      const outcome = resolveLuckAdjustedStatCheck(
        attacker,
        "brawn",
        getConflictDifficulty(defender),
        random,
        getBrainsDifficultyReduction(attacker),
      );

      switch (outcome) {
        case "critical-failure": {
          const itemId = selectRandomItem(
            itemIds,
            random,
          );

          const text =
            `${attacker.snapshot.name} attacks ` +
            `${defender.snapshot.name} over ` +
            `${resourceDescription}, but ` +
            `${defender.snapshot.name} turns the attack ` +
            "against them and kills them.";

          return {
            text,

            changes: [
              ...createFatalChanges(
                attacker,
                id,
                "Killed at the Cornucopia",
                text,
                defender,
              ),

              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                defender,
                [itemId],
                round,
                "cornucopia",
              ),
            ],
          };
        }

        case "failure":
          return {
            text:
              `${attacker.snapshot.name} and ` +
              `${defender.snapshot.name} clash over ` +
              `${resourceDescription}, but both are forced ` +
              "to retreat without claiming it.",

            changes: [
              createStatusChange(
                eventId,
                attacker,
                "injured",
                1,
                round,
              ),

              ...createSurvivalChanges([
                attacker,
                defender,
              ]),
            ],
          };

        case "success": {
          const itemId = selectRandomItem(
            itemIds,
            random,
          );

          return {
            text:
              `${attacker.snapshot.name} drives ` +
              `${defender.snapshot.name} away from ` +
              `${resourceDescription} and escapes with it.`,

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                attacker,
                [itemId],
                round,
                "cornucopia",
              ),

              createStatusChange(
                eventId,
                defender,
                "exhausted",
                1,
                round,
              ),

              ...createSurvivalChanges([defender]),
            ],
          };
        }

        case "exceptional-success": {
          const itemId = selectRandomItem(
            itemIds,
            random,
          );

          const text =
            `${attacker.snapshot.name} kills ` +
            `${defender.snapshot.name} in a fight over ` +
            `${resourceDescription} and claims it for themself.`;

          return {
            text,

            changes: [
              ...createFatalChanges(
                defender,
                id,
                "Killed at the Cornucopia",
                text,
                attacker,
              ),

              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                attacker,
                [itemId],
                round,
                "cornucopia",
              ),
            ],
          };
        }
      }
    },
  };
}

export const CORNUCOPIA_CONFLICT_EVENTS = [
  createCornucopiaConflictEvent({
    id: "cornucopia-contested-weapon",
    baseWeight: 6,
    itemIds: CONTESTED_WEAPON_ITEM_IDS,
    resourceDescription: "the same weapon",
  }),

  createCornucopiaConflictEvent({
    id: "cornucopia-pack-ambush",
    baseWeight: 5,
    itemIds: CONTESTED_PACK_ITEM_IDS,
    resourceDescription: "an unopened supply pack",
  }),
] satisfies readonly EventDefinition[];