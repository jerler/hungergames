import { getForagingScore, getSurvivalSelectionWeight } from "~/game/engine/stat-formulas";

import {
  applyStatus,
  brains,
  consumeRequiredItem,
  createEvent,
  createNaturalResourceEvent,
  createNightRestEvent,
  eliminate,
  hasItem,
  randomResult,
  result,
  statCheck,
  satisfySurvivalNeed,
  survived,
} from "~/game/events/authoring";

import type { EventDefinition } from "~/game/events/event-schema";

export const SURVIVAL_EVENTS = [
  /* Day Only */
  createNaturalResourceEvent("forages-for-resources", {
    resources: ["food", "water"],
    text: ({ tribute }, need) =>
      need === "water"
        ? `${tribute.name} follows animal tracks to a clean spring and drinks deeply.`
        : `${tribute.name} identifies edible plants and eats a satisfying meal.`,
  }),
  createEvent("upside-down-map")
    .solo("tribute", { getWeight: getForagingScore })
    .when(hasItem("tribute", { definitionIds: ["map"] }))
    .category("survival")
    .tags("survival", "item", "tool", "status", "resource")
    .during("day")
    .weight(4)
    .resolve(
      statCheck("tribute", brains(3), {
        criticalFailure: result({
          text: ({ tribute }) =>
            `${tribute.name} follows ${tribute.pronouns.possessiveAdjective} map for hours before realizing ${tribute.pronouns.subject} ${tribute.pronouns.havePresent} been holding it upside down.`,
          effects: [
            applyStatus("tribute", "disoriented", 2),
            consumeRequiredItem("tribute", { reason: "upside-down-map" }),
          ],
        }),
        failure: result({
          text: ({ tribute }) =>
            `${tribute.name} misreads ${tribute.pronouns.possessiveAdjective} map and becomes hopelessly turned around.`,
          effects: [
            applyStatus("tribute", "disoriented", 1),
            consumeRequiredItem("tribute", { reason: "upside-down-map" }),
          ],
        }),
        success: randomResult(
          result({
            text: ({ tribute }) =>
              `${tribute.name} correctly reads ${tribute.pronouns.possessiveAdjective} map and follows it to edible plants and eats a meal.`,
            effects: [
              satisfySurvivalNeed("tribute", "food"),
              survived("tribute"),
              consumeRequiredItem("tribute", { reason: "upside-down-map" }),
            ],
          }),
          result({
            text: ({ tribute }) =>
              `${tribute.name} correctly reads ${tribute.pronouns.possessiveAdjective} map and follows it to a clean spring and drinks.`,
            effects: [
              satisfySurvivalNeed("tribute", "water"),
              survived("tribute"),
              consumeRequiredItem("tribute", { reason: "upside-down-map" }),
            ],
          }),
        ),
        exceptionalSuccess: result({
          text: ({ tribute }) =>
            `${tribute.name} studies ${tribute.pronouns.possessiveAdjective} map and discovers a concealed route through the arena, disappearing from view.`,
          effects: [
            applyStatus("tribute", "hidden", 2),
            survived("tribute"),
            consumeRequiredItem("tribute", { reason: "upside-down-map" }),
          ],
        }),
      }),
    ),

  /* Night Only */
  createNightRestEvent("finds-hiding-place", {
    roleOptions: {
      getWeight: getSurvivalSelectionWeight,
    },
    weight: 8,
    results: {
      criticalFailure: {
        text: ({ tribute }) =>
          `${tribute.name} searches desperately for shelter, but night falls before a safe place appears.`,
      },
      failure: {
        text: ({ tribute }) =>
          `${tribute.name} tries to settle beneath a thin patch of cover, but the shelter collapses and leaves ${tribute.pronouns.object} exposed to the night.`,
      },
      success: {
        text: ({ tribute }) =>
          `${tribute.name} finds a protected hollow and settles in beneath sturdy natural shelter.`,
      },
      exceptionalSuccess: {
        text: ({ tribute }) =>
          `${tribute.name} discovers a concealed hollow that offers both shelter and cover from the other tributes.`,
        effects: [applyStatus("tribute", "hidden", 1)],
      },
    },
  }),

  createNightRestEvent("uses-shelter-supplies", {
    method: {
      type: "item-assisted",
    },
    roleOptions: {
      getWeight: getSurvivalSelectionWeight,
    },
    weight: 6,
    results: {
      criticalFailure: {
        text: ({ tribute }) =>
          `${tribute.name} struggles with ${tribute.pronouns.possessiveAdjective} shelter supplies until the camp fails around ${tribute.pronouns.object}.`,
        effects: [applyStatus("tribute", "injured", 1)],
      },
      failure: {
        text: ({ tribute }) =>
          `${tribute.name} cannot make ${tribute.pronouns.possessiveAdjective} shelter supplies hold through the night.`,
      },
      success: {
        text: ({ tribute }) =>
          `${tribute.name} uses ${tribute.pronouns.possessiveAdjective} supplies to build a protected camp for the night.`,
      },
      exceptionalSuccess: {
        text: ({ tribute }) =>
          `${tribute.name} arranges ${tribute.pronouns.possessiveAdjective} shelter supplies into a warm camp hidden from view.`,
        effects: [applyStatus("tribute", "hidden", 1)],
      },
    },
  }),

  createNightRestEvent("finds-dry-rock-overhang", {
    method: {
      type: "guaranteed",
      quality: "sheltered",
    },
    roleOptions: {
      getWeight: getSurvivalSelectionWeight,
    },
    weight: 3,
    results: {
      criticalFailure: {
        text: ({ tribute }) => `${tribute.name} fails to settle beneath the rock overhang.`,
      },
      failure: {
        text: ({ tribute }) => `${tribute.name} cannot settle beneath the rock overhang.`,
      },
      success: {
        text: ({ tribute }) =>
          `${tribute.name} discovers a deep, dry rock overhang and settles into its shelter for the night.`,
      },
      exceptionalSuccess: {
        text: ({ tribute }) =>
          `${tribute.name} discovers a deep, dry rock overhang concealed from the rest of the arena.`,
      },
    },
  }),

  createNightRestEvent("cannot-find-shelter", {
    method: {
      type: "failed",
    },
    roleOptions: {
      getWeight: getSurvivalSelectionWeight,
    },
    weight: 2,
    results: {
      criticalFailure: {
        text: ({ tribute }) => `${tribute.name} searches until dawn without finding shelter.`,
      },
      failure: {
        text: ({ tribute }) =>
          `${tribute.name} searches for shelter but spends the night exposed to the arena.`,
      },
      success: {
        text: ({ tribute }) => `${tribute.name} briefly mistakes a patch of brush for shelter.`,
      },
      exceptionalSuccess: {
        text: ({ tribute }) => `${tribute.name} briefly mistakes a patch of brush for shelter.`,
      },
    },
  }),

  createNightRestEvent("cave-shelter-collapse", {
    roleOptions: {
      getWeight: getSurvivalSelectionWeight,
    },
    weight: 1,
    results: {
      criticalFailure: {
        text: ({ tribute }) =>
          `${tribute.name} crawls into a cave for shelter, but the ceiling collapses and buries ${tribute.pronouns.object}.`,
        effects: [
          eliminate("tribute", {
            causeId: "shelter-collapse",
            causeLabel: "Shelter collapse",
          }),
        ],
      },
      failure: {
        text: ({ tribute }) =>
          `${tribute.name} takes shelter in an unstable cave and escapes when the ceiling begins to fall, but not without injury.`,
        effects: [applyStatus("tribute", "injured", 2)],
      },
      success: {
        text: ({ tribute }) =>
          `${tribute.name} checks a shallow cave for loose stone before settling safely into its shelter.`,
      },
      exceptionalSuccess: {
        text: ({ tribute }) =>
          `${tribute.name} finds a stable cave whose narrow entrance provides both shelter and concealment.`,
        effects: [applyStatus("tribute", "hidden", 1)],
      },
    },
  }),
] satisfies readonly EventDefinition[];
