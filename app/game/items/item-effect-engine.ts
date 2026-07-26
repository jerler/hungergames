import { createItemUseChange, createStatusChange } from "~/game/events/event-change-builders";
import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemUseEffect } from "~/game/items/item-schema";
import { getItemUsability } from "~/game/items/item-usability";
import { isMedicalStatusId } from "~/game/statuses/medical-statuses";
import type {
  GameChange,
  GameTribute,
  InventoryItem,
  RoundReference,
} from "~/game/types/game-state";
import type { RandomSource } from "~/game/engine/random";

export interface CompileItemUseEffectsOptions {
  eventId: string;
  round: RoundReference;

  actingTribute: GameTribute;
  owner: GameTribute;
  item: InventoryItem;

  /**
   * Required only when an effect contains a
   * probabilistic outcome.
   */
  random?: RandomSource;

  reason?: string;
}

function requireUsableItem(actingTribute: GameTribute, item: InventoryItem): void {
  const usability = getItemUsability(actingTribute, item);

  if (usability.usable) {
    return;
  }

  throw new Error(
    `${actingTribute.snapshot.name} cannot use ` +
      `"${item.definitionId}": ` +
      usability.reasons.join(" "),
  );
}

function compileStatusRemovalEffects(
  actingTribute: GameTribute,
  effects: readonly ItemUseEffect[],
): GameChange[] {
  const removedStatusInstanceIds = new Set<string>();

  for (const effect of effects) {
    if (effect.type === "remove-status") {
      for (const status of actingTribute.statuses) {
        if (effect.statusIds.includes(status.definitionId)) {
          removedStatusInstanceIds.add(status.id);
        }
      }
    }

    if (effect.type === "remove-medical-statuses") {
      for (const status of actingTribute.statuses) {
        if (isMedicalStatusId(status.definitionId)) {
          removedStatusInstanceIds.add(status.id);
        }
      }
    }
  }

  return [...removedStatusInstanceIds].map((statusId): GameChange => ({
    type: "remove-status",
    tributeId: actingTribute.id,
    statusId,
  }));
}

export function compileItemUseEffects(options: CompileItemUseEffectsOptions): GameChange[] {
  const definition = getItemDefinition(options.item.definitionId);

  if (!definition.useEffects || definition.useEffects.length === 0) {
    throw new Error(`Item "${definition.id}" does not define active use effects.`);
  }

  requireUsableItem(options.actingTribute, options.item);

  return compileItemUseEffectChanges({
    ...options,
    effects: definition.useEffects,
  });
}

export function compileItemUseEffectChanges({
  eventId,
  round,
  actingTribute,
  owner,
  item,
  random,
  reason = eventId,
  effects,
}: CompileExplicitItemUseEffectsOptions): GameChange[] {
  const changes = compileStatusRemovalEffects(actingTribute, effects);

  for (const effect of effects) {
    switch (effect.type) {
      case "grant-status":
        changes.push(
          createStatusChange(
            eventId,
            actingTribute,
            effect.statusId,
            effect.severity,
            round,
            effect.durationRounds,
          ),
        );

        break;

      case "chance-to-grant-status": {
        if (!random) {
          throw new Error(
            `Item "${item.definitionId}" requires a random source ` +
              `to resolve chance-based status "${effect.statusId}".`,
          );
        }

        if (random() >= effect.chance) {
          break;
        }

        changes.push(
          createStatusChange(
            eventId,
            actingTribute,
            effect.statusId,
            effect.severity,
            round,
            effect.durationRounds,
          ),
        );

        break;
      }
      case "remove-status":
      case "remove-medical-statuses":
        break;
    }
  }

  changes.push(createItemUseChange(owner, item, reason));

  return changes;
}

export interface CompileExplicitItemUseEffectsOptions extends CompileItemUseEffectsOptions {
  effects: readonly ItemUseEffect[];
}
