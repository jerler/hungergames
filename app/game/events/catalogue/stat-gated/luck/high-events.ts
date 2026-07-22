import { selectRandomItem } from "~/game/engine/random";
import {
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { getItemLabel } from "~/game/events/event-resolution-helpers";
import { isStatAtLeast, resolveStatCheck } from "~/game/events/event-outcomes";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import type { ItemDefinitionId } from "~/game/items/item-schema";

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

export const HIGH_LUCK_EVENTS = [
  /* Day Only */

  /* Night Only */

  /* Day and Night */

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
            `${tribute.snapshot.name} waves at a ` +
            "sponsor drone. It mistakes them for " +
            "a landing pad.";

          return {
            text,

            changes: [createStatusChange(eventId, tribute, "injured", 1, round)],
          };
        }

        case "failure": {
          const text =
            `A sponsor drone circles ` +
            `${tribute.snapshot.name}, broadcasts ` +
            "hold music for ten minutes, and flies away.";

          return {
            text,

            changes: createSurvivalChanges([tribute]),
          };
        }

        case "success": {
          const itemId = selectRandomItem(SUPPLY_ITEM_IDS, random);

          const text =
            `A sponsor drone drops ` +
            `${getItemLabel(itemId)} at ` +
            `${tribute.snapshot.name}'s feet.`;

          return {
            text,

            changes: createItemAcquisitionAndSurvivalChanges(
              eventId,
              tribute,
              [itemId],
              round,
              "sponsor",
              1,
            ),
          };
        }

        case "exceptional-success": {
          const text =
            `A sponsor drone's cargo hatch bursts ` +
            `open above ${tribute.snapshot.name}, ` +
            "dropping medicine and a bow.";

          return {
            text,

            changes: createItemAcquisitionAndSurvivalChanges(
              eventId,
              tribute,
              ["medicine", "bow"],
              round,
              "sponsor",
              2,
            ),
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
              `${tribute.snapshot.name} receives an ` +
              "arena message advising them to " +
              '"believe in the feet they can become." ' +
              "They are left deeply confused.",

            changes: [createStatusChange(eventId, tribute, "disoriented", 1, round)],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} receives an ` +
              "aggressively generic pep talk that " +
              "provides no useful information whatsoever.",

            changes: createSurvivalChanges([tribute]),
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} hears a ` +
              "well-timed message of encouragement " +
              "and feels newly determined.",

            changes: [createStatusChange(eventId, tribute, "inspired", 1, round)],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} receives ` +
              "exactly the encouragement they needed " +
              "and feels unstoppable.",

            changes: [createStatusChange(eventId, tribute, "inspired", 2, round)],
          };
      }
    },
  },
] satisfies readonly EventDefinition[];
