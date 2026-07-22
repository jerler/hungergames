import { selectRandomItem } from "~/game/engine/random";
import {
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
} from "~/game/events/event-change-builders";
import {
  getItemLabel,
  resolveLuckAdjustedStatCheck,
} from "~/game/events/event-resolution-helpers";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import type { ItemDefinitionId } from "~/game/items/item-schema";

const PACK_ITEM_IDS = [
  "medicine",
  "blanket",
  "matches",
  "rope",
  "map",
  "camouflage-net",
  "fishing-gear",
  "trap-kit",
  "shield",
] satisfies readonly ItemDefinitionId[];

const EDGE_WEAPON_ITEM_IDS = [
  "knife",
  "slingshot",
  "spear",
  "axe",
  "bow",
] satisfies readonly ItemDefinitionId[];

function selectDistinctItems(
  itemIds: readonly ItemDefinitionId[],
  count: number,
  random: () => number,
): ItemDefinitionId[] {
  const remainingItemIds = [...itemIds];
  const selectedItemIds: ItemDefinitionId[] = [];

  while (
    selectedItemIds.length < count &&
    remainingItemIds.length > 0
  ) {
    const selectedItemId = selectRandomItem(
      remainingItemIds,
      random,
    );

    selectedItemIds.push(selectedItemId);

    remainingItemIds.splice(
      remainingItemIds.indexOf(selectedItemId),
      1,
    );
  }

  return selectedItemIds;
}

export const CORNUCOPIA_ACQUISITION_EVENTS = [
  {
    id: "cornucopia-nearby-pack",
    category: "hazard",
    tags: [
      "hazard",
      "item",
      "resource",
    ],
    periods: ["day"],
    baseWeight: 6,

    roles: [
      {
        id: "tribute",
        count: 1,
      },
    ],

    resolve({
      eventId,
      round,
      random,
      participantsByRole,
    }): EventResolution {
      const tribute = requireSingleParticipant(
        participantsByRole,
        "tribute",
      );

      const outcome = resolveLuckAdjustedStatCheck(
        tribute,
        "brawn",
        3,
        random,
      );

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} reaches for a pack, ` +
              "but is knocked violently against the Cornucopia " +
              "and escapes badly injured.",

            changes: [
              createStatusChange(
                eventId,
                tribute,
                "injured",
                2,
                round,
              ),
            ],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} struggles through the ` +
              "crowd toward a supply pack, but is forced to " +
              "retreat empty-handed and exhausted.",

            changes: [
              createStatusChange(
                eventId,
                tribute,
                "exhausted",
                1,
                round,
              ),
            ],
          };

        case "success": {
          const itemId = selectRandomItem(
            PACK_ITEM_IDS,
            random,
          );

          return {
            text:
              `${tribute.snapshot.name} grabs a nearby pack ` +
              `containing ${getItemLabel(itemId)} and escapes.`,

            changes:
              createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                [itemId],
                round,
                "cornucopia",
              ),
          };
        }

        case "exceptional-success": {
          const itemIds = selectDistinctItems(
            PACK_ITEM_IDS,
            2,
            random,
          );

          const itemLabels = itemIds.map(getItemLabel);

          return {
            text:
              `${tribute.snapshot.name} reaches a supply pile ` +
              `before the nearby tributes and escapes with ` +
              `${itemLabels.join(" and ")}.`,

            changes:
              createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                itemIds,
                round,
                "cornucopia",
              ),
          };
        }
      }
    },
  },

  {
    id: "cornucopia-edge-weapon",
    category: "hazard",
    tags: [
      "hazard",
      "combat",
      "weapon",
      "item",
    ],
    periods: ["day"],
    baseWeight: 5,

    roles: [
      {
        id: "tribute",
        count: 1,
      },
    ],

    resolve({
      eventId,
      round,
      random,
      participantsByRole,
    }): EventResolution {
      const tribute = requireSingleParticipant(
        participantsByRole,
        "tribute",
      );

      const outcome = resolveLuckAdjustedStatCheck(
        tribute,
        "brawn",
        3,
        random,
      );

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} lunges for a weapon ` +
              "near the Cornucopia's edge, but is trampled " +
              "and forced to crawl away.",

            changes: [
              createStatusChange(
                eventId,
                tribute,
                "injured",
                2,
                round,
              ),
            ],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} reaches the edge of ` +
              "the weapon pile, but abandons the attempt as " +
              "the fighting closes around them.",

            changes: [
              createStatusChange(
                eventId,
                tribute,
                "exhausted",
                1,
                round,
              ),
            ],
          };

        case "success": {
          const itemId = selectRandomItem(
            EDGE_WEAPON_ITEM_IDS,
            random,
          );

          return {
            text:
              `${tribute.snapshot.name} snatches ` +
              `${getItemLabel(itemId)} from the edge of the ` +
              "Cornucopia and escapes.",

            changes:
              createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                [itemId],
                round,
                "cornucopia",
              ),
          };
        }

        case "exceptional-success": {
          const itemId = selectRandomItem(
            EDGE_WEAPON_ITEM_IDS,
            random,
          );

          return {
            text:
              `${tribute.snapshot.name} darts through the ` +
              `chaos, claims ${getItemLabel(itemId)}, and ` +
              "escapes before anyone can challenge them.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                [itemId],
                round,
                "cornucopia",
              ),

              createStatusChange(
                eventId,
                tribute,
                "inspired",
                1,
                round,
              ),
            ],
          };
        }
      }
    },
  },
] satisfies readonly EventDefinition[];