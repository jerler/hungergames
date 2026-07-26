import { createHuntedFoodEvent } from "~/game/events/authoring";

import type { EventDefinition } from "~/game/events/event-schema";

export const HUNTING_EVENTS = [
  createHuntedFoodEvent("trap-kit-rabbit-hunt", {
    foodResourceId: "rabbit",

    difficulty: 3,

    requiredEquipmentId: "trap-kit",

    tags: ["tool", "environment"],

    weight: 4.5,

    text: {
      criticalFailure: ({ tribute }) =>
        `${tribute.name} sets a trap for a rabbit, accidentally triggers it while making an adjustment, and is badly injured.`,

      failure: ({ tribute }) =>
        `${tribute.name} spends hours checking an elaborate trap, but catches nothing and returns exhausted.`,

      success: ({ tribute }) =>
        `${tribute.name} constructs a careful trap, catches a rabbit, and eats a satisfying meal.`,

      exceptionalSuccess: ({ tribute }) =>
        `${tribute.name} catches a remarkably plump rabbit and eats exceptionally well.`,
    },
  }),

  createHuntedFoodEvent("slingshot-chicken-hunt", {
    foodResourceId: "chicken",

    difficulty: 3,

    requiredEquipmentId: "slingshot",

    tags: ["weapon", "environment"],

    weight: 3.5,

    text: {
      criticalFailure: ({ tribute }) =>
        `${tribute.name} attempts to hunt an arena chicken with a slingshot, misses spectacularly, and is injured during the resulting pursuit.`,

      failure: ({ tribute }) =>
        `${tribute.name} chases an arena chicken through the undergrowth until both parties are exhausted and deeply annoyed.`,

      success: ({ tribute }) =>
        `${tribute.name} brings down an arena chicken with a careful slingshot shot and eats it.`,

      exceptionalSuccess: ({ tribute }) =>
        `${tribute.name} makes a perfect slingshot shot, secures an arena chicken, then eats an unusually satisfying meal.`,
    },
  }),

  createHuntedFoodEvent("fishing-gear-catch", {
    foodResourceId: "fish",

    difficulty: 3,

    requiredEquipmentId: "fishing-gear",

    tags: ["tool", "environment"],

    weight: 4.5,

    text: {
      criticalFailure: ({ tribute }) =>
        `${tribute.name} hooks an enormous fish, is dragged violently through the water, and escapes badly injured.`,

      failure: ({ tribute }) =>
        `${tribute.name} spends hours battling a fish that escapes at the last possible moment, leaving ${tribute.pronouns.object} exhausted.`,

      success: ({ tribute }) => `${tribute.name} uses fishing gear to catch and eat a fish.`,

      exceptionalSuccess: ({ tribute }) =>
        `${tribute.name} lands an enormous fish and eats exceptionally well.`,
    },
  }),

  createHuntedFoodEvent("bird-whistle-nest-search", {
    foodResourceId: "eggs",

    difficulty: 2,

    requiredEquipmentId: "bird-whistle",

    tags: ["tool", "environment"],

    weight: 2.5,

    text: {
      criticalFailure: ({ tribute }) =>
        `${tribute.name} imitates an arena bird so convincingly that an enraged parent attacks and badly injures ${tribute.pronouns.object}.`,

      failure: ({ tribute }) =>
        `${tribute.name} spends hours answering increasingly suspicious birds with a whistle and returns exhausted without finding a nest.`,

      success: ({ tribute }) =>
        `${tribute.name} uses a bird whistle to locate a hidden nest and eats several eggs.`,

      exceptionalSuccess: ({ tribute }) =>
        `${tribute.name} perfectly imitates the local birds, discovers a large concealed nest and eats exceptionally well.`,
    },
  }),

  createHuntedFoodEvent("raids-nest-for-eggs", {
    foodResourceId: "eggs",

    difficulty: 3,

    tags: ["environment"],

    weight: 4,

    text: {
      criticalFailure: ({ tribute }) =>
        `${tribute.name} attempts to reach a nest, falls from the tree, and is badly injured.`,

      failure: ({ tribute }) =>
        `${tribute.name} spends hours climbing toward a nest only to discover it empty, returning exhausted.`,

      success: ({ tribute }) =>
        `${tribute.name} carefully raids an unattended nest and eats several eggs.`,

      exceptionalSuccess: ({ tribute }) =>
        `${tribute.name} discovers a large hidden nest and eats well.`,
    },
  }),
] satisfies readonly EventDefinition[];
