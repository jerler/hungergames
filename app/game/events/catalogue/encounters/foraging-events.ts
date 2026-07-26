import { createForageIdentificationEvent } from "~/game/events/authoring";

import type { EventDefinition } from "~/game/events/event-schema";

export const FORAGING_EVENTS = [
  createForageIdentificationEvent("identifies-wild-berries", {
    forageLabel: "berries",

    items: {
      hallucinogenic: "hallucinogenic-berries",

      poisonous: "poison-berries",
    },

    weight: 5,
  }),

  createForageIdentificationEvent("identifies-wild-mushrooms", {
    forageLabel: "mushrooms",

    items: {
      hallucinogenic: "hallucinogenic-mushrooms",

      poisonous: "poison-mushrooms",
    },

    weight: 4,
  }),
] satisfies readonly EventDefinition[];
