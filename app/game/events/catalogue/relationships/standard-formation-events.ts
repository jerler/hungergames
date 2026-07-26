import { getNextRound } from "~/game/engine/rounds";
import {
  requireParticipants,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { createNightRestChanges, createSurvivalChanges } from "~/game/events/event-change-builders";
import {
  createTruceInstance,
  getActiveTruceForTribute,
  getTruceFormationPopulationMultiplier,
} from "~/game/truces/truce-engine";
import {
  getAverageDistrictAffinityWeight,
  TRUCE_GROUP_SIZE_WEIGHTS,
  type TruceGroupSize,
} from "~/game/truces/truce-selection";
const FORMATION_BASE_WEIGHT = 7;

type FormationTheme = "travel-together" | "keep-watch";

function formatNameList(names: readonly string[]): string {
  if (names.length === 0) {
    return "The tributes";
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function createFormationEvent(
  theme: FormationTheme,
  groupSize: TruceGroupSize,
  groupSizeWeight: number,
): EventDefinition {
  const travelsTogether = theme === "travel-together";
  const eventId = `${theme}-truce-${groupSize}`;

  return {
    id: eventId,
    category: "survival",

    tags: ["survival", "truce", "cooperative"],

    periods: travelsTogether ? ["day"] : ["night"],

    /*
     * The weights for all sizes total
     * seven in each period, preserving
     * the original temporary-truce
     * event's overall early-game weight.
     */
    baseWeight: FORMATION_BASE_WEIGHT * (groupSizeWeight / 100),

    roles: [
      {
        id: "tributes",
        count: groupSize,

        isEligible: (tribute, { state }) => !getActiveTruceForTribute(state, tribute.id),

        getWeight: (tribute, { participantsByRole }) =>
          getAverageDistrictAffinityWeight(tribute, participantsByRole.tributes ?? []),
      },
    ],

    isEligible: ({ state, livingTributes }) => {
      if (livingTributes.length <= 3) {
        return false;
      }

      const availableTributes = livingTributes.filter(
        (tribute) => !getActiveTruceForTribute(state, tribute.id),
      );

      return availableTributes.length >= groupSize;
    },

    getWeightMultiplier: ({ state }) => getTruceFormationPopulationMultiplier(state),

    resolve({ eventId: resolvedEventId, round, participantsByRole }): EventResolution {
      const tributes = requireParticipants(participantsByRole, "tributes");

      if (tributes.length !== groupSize) {
        throw new Error(
          `Event "${eventId}" expected ` + `${groupSize} tributes but received ${tributes.length}.`,
        );
      }

      const names = tributes.map((tribute) => tribute.snapshot.name);

      const truce = createTruceInstance(
        resolvedEventId,
        tributes.map((tribute) => tribute.id),
        round,
        getNextRound(round),
      );

      const text = travelsTogether
        ? `${formatNameList(names)} decide that travelling alone is too dangerous and agree to watch one another's backs as they cross the arena.`
        : `${formatNameList(names)} agree to sleep in shifts, sharing warmth while one tribute keeps watch and the others rest.`;

      return {
        text,

        changes: [
          {
            type: "form-truce",
            truce,
          },

          ...(travelsTogether ? [] : createNightRestChanges(tributes, round, "sheltered")),

          ...createSurvivalChanges(tributes),
        ],
      };
    },
  };
}

const STANDARD_DAY_FORMATION_EVENTS = TRUCE_GROUP_SIZE_WEIGHTS.map(({ size, weight }) =>
  createFormationEvent("travel-together", size, weight),
);

const STANDARD_NIGHT_FORMATION_EVENTS = TRUCE_GROUP_SIZE_WEIGHTS.map(({ size, weight }) =>
  createFormationEvent("keep-watch", size, weight),
);

export const STANDARD_FORMATION_EVENTS = [
  /* Day Only */

  ...STANDARD_DAY_FORMATION_EVENTS,

  /* Night Only */

  ...STANDARD_NIGHT_FORMATION_EVENTS,
] satisfies readonly EventDefinition[];
