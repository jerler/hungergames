import {
  applyStatus,
  createSoloStatEvent,
  luck,
  minimumStat,
  result,
  survived,
} from "~/game/events/authoring";
import type { EventDefinition } from "~/game/events/event-schema";

export const HIGH_LUCK_EVENTS = [
  /* Day Only */

  /* Night Only */

  /* Day and Night */

  createSoloStatEvent("unexpected-pep-talk", {
    check: luck(3),
    requirements: [minimumStat("tribute", "luck", 4)],

    category: "survival",
    tags: ["status"],
    periods: ["day", "night"],
    weight: 3.5,

    roleOptions: {
      getWeight: (tribute) => tribute.snapshot.stats.luck,
    },

    outcomes: {
      criticalFailure: result({
        text: ({ tribute }) =>
          `${tribute.name} receives an arena message advising ${tribute.pronouns.object} to "believe in the feet they can become." ${tribute.pronouns.Subject} ${tribute.pronouns.bePresent} left deeply confused.`,
        effects: [applyStatus("tribute", "disoriented", 1)],
      }),

      failure: result({
        text: ({ tribute }) =>
          `${tribute.name} receives an aggressively generic pep talk that provides no useful information whatsoever.`,
        effects: [survived("tribute")],
      }),

      success: result({
        text: ({ tribute }) =>
          `${tribute.name} hears a well-timed message of encouragement and feels newly determined.`,
        effects: [applyStatus("tribute", "inspired", 1)],
      }),

      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} receives exactly the encouragement ${tribute.pronouns.subject} needed and feels unstoppable.`,
        effects: [applyStatus("tribute", "inspired", 2)],
      }),
    },
  }),
] satisfies readonly EventDefinition[];
