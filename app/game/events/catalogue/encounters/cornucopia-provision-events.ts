import { getSurvivalSelectionWeight } from "~/game/engine/stat-formulas";
import { resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventSelectionContext,
} from "~/game/events/event-schema";
import {
  CORNUCOPIA_PROVISIONS_ITEM_ID,
  hasDeprivationProtection,
} from "~/game/items/deprivation-protection";
import { resolveCornucopiaProvisionNeed } from "~/game/survival/cornucopia-provision-resolution";
import { qualifiesForDeprivationEvent } from "~/game/survival/survival-history";
import type { SurvivalNeed } from "~/game/survival/survival-schema";

function isProvisionEventEligible(context: EventSelectionContext, need: SurvivalNeed): boolean {
  return context.livingTributes.some(
    (tribute) =>
      hasDeprivationProtection(tribute, need) &&
      qualifiesForDeprivationEvent(context.round, tribute, need),
  );
}

function createCornucopiaProvisionEvent(need: SurvivalNeed): EventDefinition {
  const statusLabel = need === "food" ? "hunger" : "thirst";

  return {
    id: `uses-cornucopia-provisions-${need}`,
    category: "survival",
    tags: ["survival", "item", "status", "deprivation"],
    periods: ["day", "night"],
    baseWeight: 12,

    roles: [
      {
        id: "tribute",
        count: 1,
        itemAccess: "owned",
        requiredItemDefinitionIds: [CORNUCOPIA_PROVISIONS_ITEM_ID],
        isEligible: (tribute, context) =>
          hasDeprivationProtection(tribute, need) &&
          qualifiesForDeprivationEvent(context.round, tribute, need),
        getWeight: getSurvivalSelectionWeight,
      },
    ],

    isEligible: (context) => isProvisionEventEligible(context, need),

    resolve(context) {
      const tribute = requireSingleParticipant(context.participantsByRole, "tribute");

      const outcome = resolveLuckAdjustedStatCheck(tribute, "luck", 3, context.random);

      try {
        return resolveCornucopiaProvisionNeed({
          eventId: context.eventId,
          round: context.round,
          tribute,
          need,
          outcome,
        });
      } catch (error) {
        throw new Error(
          `Could not resolve Cornucopia ${statusLabel} ` + `protection for "${tribute.id}".`,
          {
            cause: error,
          },
        );
      }
    },
  };
}

export const CORNUCOPIA_PROVISION_EVENTS = [
  createCornucopiaProvisionEvent("food"),
  createCornucopiaProvisionEvent("water"),
] satisfies readonly EventDefinition[];
