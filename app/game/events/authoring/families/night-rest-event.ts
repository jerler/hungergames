import { createEvent } from "~/game/events/authoring/builder/create-event";
import type { EventText } from "~/game/events/authoring/characters/event-text-context";
import type { EventEffect } from "~/game/events/authoring/effects/effect-schema";
import { survived } from "~/game/events/authoring/effects/statistic-effects";
import { createNightRestChanges } from "~/game/events/event-change-builders";
import { getSelectedRoleItem } from "~/game/events/authoring/items/selected-role-item";
import type { EventResult } from "~/game/events/authoring/outcomes/outcome-schema";
import { result } from "~/game/events/authoring/outcomes/result";
import { hasItem } from "~/game/events/authoring/requirements/item-requirements";
import { soloRole } from "~/game/events/authoring/roles/role-presets";
import type {
  AuthoredRoleOptions,
  RoleItemAccess,
} from "~/game/events/authoring/roles/role-schema";
import { customResolution } from "~/game/events/authoring/strategies/custom-resolution";
import { isSuccessfulStatCheckOutcome, type StatCheckOutcome } from "~/game/events/event-outcomes";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import { resolveItemRestAttempt } from "~/game/items/item-rest-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { resolveNaturalShelterCheck } from "~/game/survival/natural-shelter";
import type { NightRestQuality } from "~/game/survival/survival-schema";
import type { GameChange } from "~/game/types/game-state";

import { mergeEventTags, type EventFamilyMetadata } from "./family-types";

export const NIGHT_REST_ITEM_IDS = [
  "blanket",
  "sleeping-bag",
  "thermal-blanket",
  "pillow",
  "tent",
  "tarp",
  "lighter",
  "matches",
  "flint-stone",
] as const satisfies readonly ItemDefinitionId[];

export type NightRestItemId = (typeof NIGHT_REST_ITEM_IDS)[number];

type SuccessfulNightRestOutcome = Extract<StatCheckOutcome, "success" | "exceptional-success">;

type FailedNightRestOutcome = Extract<StatCheckOutcome, "critical-failure" | "failure">;

export type NightRestMethod =
  | {
      type: "natural";
    }
  | {
      type: "item-assisted";
      itemDefinitionIds?: readonly NightRestItemId[];
      access?: RoleItemAccess;
    }
  | {
      type: "guaranteed";
      quality: Exclude<NightRestQuality, "unsheltered">;
      outcome?: SuccessfulNightRestOutcome;
    }
  | {
      type: "failed";
      outcome?: FailedNightRestOutcome;
    };

export interface NightRestEventOutcome {
  text: EventText;
  effects?: readonly EventEffect[];
}

export interface NightRestEventResults {
  criticalFailure: NightRestEventOutcome;
  failure: NightRestEventOutcome;
  success: NightRestEventOutcome;
  exceptionalSuccess: NightRestEventOutcome;
}

export interface NightRestEventOptions extends Omit<EventFamilyMetadata, "periods"> {
  method?: NightRestMethod;

  roleId?: string;
  companionRoleId?: string;
  companionRoleOptions?: AuthoredRoleOptions;

  results: NightRestEventResults;
}

interface ResolvedNightRestAttempt {
  outcome: StatCheckOutcome;
  quality: NightRestQuality;
  changes: GameChange[];
}

function getNightRestResult(
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

function getEliminatedRoleIds(outcome: NightRestEventOutcome): ReadonlySet<string> {
  return new Set(
    (outcome.effects ?? []).flatMap((effect) =>
      effect.type === "eliminate" ? [effect.roleId] : [],
    ),
  );
}

function createAuthoredResult(
  outcome: NightRestEventOutcome,
  participantRoleIds: readonly string[],
): EventResult {
  const eliminatedRoleIds = getEliminatedRoleIds(outcome);

  return result({
    text: outcome.text,
    effects: [
      ...(outcome.effects ?? []),
      ...participantRoleIds
        .filter((roleId) => !eliminatedRoleIds.has(roleId))
        .map((roleId) => survived(roleId)),
    ],
  });
}

function createParticipantNightRestChanges(
  context: EventResolutionContext,
  roleIds: readonly string[],
  quality: NightRestQuality,
): GameChange[] {
  const tributes = roleIds.map((roleId) =>
    requireSingleParticipant(context.participantsByRole, roleId),
  );

  return createNightRestChanges(tributes, context.round, quality);
}

function resolveNightRestAttempt(
  eventDefinitionId: string,
  method: NightRestMethod,
  context: EventResolutionContext,
  roleIds: readonly string[],
): ResolvedNightRestAttempt {
  if (context.round.period !== "night") {
    throw new Error(`Night-rest event "${eventDefinitionId}" can only resolve at night.`);
  }

  const [primaryRoleId, ...companionRoleIds] = roleIds;

  if (!primaryRoleId) {
    throw new Error(`Night-rest event "${eventDefinitionId}" has no primary role.`);
  }

  const primaryTribute = requireSingleParticipant(context.participantsByRole, primaryRoleId);

  switch (method.type) {
    case "natural": {
      const outcome = resolveNaturalShelterCheck(primaryTribute, context.random);
      const quality = isSuccessfulStatCheckOutcome(outcome) ? "sheltered" : "unsheltered";

      return {
        outcome,
        quality,
        changes: createParticipantNightRestChanges(context, roleIds, quality),
      };
    }

    case "item-assisted": {
      const selection = getSelectedRoleItem(context, primaryRoleId);

      if (!selection) {
        throw new Error(
          `Night-rest event "${eventDefinitionId}" could not find its selected rest item.`,
        );
      }

      const itemResolution = resolveItemRestAttempt({
        eventId: context.eventId,
        round: context.round,
        random: context.random,
        actingTribute: primaryTribute,
        owner: selection.owner,
        item: selection.item,
        reason: eventDefinitionId,
      });

      return {
        outcome: itemResolution.outcome ?? "success",
        quality: itemResolution.quality,
        changes: [
          ...itemResolution.changes,
          ...createParticipantNightRestChanges(context, companionRoleIds, itemResolution.quality),
        ],
      };
    }

    case "guaranteed":
      return {
        outcome: method.outcome ?? "success",
        quality: method.quality,
        changes: createParticipantNightRestChanges(context, roleIds, method.quality),
      };

    case "failed":
      return {
        outcome: method.outcome ?? "failure",
        quality: "unsheltered",
        changes: createParticipantNightRestChanges(context, roleIds, "unsheltered"),
      };
  }
}

function containsFatalOutcome(results: NightRestEventResults): boolean {
  const outcomes: readonly NightRestEventOutcome[] = Object.values(results);

  return outcomes.some((outcome) =>
    (outcome.effects ?? []).some((effect: EventEffect) => effect.type === "eliminate"),
  );
}

export function createNightRestEvent(
  id: string,
  {
    method = {
      type: "natural",
    },
    roleId = "tribute",
    companionRoleId,
    companionRoleOptions = {},
    results,
    category,
    tags = [],
    weight = 4,
    roleOptions = {},
    requirements = [],
  }: NightRestEventOptions,
): EventDefinition {
  if (companionRoleId === roleId) {
    throw new Error(`Night-rest event "${id}" must use different primary and companion role IDs.`);
  }

  const participantRoleIds = companionRoleId ? [roleId, companionRoleId] : [roleId];

  const authoredResults = {
    criticalFailure: createAuthoredResult(results.criticalFailure, participantRoleIds),
    failure: createAuthoredResult(results.failure, participantRoleIds),
    success: createAuthoredResult(results.success, participantRoleIds),
    exceptionalSuccess: createAuthoredResult(results.exceptionalSuccess, participantRoleIds),
  } as const;

  const itemRequirements =
    method.type === "item-assisted"
      ? [
          hasItem(roleId, {
            definitionIds: method.itemDefinitionIds ?? NIGHT_REST_ITEM_IDS,
            access: method.access ?? "accessible",
            requireUsable: true,
          }),
        ]
      : [];

  const fatal = containsFatalOutcome(results);

  return createEvent(id)
    .roles(
      soloRole(roleId, roleOptions),
      ...(companionRoleId ? [soloRole(companionRoleId, companionRoleOptions)] : []),
    )
    .when(...itemRequirements, ...requirements)
    .category(category ?? (fatal ? "fatal" : "survival"))
    .tags(
      ...mergeEventTags(
        [
          "survival",
          "status",
          ...(method.type === "item-assisted" ? (["item", "tool"] as const) : []),
          ...(companionRoleId ? (["cooperative"] as const) : []),
          ...(fatal ? (["fatal"] as const) : []),
        ],
        tags,
      ),
    )
    .during("night")
    .weight(weight)
    .resolve(
      customResolution(
        (context, { resolveResult }) => {
          const restAttempt = resolveNightRestAttempt(id, method, context, participantRoleIds);

          const resolution = resolveResult(
            getNightRestResult(restAttempt.outcome, authoredResults),
          );

          return {
            ...resolution,
            changes: [...restAttempt.changes, ...resolution.changes],
          };
        },
        {
          possibleResults: Object.values(authoredResults),
        },
      ),
    );
}
