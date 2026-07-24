import { createItemUseChange, createStatusChange } from "~/game/events/event-change-builders";
import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemUseEffect, ItemUseNeed } from "~/game/items/item-schema";
import { getItemUsability } from "~/game/items/item-usability";
import { isMedicalStatusId } from "~/game/statuses/medical-statuses";
import type {
  GameChange,
  GameTribute,
  InventoryItem,
  RoundReference,
} from "~/game/types/game-state";
import type { SurvivalNeed } from "~/game/survival/survival-schema";

export interface CompileItemUseEffectsOptions {
  eventId: string;
  round: RoundReference;

  actingTribute: GameTribute;

  /**
   * The tribute who physically owns the item.
   *
   * This may differ from actingTribute when the item
   * is borrowed through a truce.
   */
  owner: GameTribute;

  item: InventoryItem;

  reason?: string;
}

function toSurvivalNeed(need: ItemUseNeed): SurvivalNeed {
  return need === "hydration" ? "water" : "food";
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

export function compileItemUseEffects({
  eventId,
  round,
  actingTribute,
  owner,
  item,
  reason = eventId,
}: CompileItemUseEffectsOptions): GameChange[] {
  const definition = getItemDefinition(item.definitionId);

  if (!definition.useEffects || definition.useEffects.length === 0) {
    throw new Error(`Item "${definition.id}" does not define active use effects.`);
  }

  requireUsableItem(actingTribute, item);

  const changes = compileStatusRemovalEffects(actingTribute, definition.useEffects);

  for (const effect of definition.useEffects) {
    switch (effect.type) {
      case "satisfy-need":
        changes.push({
          type: "satisfy-survival-need",
          tributeId: actingTribute.id,
          need: toSurvivalNeed(effect.need),
        });
        break;

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

      case "remove-status":
      case "remove-medical-statuses":
        /*
         * Removal effects were compiled together
         * above to prevent duplicate changes.
         */
        break;
    }
  }

  changes.push(createItemUseChange(owner, item, reason));

  return changes;
}
