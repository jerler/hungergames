import { selectRandomItem } from "~/game/engine/random";
import {
  getAwarenessScore,
  getDefinitionPopulationMultiplier,
  getForagingScore,
  getSurvivalSelectionWeight,
} from "~/game/engine/stat-formulas";
import {
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { getItemLabel, resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
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

const SUPPLY_ITEM_IDS = [
  "water",
  "food",
  "medicine",
  "blanket",
  "matches",
  "rope",
  "map",
  "trap-kit",
  "camouflage-net",
  "fishing-gear",
  "shield",
] satisfies readonly ItemDefinitionId[];

const WEAPON_ITEM_IDS = [
  "knife",
  "slingshot",
  "spear",
  "axe",
  "bow",
] satisfies readonly ItemDefinitionId[];

const CACHE_ITEM_IDS = ["water", "food", "medicine"] satisfies readonly ItemDefinitionId[];

function resolvePicnicParticipant(
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
        sentence: `${tribute.snapshot.name} eats the fluorescent berries ` + "and is poisoned.",

        changes: [createStatusChange(eventId, tribute, "poisoned", 1, round)],
      };

    case "failure":
      return {
        sentence: `${tribute.snapshot.name} trusts the custard ` + "and becomes sick.",

        changes: [createStatusChange(eventId, tribute, "sick", 1, round)],
      };

    case "success":
      return {
        sentence: `${tribute.snapshot.name} identifies the safe dishes ` + "and pockets some food.",

        changes: createItemAcquisitionAndSurvivalChanges(eventId, tribute, ["food"], round),
      };

    case "exceptional-success":
      return {
        sentence:
          `${tribute.snapshot.name} finds sealed food and water ` + "hidden beneath the table.",

        changes: createItemAcquisitionAndSurvivalChanges(
          eventId,
          tribute,
          ["food", "water"],
          round,
        ),
      };
  }
}

export const SURVIVAL_EVENTS = [
  /* Day Only */
  {
    id: "finds-water",
    category: "survival",
    tags: ["survival", "item", "resource"],
    periods: ["day"],
    baseWeight: 8,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getSurvivalSelectionWeight,
      },
    ],

    resolve({ eventId, round, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} discovers ` + "a bottle of clean water.",

        changes: createItemAcquisitionAndSurvivalChanges(eventId, tribute, ["water"], round),
      };
    },
  },
  {
    id: "searches-for-supplies",
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

      const itemId = selectRandomItem(SUPPLY_ITEM_IDS, random);

      return {
        text:
          `${tribute.snapshot.name} searches an abandoned ` + `supply crate and finds ${itemId}.`,

        changes: createItemAcquisitionAndSurvivalChanges(eventId, tribute, [itemId], round),
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
        getWeight: getForagingScore,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, random);

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} follows an arena map for hours ` +
              "before realizing it was upside down.",

            changes: [createStatusChange(eventId, tribute, "disoriented", 2, round)],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} attempts to follow a damaged map ` +
              "and becomes hopelessly turned around.",

            changes: [createStatusChange(eventId, tribute, "disoriented", 1, round)],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} corrects an upside-down arena map ` +
              "and keeps it for later.",

            changes: createItemAcquisitionAndSurvivalChanges(eventId, tribute, ["map"], round),
          };

        case "exceptional-success": {
          const cacheItemId = selectRandomItem(CACHE_ITEM_IDS, random);

          return {
            text:
              `${tribute.snapshot.name} corrects an upside-down map ` +
              `and follows it to a cache containing ${getItemLabel(cacheItemId)}.`,

            changes: createItemAcquisitionAndSurvivalChanges(
              eventId,
              tribute,
              ["map", cacheItemId],
              round,
            ),
          };
        }
      }
    },
  },

  {
    id: "suspicious-picnic",
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

      const firstResolution = resolvePicnicParticipant(eventId, round, firstTribute, firstOutcome);

      const secondResolution = resolvePicnicParticipant(
        eventId,
        round,
        secondTribute,
        secondOutcome,
      );

      return {
        text:
          `${firstTribute.snapshot.name} and ${secondTribute.snapshot.name} ` +
          "discover a fully prepared picnic in the middle of the arena. " +
          `${firstResolution.sentence} ${secondResolution.sentence}`,

        changes: [...firstResolution.changes, ...secondResolution.changes],
      };
    },
  },

  /* Night Only */
  {
    id: "keeps-watch",
    category: "survival",
    tags: ["survival", "resource"],
    periods: ["night"],
    baseWeight: 8,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getAwarenessScore,
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} stays awake ` + "through the night, listening for danger.",

        changes: createSurvivalChanges([tribute]),
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
  {
    id: "finds-weapon",
    category: "survival",
    tags: ["survival", "item", "weapon"],
    periods: ["day", "night"],
    baseWeight: 6,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getForagingScore,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const itemId = selectRandomItem(WEAPON_ITEM_IDS, random);

      return {
        text: `${tribute.snapshot.name} discovers ` + `a discarded ${itemId}.`,

        changes: createItemAcquisitionAndSurvivalChanges(eventId, tribute, [itemId], round),
      };
    },
  },
] satisfies readonly EventDefinition[];
