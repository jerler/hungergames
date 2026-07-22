import { selectRandomItem } from "~/game/engine/random";
import {
  getDefinitionPopulationMultiplier,
  getForagingScore,
  getSurvivalSelectionWeight,
} from "~/game/engine/stat-formulas";
import {
  createItemAcquisitionAndSurvivalChanges,
  createItemUseChange,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";

import {
  requireEventItem,
  resolveLuckAdjustedStatCheck,
} from "~/game/events/event-resolution-helpers";
import type { StatCheckOutcome } from "~/game/events/event-outcomes";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { getCooperativeTruceWeight } from "~/game/truces/truce-selection";
import type { GameChange, GameTribute } from "~/game/types/game-state";

const NATURAL_RESOURCE_ITEM_IDS = ["food", "water"] satisfies readonly ItemDefinitionId[];

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
  {
    id: "forages-for-resources",
    category: "survival",
    tags: ["survival", "item", "resource"],
    periods: ["day"],
    baseWeight: 8,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getForagingScore,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const itemId = selectRandomItem(NATURAL_RESOURCE_ITEM_IDS, random);

      const text =
        itemId === "water"
          ? `${tribute.snapshot.name} follows animal tracks ` +
            "to a clean spring and collects water."
          : `${tribute.snapshot.name} identifies edible ` +
            "roots and plants and gathers enough for a meal.";

      return {
        text,

        changes: createItemAcquisitionAndSurvivalChanges(
          eventId,
          tribute,
          [itemId],
          round,
          "natural-foraging",
        ),
      };
    },
  },
  {
    id: "upside-down-map",
    category: "survival",
    tags: ["survival", "item", "tool", "status", "resource"],
    periods: ["day"],
    baseWeight: 4,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["map"],

        getWeight: getForagingScore,
      },
    ],

    resolve(context): EventResolution {
      const { eventId, round, random, participantsByRole } = context;

      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const map = requireEventItem(context, tribute, "map", "upside-down-map");

      const useMap = createItemUseChange(map.owner, map.item, "upside-down-map");

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, random);

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} follows their map ` +
              "for hours before realizing they have been " +
              "holding it upside down.",

            changes: [createStatusChange(eventId, tribute, "disoriented", 2, round), useMap],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} misreads their map ` +
              "and becomes hopelessly turned around.",

            changes: [createStatusChange(eventId, tribute, "disoriented", 1, round), useMap],
          };

        case "success": {
          const itemId = selectRandomItem(NATURAL_RESOURCE_ITEM_IDS, random);

          const destinationText =
            itemId === "water" ? "a clean spring" : "a patch of edible plants";

          return {
            text:
              `${tribute.snapshot.name} correctly reads ` +
              `their map and follows it to ${destinationText}.`,

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                [itemId],
                round,
                "natural-foraging",
              ),
              useMap,
            ],
          };
        }

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} studies their map ` +
              "and locates a secure natural shelter hidden " +
              "from the rest of the arena.",

            changes: [
              createStatusChange(eventId, tribute, "concealed", 2, round),
              ...createSurvivalChanges([tribute]),
              useMap,
            ],
          };
      }
    },
  },

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
