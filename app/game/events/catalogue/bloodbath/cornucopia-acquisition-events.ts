import { getEffectiveStats } from "~/game/engine/effective-stats";
import type { GameTribute } from "~/game/types/game-state";
import {
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
} from "~/game/events/event-change-builders";
import { getItemLabel, resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";
import {
  selectCornucopiaBrainsOffenseItem,
  selectCornucopiaEdgeDirectWeapon,
  selectCornucopiaHeavyDirectWeapon,
  selectCornucopiaPackItem,
  selectDistinctCornucopiaBrainsOffenseItems,
  selectDistinctCornucopiaPackItems,
} from "./cornucopia-item-pool";

function getEdgeWeaponAcquisitionWeight(tribute: GameTribute): number {
  const { brawn, luck } = getEffectiveStats(tribute);

  return Math.max(0.25, brawn * 1.5 + luck * 0.25);
}

function getHeavyWeaponAcquisitionWeight(tribute: GameTribute): number {
  const { brawn, luck } = getEffectiveStats(tribute);

  return Math.max(0.25, brawn * brawn + luck * 0.25);
}

function getBrainsOffenseAcquisitionWeight(tribute: GameTribute): number {
  const { brains, brawn, luck } = getEffectiveStats(tribute);

  const lowBrawnPreference = Math.max(0, 3 - brawn) * 1.5;

  return Math.max(0.25, brains * brains + luck * 0.5 + lowBrawnPreference);
}

export const CORNUCOPIA_ACQUISITION_EVENTS = [
  {
    id: "cornucopia-nearby-pack",
    category: "hazard",
    tags: ["hazard", "item", "resource"],
    periods: ["day"],
    baseWeight: 6,

    roles: [
      {
        id: "tribute",
        count: 1,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brawn", 3, random);

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} reaches for a pack, ` +
              "but is knocked violently against the Cornucopia " +
              "and escapes badly injured.",

            changes: [createStatusChange(eventId, tribute, "injured", 2, round)],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} struggles through the ` +
              "crowd toward a supply pack, but is forced to " +
              "retreat empty-handed and exhausted.",

            changes: [createStatusChange(eventId, tribute, "exhausted", 1, round)],
          };

        case "success": {
          const itemId = selectCornucopiaPackItem(random);

          return {
            text:
              `${tribute.snapshot.name} grabs a nearby pack ` +
              `containing ${getItemLabel(itemId)} and escapes.`,

            changes: createItemAcquisitionAndSurvivalChanges(
              eventId,
              tribute,
              [itemId],
              round,
              "cornucopia",
            ),
          };
        }

        case "exceptional-success": {
          const itemIds = selectDistinctCornucopiaPackItems(2, random);

          const itemLabels = itemIds.map(getItemLabel);

          return {
            text:
              `${tribute.snapshot.name} reaches a supply pile ` +
              `before the nearby tributes and escapes with ` +
              `${itemLabels.join(" and ")}.`,

            changes: createItemAcquisitionAndSurvivalChanges(
              eventId,
              tribute,
              itemIds,
              round,
              "cornucopia",
            ),
          };
        }
      }
    },
  },

  {
    id: "cornucopia-edge-weapon",
    category: "hazard",
    tags: ["hazard", "combat", "weapon", "item"],
    periods: ["day"],
    baseWeight: 5,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getEdgeWeaponAcquisitionWeight,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");
      const pronouns = getTributePronouns(tribute);
      const outcome = resolveLuckAdjustedStatCheck(tribute, "brawn", 3, random);

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} lunges for a weapon ` +
              "near the Cornucopia's edge, but is trampled " +
              "and forced to crawl away.",

            changes: [createStatusChange(eventId, tribute, "injured", 2, round)],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} reaches the edge of ` +
              "the weapon pile, but abandons the attempt as " +
              `the fighting closes around ${pronouns.object}.`,

            changes: [createStatusChange(eventId, tribute, "exhausted", 1, round)],
          };

        case "success": {
          const itemId = selectCornucopiaEdgeDirectWeapon(random);

          return {
            text:
              `${tribute.snapshot.name} snatches ` +
              `${getItemLabel(itemId)} from the edge of the ` +
              "Cornucopia and escapes.",

            changes: createItemAcquisitionAndSurvivalChanges(
              eventId,
              tribute,
              [itemId],
              round,
              "cornucopia",
            ),
          };
        }

        case "exceptional-success": {
          const itemId = selectCornucopiaEdgeDirectWeapon(random);

          return {
            text:
              `${tribute.snapshot.name} darts through the ` +
              `chaos, claims ${getItemLabel(itemId)}, and ` +
              `escapes before anyone can challenge ${pronouns.object}.`,

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                [itemId],
                round,
                "cornucopia",
              ),

              createStatusChange(eventId, tribute, "inspired", 1, round),
            ],
          };
        }
      }
    },
  },
  {
    id: "cornucopia-heavy-weapon",
    category: "hazard",
    tags: ["hazard", "combat", "weapon", "item"],
    periods: ["day"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getHeavyWeaponAcquisitionWeight,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const pronouns = getTributePronouns(tribute);

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brawn", 4, random);

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} reaches the central ` +
              "weapon pile, but is struck down in the chaos " +
              `and barely escapes with ${pronouns.possessiveAdjective} life.`,

            changes: [createStatusChange(eventId, tribute, "injured", 2, round)],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} reaches for one of ` +
              "the heaviest weapons, but cannot pull it free " +
              "before the fighting forces a retreat.",

            changes: [createStatusChange(eventId, tribute, "exhausted", 1, round)],
          };

        case "success": {
          const itemId = selectCornucopiaHeavyDirectWeapon(random);

          return {
            text:
              `${tribute.snapshot.name} tears ` +
              `${getItemLabel(itemId)} from the central ` +
              "weapon pile and escapes.",

            changes: createItemAcquisitionAndSurvivalChanges(
              eventId,
              tribute,
              [itemId],
              round,
              "cornucopia",
            ),
          };
        }

        case "exceptional-success": {
          const itemId = selectCornucopiaHeavyDirectWeapon(random);

          return {
            text:
              `${tribute.snapshot.name} dominates the central ` +
              `weapon pile, claims ${getItemLabel(itemId)}, ` +
              "and leaves the surrounding tributes scrambling.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                [itemId],
                round,
                "cornucopia",
              ),

              createStatusChange(eventId, tribute, "inspired", 1, round),
            ],
          };
        }
      }
    },
  },
  {
    id: "cornucopia-tactical-cache",
    category: "hazard",
    tags: ["hazard", "combat", "weapon", "item", "resource"],
    periods: ["day"],
    baseWeight: 5,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getBrainsOffenseAcquisitionWeight,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const pronouns = getTributePronouns(tribute);

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, random);

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} stops to inspect a ` +
              "technical equipment cache, but loses track of " +
              `the surrounding fight and escapes disoriented.`,

            changes: [createStatusChange(eventId, tribute, "disoriented", 2, round)],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} finds a cache of ` +
              "technical weapons, but cannot determine what " +
              `is safe to take before the crowd closes around ${pronouns.object}.`,

            changes: [createStatusChange(eventId, tribute, "exhausted", 1, round)],
          };

        case "success": {
          const itemId = selectCornucopiaBrainsOffenseItem(random);

          return {
            text:
              `${tribute.snapshot.name} quickly identifies ` +
              `${getItemLabel(itemId)} in a tactical cache ` +
              "and escapes with it.",

            changes: createItemAcquisitionAndSurvivalChanges(
              eventId,
              tribute,
              [itemId],
              round,
              "cornucopia",
            ),
          };
        }

        case "exceptional-success": {
          const itemIds = selectDistinctCornucopiaBrainsOffenseItems(2, random);

          const itemLabels = itemIds.map(getItemLabel);

          return {
            text:
              `${tribute.snapshot.name} understands the ` +
              "tactical cache at a glance and escapes with " +
              `${itemLabels.join(" and ")}.`,

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                itemIds,
                round,
                "cornucopia",
              ),

              createStatusChange(eventId, tribute, "inspired", 1, round),
            ],
          };
        }
      }
    },
  },
] satisfies readonly EventDefinition[];
