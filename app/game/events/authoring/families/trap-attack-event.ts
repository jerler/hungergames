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

import { getStatusDefinition } from "~/game/statuses/status-catalogue";

import type { StatusEffectId } from "~/game/statuses/status-schema";

import type { GameTribute, RoundReference } from "~/game/types/game-state";

import type { TributeStatValue } from "~/game/types/tribute";

import { mergeEventTags } from "./family-types";

export interface TrapCriticalFailureStatus {
  statusId: StatusEffectId;
  severity: 1 | 2 | 3;
  durationRounds?: number;
}

export interface TrapAttackEventOptions {
  trapItemId: ItemDefinitionId;

  access?: RequiredItemAccess;

  causeId?: string;
  causeLabel: string;

  difficulty?: TributeStatValue;

  criticalFailureText: EventText;
  failureText: EventText;
  successText: EventText;

  exceptionalSuccessText?: EventText;

  criticalFailureStatus: TrapCriticalFailureStatus;

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

const getTrapAttackerWeight: RoleWeight = (tribute: GameTribute): number => {
  const { brains, brawn, luck } = getEffectiveStats(tribute);

  const tacticalAptitude = brains * 0.7 + luck * 0.3;

  const lowBrawnPreference = Math.max(0, 3 - brawn) * 0.2;

  return Math.max(
    0.25,

    tacticalAptitude + lowBrawnPreference,
  );
};

function validateDifficulty(eventId: string, difficulty: number): void {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    throw new Error(`Trap attack event "${eventId}" declares invalid difficulty ${difficulty}.`);
  }
}

function validateCriticalFailureStatus(eventId: string, status: TrapCriticalFailureStatus): void {
  const definition = getStatusDefinition(status.statusId);

  if (definition.kind !== "harmful") {
    throw new Error(`Trap attack event "${eventId}" must apply a harmful critical-failure status.`);
  }

  if (
    status.durationRounds !== undefined &&
    (!Number.isInteger(status.durationRounds) || status.durationRounds <= 0)
  ) {
    throw new Error(
      `Trap attack event "${eventId}" declares an invalid critical-failure duration.`,
    );
  }

  if (definition.duration.kind === "persistent" && status.durationRounds !== undefined) {
    throw new Error(
      `Trap attack event "${eventId}" cannot override the duration of persistent status "${definition.id}".`,
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
    TrapAttackEventOptions,
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

export function createTrapAttackEvent(
  id: string,
  {
    trapItemId,

    access = "accessible",

    causeId = id,

    causeLabel,

    difficulty = 3,

    criticalFailureText,
    failureText,
    successText,
    exceptionalSuccessText,

    criticalFailureStatus,

    attackerRoleId = "killer",

    victimRoleId = "victim",

    attackerRoleOptions = {},
    victimRoleOptions = {},

    tags = [],

    periods = ["day", "night"],

    weight = 1,

    itemReason = id,

    requirements = [],
  }: TrapAttackEventOptions,
): EventDefinition {
  const itemDefinition = getItemDefinition(trapItemId);

  if (itemDefinition.offense?.strategy !== "trap") {
    throw new Error(
      `Trap attack event "${id}" requires a trap-offense item, ` +
        `but "${trapItemId}" uses ` +
        `"${itemDefinition.offense?.strategy ?? "no"}" offense.`,
    );
  }

  validateDifficulty(id, difficulty);

  validateCriticalFailureStatus(id, criticalFailureStatus);

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
      ...combatRolePair({
        killerRoleId: attackerRoleId,

        victimRoleId,

        killer: {
          ...attackerRoleOptions,

          getWeight: attackerRoleOptions.getWeight ?? getTrapAttackerWeight,
        },

        victim: victimRoleOptions,
      }),
    )
    .when(
      hasItem(attackerRoleId, {
        definitionIds: [trapItemId],

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

          const selectedTrap = getSelectedRoleItem(context, attackerRoleId);

          if (!selectedTrap) {
            throw new Error(
              `Trap attack event "${context.eventId}" resolved without its selected trap.`,
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
                        criticalFailureStatus.statusId,
                        criticalFailureStatus.severity,
                        context.round,
                        criticalFailureStatus.durationRounds,
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
               * Traps are limited-use items, so this
               * produces a consume-item change.
               *
               * The trap is consumed on every outcome.
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
