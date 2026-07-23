import {
  getDefinitionPopulationMultiplier,
  getForagingScore,
  getSurvivalSelectionWeight,
} from "~/game/engine/stat-formulas";
import {
  acquireNaturalResource,
  always,
  applyStatus,
  brains,
  createEvent,
  createNaturalResourceEvent,
  customResolution,
  hasItem,
  randomResult,
  recordRequiredItemUse,
  result,
  statCheck,
  survived,
} from "~/game/events/authoring";
import { resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
import type { StatCheckOutcome } from "~/game/events/event-outcomes";
import { requireParticipants, type EventDefinition } from "~/game/events/event-schema";
import { getCooperativeTruceWeight } from "~/game/truces/truce-selection";

const UNFAMILIAR_FORAGING_RESULTS = {
  criticalFailure: result({
    text: ({ tributes }) =>
      `${tributes.name} mistakes poisonous berries for edible fruit and is poisoned.`,

    effects: [applyStatus("tributes", "poisoned", 1)],
  }),

  failure: result({
    text: ({ tributes }) => `${tributes.name} misidentifies a bitter root and becomes sick.`,

    effects: [applyStatus("tributes", "sick", 1)],
  }),

  success: result({
    text: ({ tributes }) =>
      `${tributes.name} identifies edible plants and gathers enough food to keep going.`,

    effects: [acquireNaturalResource("tributes", "food"), survived("tributes")],
  }),

  exceptionalSuccess: result({
    text: ({ tributes }) =>
      `${tributes.name} identifies edible plants beside a clean spring and gathers both food and water.`,

    effects: [
      acquireNaturalResource("tributes", "food"),
      acquireNaturalResource("tributes", "water"),
      survived("tributes"),
    ],
  }),
} as const;

function getUnfamiliarForagingResult(outcome: StatCheckOutcome) {
  switch (outcome) {
    case "critical-failure":
      return UNFAMILIAR_FORAGING_RESULTS.criticalFailure;

    case "failure":
      return UNFAMILIAR_FORAGING_RESULTS.failure;

    case "success":
      return UNFAMILIAR_FORAGING_RESULTS.success;

    case "exceptional-success":
      return UNFAMILIAR_FORAGING_RESULTS.exceptionalSuccess;
  }
}

export const SURVIVAL_EVENTS = [
  /* Day Only */
  createNaturalResourceEvent("forages-for-resources", {
    resources: ["food", "water"],
    text: ({ tribute }, itemId) =>
      itemId === "water"
        ? `${tribute.name} follows animal tracks to a clean spring and collects water.`
        : `${tribute.name} identifies edible roots and plants and gathers enough for a meal.`,
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
            recordRequiredItemUse("tribute", { reason: "upside-down-map" }),
          ],
        }),
        failure: result({
          text: ({ tribute }) =>
            `${tribute.name} misreads ${tribute.pronouns.possessiveAdjective} map and becomes hopelessly turned around.`,
          effects: [
            applyStatus("tribute", "disoriented", 1),
            recordRequiredItemUse("tribute", { reason: "upside-down-map" }),
          ],
        }),
        success: randomResult(
          result({
            text: ({ tribute }) =>
              `${tribute.name} correctly reads ${tribute.pronouns.possessiveAdjective} map and follows it to a patch of edible plants.`,
            effects: [
              acquireNaturalResource("tribute", "food"),
              survived("tribute"),
              recordRequiredItemUse("tribute", { reason: "upside-down-map" }),
            ],
          }),
          result({
            text: ({ tribute }) =>
              `${tribute.name} correctly reads ${tribute.pronouns.possessiveAdjective} map and follows it to a clean spring.`,
            effects: [
              acquireNaturalResource("tribute", "water"),
              survived("tribute"),
              recordRequiredItemUse("tribute", { reason: "upside-down-map" }),
            ],
          }),
        ),
        exceptionalSuccess: result({
          text: ({ tribute }) =>
            `${tribute.name} studies ${tribute.pronouns.possessiveAdjective} map and locates a secure natural shelter hidden from the rest of the arena.`,
          effects: [
            applyStatus("tribute", "concealed", 2),
            survived("tribute"),
            recordRequiredItemUse("tribute", { reason: "upside-down-map" }),
          ],
        }),
      }),
    ),

  createEvent("unfamiliar-foraging-ground")
    .group("tributes", 2, {
      getWeight: (tribute, { state, participantsByRole }) =>
        getCooperativeTruceWeight(state, tribute, participantsByRole.tributes ?? []),
    })
    .category("hazard")
    .tags("hazard", "item", "status", "resource")
    .during("day")
    .weight(4)
    .weightMultiplier(getDefinitionPopulationMultiplier)
    .resolve(
      customResolution(
        (context, { resolveResult }) => {
          const tributes = requireParticipants(context.participantsByRole, "tributes");

          const firstTribute = tributes[0];
          const secondTribute = tributes[1];

          if (!firstTribute || !secondTribute || tributes.length !== 2) {
            throw new Error(
              `Event "${context.eventId}" requires exactly two participants in role "tributes".`,
            );
          }

          const resolveParticipant = (tribute: typeof firstTribute) => {
            const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, context.random);

            return resolveResult(
              getUnfamiliarForagingResult(outcome),

              {
                ...context,

                /*
                 * Resolve this participant independently while
                 * retaining the authored "tributes" role ID.
                 */
                participantsByRole: {
                  tributes: [tribute],
                },
              },
            );
          };

          const firstResolution = resolveParticipant(firstTribute);

          const secondResolution = resolveParticipant(secondTribute);

          return {
            text:
              `${firstTribute.snapshot.name} and ` +
              `${secondTribute.snapshot.name} discover a lush ` +
              "clearing filled with unfamiliar plants and a " +
              `small spring. ${firstResolution.text} ` +
              `${secondResolution.text}`,

            changes: [...firstResolution.changes, ...secondResolution.changes],
          };
        },

        {
          possibleResults: Object.values(UNFAMILIAR_FORAGING_RESULTS),
        },
      ),
    ),

  /* Day and Night */
  createEvent("finds-hiding-place")
    .solo("tribute", { getWeight: getSurvivalSelectionWeight })
    .category("survival")
    .tags("survival", "resource")
    .during("day", "night")
    .weight(8)
    .resolve(
      always(
        result({
          text: ({ tribute }) => `${tribute.name} finds a concealed place to rest.`,
          effects: [survived("tribute")],
        }),
      ),
    ),
] satisfies readonly EventDefinition[];
