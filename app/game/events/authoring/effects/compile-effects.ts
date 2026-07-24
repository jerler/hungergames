import {
  createFatalChanges,
  createItemUseChange,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import {
  requireSingleParticipant,
  type EventItemSelection,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { GameChange } from "~/game/types/game-state";
import type { StatusDefinition } from "~/game/statuses/status-schema";
import type { EventEffect, RequiredItemEffect } from "./effect-schema";
import { compileItemUseEffects } from "~/game/items/item-effect-engine";
import { compileItemRestChanges } from "~/game/items/item-rest-engine";
import type { GameTribute } from "~/game/types/game-state";

function isRequiredItemEffect(effect: EventEffect): effect is RequiredItemEffect {
  return (
    effect.type === "use-required-item" ||
    effect.type === "consume-required-item" ||
    effect.type === "apply-required-item-effects" ||
    effect.type === "apply-required-item-rest"
  );
}

function requireSelectionUser(
  context: EventResolutionContext,
  selection: EventItemSelection,
): GameTribute {
  const participant = Object.values(context.participantsByRole)
    .flat()
    .find((tribute) => tribute.id === selection.userTributeId);

  if (!participant) {
    throw new Error(
      `Event "${context.eventId}": selected item ` +
        `"${selection.item.id}" references ` +
        `missing acting tribute ` +
        `"${selection.userTributeId}".`,
    );
  }

  return participant;
}

function requireSelectedItems(
  context: EventResolutionContext,
  roleId: string,
  effectType: RequiredItemEffect["type"],
): readonly EventItemSelection[] {
  const selections = context.itemsByRole?.[roleId];

  if (!selections || selections.length === 0) {
    throw new Error(
      `Event "${context.eventId}": effect "${effectType}" ` +
        `could not find the required item selected for role "${roleId}".`,
    );
  }

  return selections;
}

function compileRequiredItemEffect(
  effect: RequiredItemEffect,
  context: EventResolutionContext,
): GameChange[] {
  const selections = requireSelectedItems(context, effect.roleId, effect.type);

  const reason = effect.reason ?? context.eventId;

  return selections.flatMap((selection): GameChange[] => {
    const { owner, item } = selection;

    switch (effect.type) {
      case "use-required-item":
        if (item.usesRemaining !== null) {
          throw new Error(
            `Event "${context.eventId}": effect "use-required-item" ` +
              `expected a reusable item for role "${effect.roleId}", ` +
              `but selected "${item.definitionId}" has limited uses.`,
          );
        }

        return [createItemUseChange(owner, item, reason)];

      case "consume-required-item":
        if (item.usesRemaining === null) {
          throw new Error(
            `Event "${context.eventId}": effect "consume-required-item" ` +
              `expected a limited-use item for role "${effect.roleId}", ` +
              `but selected "${item.definitionId}" is reusable.`,
          );
        }

        return [createItemUseChange(owner, item, reason)];

      case "apply-required-item-effects": {
        const actingTribute = requireSelectionUser(context, selection);

        return compileItemUseEffects({
          eventId: context.eventId,

          round: context.round,

          actingTribute,
          owner,
          item,
          reason,
        });
      }

      case "apply-required-item-rest": {
        const actingTribute = requireSelectionUser(context, selection);

        return compileItemRestChanges({
          eventId: context.eventId,

          round: context.round,

          random: context.random,

          actingTribute,
          owner,
          item,
          reason,
        });
      }
    }
  });
}

function validateNaturalResourceEffect(
  eventId: string,
  effect: Extract<
    EventEffect,
    {
      type: "acquire-natural-resource";
    }
  >,
): void {
  let definition;

  try {
    definition = getItemDefinition(effect.itemId);
  } catch {
    throw new Error(
      `Event "${eventId}": effect "acquire-natural-resource" ` +
        `references unknown item "${effect.itemId}".`,
    );
  }

  if (definition.origin !== "natural-resource") {
    throw new Error(
      `Event "${eventId}": effect "acquire-natural-resource" ` +
        `requires a natural-resource item, but "${effect.itemId}" is manufactured.`,
    );
  }
}

export function validateEffects(
  eventId: string,
  effects: readonly EventEffect[],
  roleIds: readonly string[],
  requiredItemRoleIds: readonly string[] = [],
): void {
  const knownRoleIds = new Set(roleIds);

  const rolesWithRequiredItems = new Set(requiredItemRoleIds);

  for (const effect of effects) {
    if (!knownRoleIds.has(effect.roleId)) {
      throw new Error(
        `Event "${eventId}": effect "${effect.type}" ` +
          `references unknown role "${effect.roleId}".`,
      );
    }

    if (isRequiredItemEffect(effect) && !rolesWithRequiredItems.has(effect.roleId)) {
      throw new Error(
        `Event "${eventId}": effect "${effect.type}" ` +
          `requires role "${effect.roleId}" to declare a required-item requirement.`,
      );
    }

    if (effect.type === "apply-status") {
      let definition: StatusDefinition;

      try {
        definition = getStatusDefinition(effect.statusId);
      } catch {
        throw new Error(
          `Event "${eventId}": effect "apply-status" ` +
            `references unknown status "${effect.statusId}".`,
        );
      }

      if (
        effect.durationRounds !== undefined &&
        (!Number.isInteger(effect.durationRounds) || effect.durationRounds <= 0)
      ) {
        throw new Error(
          `Event "${eventId}": effect "apply-status" ` + "uses an invalid duration override.",
        );
      }

      if (effect.durationRounds !== undefined && definition.duration.kind === "persistent") {
        throw new Error(
          `Event "${eventId}": persistent status ` +
            `"${definition.id}" cannot use a duration override.`,
        );
      }
    }

    if (effect.type === "acquire-natural-resource") {
      validateNaturalResourceEffect(eventId, effect);
    }

    if (effect.type === "eliminate") {
      if (effect.killerRoleId && !knownRoleIds.has(effect.killerRoleId)) {
        throw new Error(
          `Event "${eventId}": effect "eliminate" references unknown killer role "${effect.killerRoleId}".`,
        );
      }

      if (effect.killerRoleId === effect.roleId) {
        throw new Error(
          `Event "${eventId}": effect "eliminate" cannot use the same role as killer and victim.`,
        );
      }

      if (!effect.causeId.trim()) {
        throw new Error(
          `Event "${eventId}": effect "eliminate" must declare a non-empty cause ID.`,
        );
      }

      if (!effect.causeLabel.trim()) {
        throw new Error(
          `Event "${eventId}": effect "eliminate" must declare a non-empty cause label.`,
        );
      }
    }
  }
}

export function compileEffects(
  effects: readonly EventEffect[],
  context: EventResolutionContext,
  resolvedText?: string,
): GameChange[] {
  return effects.flatMap((effect): GameChange[] => {
    switch (effect.type) {
      case "survived": {
        const tribute = requireSingleParticipant(context.participantsByRole, effect.roleId);

        return createSurvivalChanges([tribute]);
      }

      case "apply-status": {
        const tribute = requireSingleParticipant(context.participantsByRole, effect.roleId);

        return [
          createStatusChange(
            context.eventId,
            tribute,
            effect.statusId,
            effect.severity,
            context.round,
            effect.durationRounds,
          ),
        ];
      }

      case "acquire-natural-resource": {
        const tribute = requireSingleParticipant(context.participantsByRole, effect.roleId);

        return [
          {
            type: "acquire-item",

            tributeId: tribute.id,
            acquisitionSource: "natural-foraging",

            item: createInventoryItemInstance(
              context.eventId,
              tribute.id,
              effect.itemId,
              context.round,
            ),
          },
        ];
      }

      case "eliminate": {
        if (resolvedText === undefined) {
          throw new Error(
            `Event "${context.eventId}": effect "eliminate" requires resolved event text for its death summary.`,
          );
        }

        const victim = requireSingleParticipant(context.participantsByRole, effect.roleId);

        const killer = effect.killerRoleId
          ? requireSingleParticipant(context.participantsByRole, effect.killerRoleId)
          : null;

        return createFatalChanges(victim, effect.causeId, effect.causeLabel, resolvedText, killer);
      }

      case "use-required-item":
      case "consume-required-item":
      case "apply-required-item-effects":
      case "apply-required-item-rest":
        return compileRequiredItemEffect(effect, context);
    }
  });
}
