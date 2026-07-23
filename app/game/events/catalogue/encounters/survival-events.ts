import {
  getDefinitionPopulationMultiplier,
  getForagingScore,
  getSurvivalSelectionWeight,
} from "~/game/engine/stat-formulas";
import {
  acquireNaturalResource,
  applyStatus,
  brains,
  createEvent,
  createNaturalResourceEvent,
  hasItem,
  randomResult,
  recordRequiredItemUse,
  result,
  soloRole,
  statCheck,
  survived,
} from "~/game/events/authoring";
import {
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
import type { StatCheckOutcome } from "~/game/events/event-outcomes";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import { getCooperativeTruceWeight } from "~/game/truces/truce-selection";
import type { GameChange, GameTribute } from "~/game/types/game-state";

function resolveForagingParticipant(
  eventId: string,
  round: EventResolutionContext["round"],
  tribute: GameTribute,
  outcome: StatCheckOutcome,
): {
  sentence: string;
  changes: GameChange[];
} {
  switch (outcome) {
    case "critical-failure":
      return {
        sentence:
          `${tribute.snapshot.name} mistakes poisonous ` +
          "berries for edible fruit and is poisoned.",

        changes: [createStatusChange(eventId, tribute, "poisoned", 1, round)],
      };

    case "failure":
      return {
        sentence: `${tribute.snapshot.name} misidentifies a ` + "bitter root and becomes sick.",

        changes: [createStatusChange(eventId, tribute, "sick", 1, round)],
      };

    case "success":
      return {
        sentence:
          `${tribute.snapshot.name} identifies edible ` +
          "plants and gathers enough food to keep going.",

        changes: createItemAcquisitionAndSurvivalChanges(
          eventId,
          tribute,
          ["food"],
          round,
          "natural-foraging",
        ),
      };

    case "exceptional-success":
      return {
        sentence:
          `${tribute.snapshot.name} identifies edible ` +
          "plants beside a clean spring and gathers both " +
          "food and water.",

        changes: createItemAcquisitionAndSurvivalChanges(
          eventId,
          tribute,
          ["food", "water"],
          round,
          "natural-foraging",
        ),
      };
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
    .roles(soloRole("tribute", { getWeight: getForagingScore }))
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

  {
    id: "unfamiliar-foraging-ground",
    category: "hazard",
    tags: ["hazard", "item", "status", "resource"],
    periods: ["day"],
    baseWeight: 4,

    roles: [
      {
        id: "tributes",
        count: 2,

        getWeight: (tribute, { state, participantsByRole }) =>
          getCooperativeTruceWeight(state, tribute, participantsByRole.tributes ?? []),
      },
    ],

    isEligible: ({ livingTributes }) => livingTributes.length >= 2,

    getWeightMultiplier: getDefinitionPopulationMultiplier,

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const [firstTribute, secondTribute] = requireParticipants(participantsByRole, "tributes");

      const firstOutcome = resolveLuckAdjustedStatCheck(firstTribute, "brains", 3, random);

      const secondOutcome = resolveLuckAdjustedStatCheck(secondTribute, "brains", 3, random);

      const firstResolution = resolveForagingParticipant(
        eventId,
        round,
        firstTribute,
        firstOutcome,
      );

      const secondResolution = resolveForagingParticipant(
        eventId,
        round,
        secondTribute,
        secondOutcome,
      );

      return {
        text:
          `${firstTribute.snapshot.name} and ` +
          `${secondTribute.snapshot.name} discover a lush ` +
          "clearing filled with unfamiliar plants and a " +
          `small spring. ${firstResolution.sentence} ` +
          secondResolution.sentence,

        changes: [...firstResolution.changes, ...secondResolution.changes],
      };
    },
  },

  /* Day and Night */
  {
    id: "finds-hiding-place",
    category: "survival",
    tags: ["survival", "resource"],
    periods: ["day", "night"],
    baseWeight: 8,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getSurvivalSelectionWeight,
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} finds ` + "a concealed place to rest.",

        changes: createSurvivalChanges([tribute]),
      };
    },
  },
] satisfies readonly EventDefinition[];
