import {
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { isStatAtMost, resolveStatCheck } from "~/game/events/event-outcomes";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";

export const LOW_LUCK_EVENTS = [
  /* Day Only */

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
            `${tribute.snapshot.name} tries to tip ` +
            "over a vending machine. The vending " +
            "machine wins.";

          return {
            text,

            changes: [createStatusChange(eventId, tribute, "injured", 2, round)],
          };
        }

        case "failure": {
          const text =
            `${tribute.snapshot.name} feeds a pebble ` +
            "into a vending machine. It accepts the " +
            "payment and dispenses one warm olive.";

          return {
            text,

            changes: createSurvivalChanges([tribute]),
          };
        }

        case "success": {
          const text =
            `${tribute.snapshot.name} bumps a vending ` +
            "machine once. It dispenses a bottle of " +
            "water and a receipt for $0.00.";

          return {
            text,

            changes: createItemAcquisitionAndSurvivalChanges(eventId, tribute, ["water"], round),
          };
        }

        case "exceptional-success": {
          const text =
            `${tribute.snapshot.name} leans against ` +
            "a vending machine. Its entire front falls " +
            "off, revealing medicine and matches.";

          return {
            text,

            changes: createItemAcquisitionAndSurvivalChanges(
              eventId,
              tribute,
              ["medicine", "matches"],
              round,
            ),
          };
        }
      }
    },
  },

  /* Night Only */

  /* Day and Night */
] satisfies readonly EventDefinition[];
