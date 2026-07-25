import { createHuntedFoodEvent } from "~/game/events/authoring";

import type { EventDefinition } from "~/game/events/event-schema";

export const HUNTING_EVENTS = [
  createHuntedFoodEvent("trap-kit-rabbit-hunt", {
    foodId: "rabbit",

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
        `${tribute.name} constructs a careful trap and catches a rabbit for a future meal.`,

      exceptionalSuccess: ({ tribute }) =>
        `${tribute.name} catches a remarkably plump rabbit, eats well, and preserves enough for another meal.`,
    },
  }),

  createHuntedFoodEvent("slingshot-chicken-hunt", {
    foodId: "chicken",

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
        `${tribute.name} brings down an arena chicken with a careful slingshot shot and prepares it as food.`,

      exceptionalSuccess: ({ tribute }) =>
        `${tribute.name} makes a perfect slingshot shot, secures an arena chicken, and eats an unusually satisfying meal.`,
    },
  }),

  createHuntedFoodEvent("fishing-gear-catch", {
    foodId: "fish",

    difficulty: 3,

    requiredEquipmentId: "fishing-gear",

    tags: ["tool", "environment"],

    weight: 4.5,

    text: {
      criticalFailure: ({ tribute }) =>
        `${tribute.name} hooks an enormous fish, is dragged violently through the water, and escapes badly injured.`,

      failure: ({ tribute }) =>
        `${tribute.name} spends hours battling a fish that escapes at the last possible moment, leaving ${tribute.pronouns.object} exhausted.`,

      success: ({ tribute }) =>
        `${tribute.name} uses fishing gear to catch and prepare a fish for a future meal.`,

      exceptionalSuccess: ({ tribute }) =>
        `${tribute.name} lands an enormous fish, eats exceptionally well, and saves enough for another meal.`,
    },
  }),

  createHuntedFoodEvent("bird-whistle-nest-search", {
    foodId: "eggs",

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
        `${tribute.name} uses a bird whistle to locate a hidden nest and gathers several eggs.`,

      exceptionalSuccess: ({ tribute }) =>
        `${tribute.name} perfectly imitates the local birds, discovers a large concealed nest, and eats exceptionally well.`,
    },
  }),

  createHuntedFoodEvent("raids-nest-for-eggs", {
    foodId: "eggs",

    difficulty: 3,

    tags: ["environment"],

    weight: 4,

    text: {
      criticalFailure: ({ tribute }) =>
        `${tribute.name} attempts to reach a nest, falls from the tree, and is badly injured.`,

      failure: ({ tribute }) =>
        `${tribute.name} spends hours climbing toward a nest only to discover it empty, returning exhausted.`,

      success: ({ tribute }) =>
        `${tribute.name} carefully raids an unattended nest and gathers several eggs for a meal.`,

      exceptionalSuccess: ({ tribute }) =>
        `${tribute.name} discovers a large hidden nest, eats well, and preserves several eggs for later.`,
    },
  }),
] satisfies readonly EventDefinition[];
