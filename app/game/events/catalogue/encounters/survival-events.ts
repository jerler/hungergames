import { getForagingScore, getSurvivalSelectionWeight } from "~/game/engine/stat-formulas";

import {
  acquireNaturalResource,
  always,
  applyStatus,
  brains,
  createEvent,
  createNaturalResourceEvent,
  hasItem,
  randomResult,
  consumeRequiredItem,
  result,
  statCheck,
  survived,
} from "~/game/events/authoring";

import type { EventDefinition } from "~/game/events/event-schema";

export const SURVIVAL_EVENTS = [
  /* Day Only */
  createNaturalResourceEvent("forages-for-resources", {
    resources: ["wild-fruit-and-berries", "water"],
    text: ({ tribute }, itemId) =>
      itemId === "water"
        ? `${tribute.name} follows animal tracks to a clean spring and collects water.`
        : `${tribute.name} identifies edible plants and gathers enough for a meal.`,
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
              `${tribute.name} correctly reads ${tribute.pronouns.possessiveAdjective} map and follows it to a patch of edible plants.`,
            effects: [
              acquireNaturalResource("tribute", "wild-fruit-and-berries"),
              survived("tribute"),
              consumeRequiredItem("tribute", { reason: "upside-down-map" }),
            ],
          }),
          result({
            text: ({ tribute }) =>
              `${tribute.name} correctly reads ${tribute.pronouns.possessiveAdjective} map and follows it to a clean spring.`,
            effects: [
              acquireNaturalResource("tribute", "water"),
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

  /* Day and Night */
  createEvent("finds-hiding-place")
    .solo("tribute", {
      getWeight: getSurvivalSelectionWeight,
    })
    .category("survival")
    .tags("survival", "status")
    .during("day", "night")
    .weight(8)
    .resolve(
      always(
        result({
          text: ({ tribute }) =>
            `${tribute.name} slips into dense undergrowth and remains hidden from the other tributes.`,

          effects: [applyStatus("tribute", "hidden", 1), survived("tribute")],
        }),
      ),
    ),
] satisfies readonly EventDefinition[];
