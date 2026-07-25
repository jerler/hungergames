import { getForagingScore, getSurvivalSelectionWeight } from "~/game/engine/stat-formulas";

import {
  acquireNaturalResource,
  applyStatus,
  brains,
  createEvent,
  createNaturalResourceEvent,
  customResolution,
  hasItem,
  randomResult,
  recordNightRest,
  consumeRequiredItem,
  result,
  statCheck,
  survived,
} from "~/game/events/authoring";

import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";
import { resolveNaturalShelterCheck } from "~/game/survival/natural-shelter";

const NATURAL_SHELTER_RESULTS = {
  "critical-failure": result({
    text: ({ tribute }) =>
      `${tribute.name} searches desperately for shelter, but night falls before a safe place appears.`,
    effects: [recordNightRest("tribute", "unsheltered"), survived("tribute")],
  }),

  failure: result({
    text: ({ tribute }) =>
      `${tribute.name} tries to settle beneath a thin patch of cover, but the shelter collapses and leaves ${tribute.pronouns.object} exposed to the night.`,
    effects: [recordNightRest("tribute", "unsheltered"), survived("tribute")],
  }),

  success: result({
    text: ({ tribute }) =>
      `${tribute.name} finds a protected hollow and settles in beneath sturdy natural shelter.`,
    effects: [recordNightRest("tribute", "sheltered"), survived("tribute")],
  }),

  "exceptional-success": result({
    text: ({ tribute }) =>
      `${tribute.name} discovers a concealed hollow that offers both shelter and cover from the other tributes.`,
    effects: [
      recordNightRest("tribute", "sheltered"),
      applyStatus("tribute", "hidden", 1),
      survived("tribute"),
    ],
  }),
} as const;

export const SURVIVAL_EVENTS = [
  /* Day Only */
  createNaturalResourceEvent("forages-for-resources", {
    resources: ["wild-fruit", "water"],
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
              acquireNaturalResource("tribute", "wild-fruit"),
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

  /* Night Only */
  createEvent("finds-hiding-place")
    .solo("tribute", {
      getWeight: getSurvivalSelectionWeight,
    })
    .category("survival")
    .tags("survival", "status")
    .during("night")
    .weight(8)
    .resolve(
      customResolution(
        (context, { resolveResult }) => {
          const tribute = requireSingleParticipant(context.participantsByRole, "tribute");

          const outcome = resolveNaturalShelterCheck(tribute, context.random);

          return resolveResult(NATURAL_SHELTER_RESULTS[outcome]);
        },

        {
          possibleResults: Object.values(NATURAL_SHELTER_RESULTS),
        },
      ),
    ),
] satisfies readonly EventDefinition[];
