import { getNextRound } from "~/game/engine/rounds";
import {
  requireParticipants,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { createSurvivalChanges } from "~/game/events/event-change-builders";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
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
import type { GameChange, GameTribute } from "~/game/types/game-state";

const FORMATION_BASE_WEIGHT = 7;

const SHARED_SUPPLY_IDS = ["food", "water"] satisfies readonly ItemDefinitionId[];

type FormationTheme = "share-shelter" | "split-supplies";

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

function createSupplyChanges(
  eventId: string,
  tributes: readonly GameTribute[],
  round: Parameters<typeof createInventoryItemInstance>[3],
): GameChange[] {
  return tributes.map((tribute, index) => {
    const itemId = SHARED_SUPPLY_IDS[index % SHARED_SUPPLY_IDS.length];

    return {
      type: "acquire-item",
      tributeId: tribute.id,
      item: createInventoryItemInstance(eventId, tribute.id, itemId, round),
    };
  });
}

function createFormationEvent(
  theme: FormationTheme,
  groupSize: TruceGroupSize,
  groupSizeWeight: number,
): EventDefinition {
  const sharesShelter = theme === "share-shelter";
  const eventId = `${theme}-truce-${groupSize}`;

  return {
    id: eventId,
    category: "survival",

    tags: sharesShelter
      ? ["survival", "truce", "cooperative", "environment"]
      : ["survival", "truce", "cooperative", "item", "resource"],

    periods: sharesShelter ? ["day"] : ["night"],

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

      const changes: GameChange[] = [
        {
          type: "form-truce",
          truce,
        },

        ...createSurvivalChanges(tributes),
      ];

      if (!sharesShelter) {
        changes.push(...createSupplyChanges(resolvedEventId, tributes, round));
      }

      const text = sharesShelter
        ? `${formatNameList(names)} discover a defensible shelter ` +
          "and agree to share it through the coming night."
        : `${formatNameList(names)} divide an abandoned supply cache ` +
          "and agree to travel together temporarily.";

      return {
        text,
        changes,
      };
    },
  };
}

const STANDARD_DAY_FORMATION_EVENTS = TRUCE_GROUP_SIZE_WEIGHTS.map(({ size, weight }) =>
  createFormationEvent("share-shelter", size, weight),
);

const STANDARD_NIGHT_FORMATION_EVENTS = TRUCE_GROUP_SIZE_WEIGHTS.map(({ size, weight }) =>
  createFormationEvent("split-supplies", size, weight),
);

export const STANDARD_FORMATION_EVENTS = [
  /* Day Only */

  ...STANDARD_DAY_FORMATION_EVENTS,

  /* Night Only */

  ...STANDARD_NIGHT_FORMATION_EVENTS,
] satisfies readonly EventDefinition[];
