import { createEvent } from "~/game/events/authoring/builder/create-event";

import type { EventText } from "~/game/events/authoring/characters/event-text-context";
import { satisfySurvivalNeed } from "~/game/events/authoring/effects/survival-effects";
import { acquireNaturalResource } from "~/game/events/authoring/effects/natural-resource-effects";

import { applyStatus } from "~/game/events/authoring/effects/status-effects";

import { survived } from "~/game/events/authoring/effects/statistic-effects";

import {
  createSelectedRoleItemUseChanges,
  getSelectedRoleItem,
} from "~/game/events/authoring/items/selected-role-item";

import type { EventResult } from "~/game/events/authoring/outcomes/outcome-schema";

import { result } from "~/game/events/authoring/outcomes/result";

import { hasItem } from "~/game/events/authoring/requirements/item-requirements";

import { foragerRole } from "~/game/events/authoring/roles/role-presets";

import { customResolution } from "~/game/events/authoring/strategies/custom-resolution";

import { resolveLuckAdjustedBestStatCheck } from "~/game/events/event-resolution-helpers";

import type { StatCheckOutcome } from "~/game/events/event-outcomes";

import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import type { TributeStatValue } from "~/game/types/tribute";

import { mergeEventTags, type EventFamilyMetadata } from "./family-types";

export const HUNTED_FOOD_ITEM_IDS = [
  "rabbit",
  "chicken",
  "fish",
  "eggs",
] as const satisfies readonly ItemDefinitionId[];

export type HuntedFoodItemId = (typeof HUNTED_FOOD_ITEM_IDS)[number];

export interface HuntedFoodEventText {
  criticalFailure: EventText;
  failure: EventText;
  success: EventText;
  exceptionalSuccess: EventText;
}

export interface HuntedFoodEventOptions extends Omit<EventFamilyMetadata, "category"> {
  foodId: HuntedFoodItemId;

  difficulty: TributeStatValue;

  /**
   * Optional at the family configuration level.
   *
   * When supplied, the playable event requires
   * access to this item. The item may belong to
   * the tribute or an active truce partner.
   */
  requiredEquipmentId?: ItemDefinitionId;

  roleId?: string;

  text: HuntedFoodEventText;
}

function getHuntingResult(
  outcome: StatCheckOutcome,
  results: Readonly<{
    criticalFailure: EventResult;
    failure: EventResult;
    success: EventResult;
    exceptionalSuccess: EventResult;
  }>,
): EventResult {
  switch (outcome) {
    case "critical-failure":
      return results.criticalFailure;

    case "failure":
      return results.failure;

    case "success":
      return results.success;

    case "exceptional-success":
      return results.exceptionalSuccess;
  }
}

export function createHuntedFoodEvent(
  id: string,
  {
    foodId,
    difficulty,
    requiredEquipmentId,

    roleId = "tribute",

    text,

    periods = ["day"],

    weight = 4,

    tags = [],

    roleOptions = {},

    requirements = [],
  }: HuntedFoodEventOptions,
): EventDefinition {
  const results = {
    criticalFailure: result({
      text: text.criticalFailure,

      effects: [applyStatus(roleId, "injured", 2)],
    }),

    failure: result({
      text: text.failure,

      effects: [applyStatus(roleId, "exhausted", 1)],
    }),

    success: result({
      text: text.success,

      effects: [acquireNaturalResource(roleId, foodId), survived(roleId)],
    }),

    exceptionalSuccess: result({
      text: text.exceptionalSuccess,

      effects: [
        acquireNaturalResource(roleId, foodId),

        satisfySurvivalNeed(roleId, "food"),

        applyStatus(roleId, "well-fed", 1),

        survived(roleId),
      ],
    }),
  } as const;

  const equipmentRequirements = requiredEquipmentId
    ? [
        hasItem(roleId, {
          definitionIds: [requiredEquipmentId],

          access: "accessible",

          requireUsable: true,
        }),
      ]
    : [];

  return createEvent(id)
    .roles(foragerRole(roleId, roleOptions))
    .when(...equipmentRequirements, ...requirements)
    .category("survival")
    .tags(
      ...mergeEventTags(
        ["survival", "item", "resource", "status"],

        tags,
      ),
    )
    .during(...periods)
    .weight(weight)
    .resolve(
      customResolution(
        (context, { resolveResult }) => {
          const tribute = requireSingleParticipant(context.participantsByRole, roleId);

          const outcome = resolveLuckAdjustedBestStatCheck(
            tribute,
            ["brains", "brawn"],
            difficulty,
            context.random,
          );

          const resolution = resolveResult(getHuntingResult(outcome, results));

          if (!requiredEquipmentId) {
            return resolution;
          }

          const equipment = getSelectedRoleItem(context, roleId);

          if (!equipment || equipment.item.definitionId !== requiredEquipmentId) {
            throw new Error(
              `Hunted-food event "${id}" could not find its selected ` +
                `"${requiredEquipmentId}" equipment.`,
            );
          }

          return {
            ...resolution,

            changes: [
              ...resolution.changes,

              ...createSelectedRoleItemUseChanges(context, roleId, id),
            ],
          };
        },

        {
          possibleResults: Object.values(results),
        },
      ),
    );
}
