import { createStatusChange, createSurvivalChanges } from "~/game/events/event-change-builders";
import { isStatAtLeast, resolveStatCheck } from "~/game/events/event-outcomes";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";

export const HIGH_LUCK_EVENTS = [
  /* Day Only */

  /* Night Only */

  /* Day and Night */
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
