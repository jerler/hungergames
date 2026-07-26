import { getVulnerabilityWeight } from "~/game/engine/stat-formulas";
import { createDeprivationStatusEvent } from "~/game/events/authoring";
import type { EventDefinition } from "~/game/events/event-schema";

export const DEPRIVATION_EVENTS = [
  createDeprivationStatusEvent("becomes-hungry", {
    need: "food",
    weight: 10,
    roleOptions: {
      getWeight: getVulnerabilityWeight,
    },
    texts: [
      ({ tribute }) =>
        `${tribute.name} has gone days without a proper meal and can no longer ignore ${tribute.pronouns.possessiveAdjective} grumbling stomach.`,
      ({ tribute }) =>
        `Days without enough food have left ${tribute.name} weak, distracted, and painfully hungry.`,
      ({ tribute }) =>
        `${tribute.name} has survived on determination alone, but hunger is finally beginning to take its toll.`,
      ({ tribute }) =>
        `After days without eating properly, ${tribute.name} finds every movement more difficult.`,
      ({ tribute }) => `${tribute.name}'s empty stomach has become impossible to ignore.`,
      ({ tribute }) =>
        `${tribute.name} searches for something to eat, but there are no Cornucopia provisions within reach.`,
    ],
  }),

  createDeprivationStatusEvent("becomes-thirsty", {
    need: "water",
    weight: 12,
    roleOptions: {
      getWeight: getVulnerabilityWeight,
    },
    texts: [
      ({ tribute }) =>
        `${tribute.name} has gone days without enough water and is becoming dangerously thirsty.`,
      ({ tribute }) =>
        `A dry mouth, pounding head, and growing dizziness tell ${tribute.name} that the lack of water is catching up with ${tribute.pronouns.object}.`,
      ({ tribute }) => `Days without a proper drink have left ${tribute.name} weak and unsteady.`,
      ({ tribute }) =>
        `${tribute.name} can no longer ignore the effects of going so long without water.`,
      ({ tribute }) =>
        `The search for water has failed again, and ${tribute.name} is beginning to suffer.`,
      ({ tribute }) => `${tribute.name} checks every container nearby, but not a drop remains.`,
    ],
  }),
] satisfies readonly EventDefinition[];
