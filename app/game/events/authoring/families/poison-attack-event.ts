import { getEffectiveStats } from "~/game/engine/effective-stats";

import { createEvent } from "~/game/events/authoring/builder/create-event";

import type { EventText } from "~/game/events/authoring/characters/event-text-context";

import {
  createSelectedRoleItemUseChanges,
  getSelectedRoleItem,
} from "~/game/events/authoring/items/selected-role-item";

import { result } from "~/game/events/authoring/outcomes/result";

import { hasItem } from "~/game/events/authoring/requirements/item-requirements";

import { lacksStatus } from "~/game/events/authoring/requirements/status-requirements";

import type {
  AuthoredRequirement,
  RequiredItemAccess,
} from "~/game/events/authoring/requirements/requirement-schema";

import { combatRolePair } from "~/game/events/authoring/roles/combat-role-pair";

import type { AuthoredRoleOptions, RoleWeight } from "~/game/events/authoring/roles/role-schema";

import { customResolution } from "~/game/events/authoring/strategies/custom-resolution";

import {
  createAttemptedKillChange,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";

import { isSuccessfulStatCheckOutcome } from "~/game/events/event-outcomes";

import { resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";

import { requireSingleParticipant } from "~/game/events/event-schema";

import type { EventDefinition, EventTag } from "~/game/events/event-schema";

import { getItemDefinition } from "~/game/items/item-catalogue";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import type { GameTribute, RoundReference } from "~/game/types/game-state";

import type { TributeStatValue } from "~/game/types/tribute";

import { mergeEventTags } from "./family-types";

export interface PoisonAttackEventOptions {
  poisonItemId: ItemDefinitionId;

  access?: RequiredItemAccess;

  /**
   * Brains check difficulty.
   *
   * Luck continues to adjust the difficulty through
   * the shared luck-adjusted stat-check helper.
   */
  difficulty?: TributeStatValue;

  successText: EventText;
  failureText: EventText;

  attackerRoleId?: string;
  victimRoleId?: string;

  attackerRoleOptions?: AuthoredRoleOptions;
  victimRoleOptions?: AuthoredRoleOptions;

  tags?: readonly EventTag[];

  periods?: readonly RoundReference["period"][];

  weight?: number;

  itemReason?: string;

  requirements?: readonly AuthoredRequirement[];
}

const getPoisonAttackerWeight: RoleWeight = (tribute: GameTribute): number => {
  const { brains, brawn, luck } = getEffectiveStats(tribute);

  /*
   * Tactical poison attacks strongly favour Brains
   * and Luck while giving low-Brawn tributes a small
   * strategic preference.
   */
  const aptitude = brains * 0.7 + luck * 0.3;

  const lowBrawnPreference = Math.max(0, 3 - brawn) * 0.15;

  return Math.max(0.25, aptitude + lowBrawnPreference);
};

export function createPoisonAttackEvent(
  id: string,
  {
    poisonItemId,

    access = "accessible",

    difficulty = 3,

    successText,
    failureText,

    attackerRoleId = "killer",

    victimRoleId = "victim",

    attackerRoleOptions = {},
    victimRoleOptions = {},

    tags = [],

    periods = ["day", "night"],

    weight = 1,

    itemReason = id,

    requirements = [],
  }: PoisonAttackEventOptions,
): EventDefinition {
  const itemDefinition = getItemDefinition(poisonItemId);

  if (itemDefinition.offense?.strategy !== "poison") {
    throw new Error(
      `Poison attack event "${id}" requires a poison-offense item, ` +
        `but "${poisonItemId}" uses ` +
        `"${itemDefinition.offense?.strategy ?? "no"}" offense.`,
    );
  }

  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    throw new Error(`Poison attack event "${id}" declares invalid difficulty ${difficulty}.`);
  }

  const success = result({
    text: successText,
  });

  const failure = result({
    text: failureText,
  });

  return createEvent(id)
    .roles(
      ...combatRolePair({
        killerRoleId: attackerRoleId,

        victimRoleId,

        killer: {
          ...attackerRoleOptions,

          getWeight: attackerRoleOptions.getWeight ?? getPoisonAttackerWeight,
        },

        victim: victimRoleOptions,
      }),
    )
    .when(
      hasItem(attackerRoleId, {
        definitionIds: [poisonItemId],

        access,
      }),

      /*
       * Prevent ambiguous attribution caused by
       * merging a second poison source into an
       * already active poisoned status.
       */
      lacksStatus(victimRoleId, "poisoned"),

      ...requirements,
    )
    .category("hazard")
    .tags(
      ...mergeEventTags(
        ["hazard", "combat", "weapon", "status"],

        tags,
      ),
    )
    .during(...periods)
    .weight(weight)
    .resolve(
      customResolution(
        (context, { resolveResult }) => {
          const attacker = requireSingleParticipant(context.participantsByRole, attackerRoleId);

          const victim = requireSingleParticipant(context.participantsByRole, victimRoleId);

          const poisonItem = getSelectedRoleItem(context, attackerRoleId);

          if (!poisonItem) {
            throw new Error(
              `Poison attack event "${context.eventId}" ` +
                "resolved without its selected poison item.",
            );
          }

          const outcome = resolveLuckAdjustedStatCheck(
            attacker,
            "brains",
            difficulty,
            context.random,
          );

          const successful = isSuccessfulStatCheckOutcome(outcome);

          const resolution = resolveResult(successful ? success : failure);

          return {
            ...resolution,

            changes: [
              ...resolution.changes,

              createAttemptedKillChange(attacker),

              ...createSurvivalChanges([attacker, victim]),

              ...(successful
                ? [
                    createStatusChange(
                      context.eventId,
                      victim,
                      "poisoned",

                      /*
                       * Severe poison, as required by
                       * the Phase 10 blowgun path.
                       */
                      3,

                      context.round,

                      /*
                       * One full active round before
                       * fatal expiration.
                       */
                      1,

                      attacker.id,
                    ),
                  ]
                : []),

              /*
               * Blowguns record reusable use.
               * Poison vials consume their one use.
               *
               * Physical ownership remains attached
               * to the selected item owner.
               */
              ...createSelectedRoleItemUseChanges(context, attackerRoleId, itemReason),
            ],
          };
        },

        {
          possibleResults: [success, failure],
        },
      ),
    );
}
