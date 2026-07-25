import { getEffectiveStats } from "~/game/engine/effective-stats";

import { createEvent } from "~/game/events/authoring/builder/create-event";

import type { EventText } from "~/game/events/authoring/characters/event-text-context";

import {
  createSelectedRoleItemUseChanges,
  getSelectedRoleItem,
} from "~/game/events/authoring/items/selected-role-item";

import { result } from "~/game/events/authoring/outcomes/result";

import { hasItem } from "~/game/events/authoring/requirements/item-requirements";

import type {
  AuthoredRequirement,
  RequiredItemAccess,
} from "~/game/events/authoring/requirements/requirement-schema";

import { combatRolePair } from "~/game/events/authoring/roles/combat-role-pair";

import type { AuthoredRoleOptions, RoleWeight } from "~/game/events/authoring/roles/role-schema";

import { customResolution } from "~/game/events/authoring/strategies/custom-resolution";

import {
  createAttemptedKillChange,
  createFatalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";

import { isSuccessfulStatCheckOutcome, type StatCheckOutcome } from "~/game/events/event-outcomes";

import { resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";

import { requireSingleParticipant } from "~/game/events/event-schema";

import type { EventDefinition, EventTag } from "~/game/events/event-schema";

import { getItemDefinition } from "~/game/items/item-catalogue";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import type { GameTribute, RoundReference } from "~/game/types/game-state";

import type { TributeStatValue } from "~/game/types/tribute";

import { mergeEventTags } from "./family-types";

export interface RiskyAreaAttackEventOptions {
  itemId: ItemDefinitionId;

  access?: RequiredItemAccess;

  causeId?: string;
  causeLabel: string;

  difficulty?: TributeStatValue;

  criticalFailureText: EventText;
  failureText: EventText;
  successText: EventText;

  exceptionalSuccessText?: EventText;

  criticalFailureBurnSeverity?: 1 | 2 | 3;
  criticalFailureBurnDurationRounds?: number;

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

const getRiskyAreaAttackerWeight: RoleWeight = (tribute: GameTribute): number => {
  const { brains, brawn, luck } = getEffectiveStats(tribute);

  const tacticalAptitude = brains * 0.65 + luck * 0.35;

  const lowBrawnPreference = Math.max(0, 3 - brawn) * 0.15;

  return Math.max(
    0.25,

    tacticalAptitude + lowBrawnPreference,
  );
};

function validateDifficulty(eventId: string, difficulty: number): void {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    throw new Error(
      `Risky area attack event "${eventId}" declares invalid difficulty ${difficulty}.`,
    );
  }
}

function selectOutcomeText(
  outcome: StatCheckOutcome,
  {
    criticalFailureText,
    failureText,
    successText,
    exceptionalSuccessText,
  }: Pick<
    RiskyAreaAttackEventOptions,
    "criticalFailureText" | "failureText" | "successText" | "exceptionalSuccessText"
  >,
) {
  switch (outcome) {
    case "critical-failure":
      return result({
        text: criticalFailureText,
      });

    case "failure":
      return result({
        text: failureText,
      });

    case "success":
      return result({
        text: successText,
      });

    case "exceptional-success":
      return result({
        text: exceptionalSuccessText ?? successText,
      });
  }
}

export function createRiskyAreaAttackEvent(
  id: string,
  {
    itemId,

    access = "accessible",

    causeId = id,

    causeLabel,

    difficulty = 3,

    criticalFailureText,
    failureText,
    successText,
    exceptionalSuccessText,

    criticalFailureBurnSeverity = 2,

    criticalFailureBurnDurationRounds,

    attackerRoleId = "killer",

    victimRoleId = "victim",

    attackerRoleOptions = {},
    victimRoleOptions = {},

    tags = [],

    periods = ["day", "night"],

    weight = 1,

    itemReason = id,

    requirements = [],
  }: RiskyAreaAttackEventOptions,
): EventDefinition {
  const itemDefinition = getItemDefinition(itemId);

  if (itemDefinition.offense?.strategy !== "risky-area") {
    throw new Error(
      `Risky area attack event "${id}" requires a risky-area item, ` +
        `but "${itemId}" uses ` +
        `"${itemDefinition.offense?.strategy ?? "no"}" offense.`,
    );
  }

  validateDifficulty(id, difficulty);

  if (
    criticalFailureBurnDurationRounds !== undefined &&
    (!Number.isInteger(criticalFailureBurnDurationRounds) || criticalFailureBurnDurationRounds <= 0)
  ) {
    throw new Error(`Risky area attack event "${id}" declares an invalid burn duration.`);
  }

  const possibleResults = [
    selectOutcomeText("critical-failure", {
      criticalFailureText,
      failureText,
      successText,
      exceptionalSuccessText,
    }),

    selectOutcomeText("failure", {
      criticalFailureText,
      failureText,
      successText,
      exceptionalSuccessText,
    }),

    selectOutcomeText("success", {
      criticalFailureText,
      failureText,
      successText,
      exceptionalSuccessText,
    }),

    selectOutcomeText("exceptional-success", {
      criticalFailureText,
      failureText,
      successText,
      exceptionalSuccessText,
    }),
  ] as const;

  return createEvent(id)
    .roles(
      /*
       * Exactly one attacker and one victim.
       *
       * Multi-target area attacks remain explicitly
       * deferred from Phase 10.
       */
      ...combatRolePair({
        killerRoleId: attackerRoleId,

        victimRoleId,

        killer: {
          ...attackerRoleOptions,

          getWeight: attackerRoleOptions.getWeight ?? getRiskyAreaAttackerWeight,
        },

        victim: victimRoleOptions,
      }),
    )
    .when(
      hasItem(attackerRoleId, {
        definitionIds: [itemId],

        access,
      }),

      ...requirements,
    )
    .category("hazard")
    .tags(
      ...mergeEventTags(
        ["hazard", "combat", "weapon", "item", "fatal"],

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

          const selectedItem = getSelectedRoleItem(context, attackerRoleId);

          if (!selectedItem) {
            throw new Error(
              `Risky area attack event "${context.eventId}" resolved without its selected item.`,
            );
          }

          const outcome = resolveLuckAdjustedStatCheck(
            attacker,
            "brains",
            difficulty,
            context.random,
          );

          const successful = isSuccessfulStatCheckOutcome(outcome);

          const authoredResult = selectOutcomeText(outcome, {
            criticalFailureText,
            failureText,
            successText,
            exceptionalSuccessText,
          });

          const resolution = resolveResult(authoredResult);

          const outcomeChanges = successful
            ? createFatalChanges(victim, causeId, causeLabel, resolution.text, attacker)
            : [
                createAttemptedKillChange(attacker),

                ...createSurvivalChanges([attacker, victim]),

                ...(outcome === "critical-failure"
                  ? [
                      createStatusChange(
                        context.eventId,
                        attacker,
                        "burned",
                        criticalFailureBurnSeverity,
                        context.round,
                        criticalFailureBurnDurationRounds,
                      ),
                    ]
                  : []),
              ];

          return {
            ...resolution,

            changes: [
              ...resolution.changes,

              ...outcomeChanges,

              /*
               * The firebomb is consumed regardless
               * of whether the attack succeeds.
               */
              ...createSelectedRoleItemUseChanges(context, attackerRoleId, itemReason),
            ],
          };
        },

        {
          possibleResults,
        },
      ),
    );
}
