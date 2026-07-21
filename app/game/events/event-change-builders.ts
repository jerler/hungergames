import type { EventResolutionContext } from "~/game/events/event-schema";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { GameChange, GameTribute, InventoryItem } from "~/game/types/game-state";

export function createSurvivalChanges(tributes: readonly GameTribute[]): GameChange[] {
  return tributes.map((tribute) => ({
    type: "increment-statistic",
    tributeId: tribute.id,
    statistic: "eventsSurvived",
    amount: 1,
  }));
}

export function createStatusChange(
  eventId: string,
  tribute: GameTribute,
  statusId: StatusEffectId,
  severity: 1 | 2 | 3,
  round: EventResolutionContext["round"],
): GameChange {
  return {
    type: "apply-status",
    tributeId: tribute.id,

    status: createStatusEffectInstance(eventId, tribute.id, statusId, severity, round),
  };
}

/**
 * Creates item-acquisition changes and counts the event as
 * survived for the receiving tribute.
 *
 * Pass `giftsReceived` when the acquired items came from sponsors.
 */
export function createItemAcquisitionAndSurvivalChanges(
  eventId: string,
  tribute: GameTribute,
  itemIds: readonly ItemDefinitionId[],
  round: EventResolutionContext["round"],
  giftsReceived = 0,
): GameChange[] {
  const changes: GameChange[] = itemIds.map((itemId): GameChange => ({
    type: "acquire-item",
    tributeId: tribute.id,

    item: createInventoryItemInstance(eventId, tribute.id, itemId, round),
  }));

  if (giftsReceived > 0) {
    changes.push({
      type: "increment-statistic",
      tributeId: tribute.id,
      statistic: "giftsReceived",
      amount: giftsReceived,
    });
  }

  changes.push(...createSurvivalChanges([tribute]));

  return changes;
}

export function createItemConsumptionChange(
  itemOwner: GameTribute,
  item: InventoryItem,
  reason: string,
): GameChange {
  return {
    type: "consume-item",

    /*
     * consume-item targets the physical owner,
     * even when another truce member used it.
     */
    tributeId: itemOwner.id,

    itemInstanceId: item.id,
    uses: 1,
    reason,
  };
}

export function createFatalChanges(
  victim: GameTribute,
  causeId: string,
  causeLabel: string,
  summary: string,
  killer: GameTribute | null = null,
): GameChange[] {
  const changes: GameChange[] = [
    {
      type: "eliminate-tribute",
      tributeId: victim.id,
      causeId,
      causeLabel,
      summary,
      killerTributeIds: killer ? [killer.id] : [],
    },
  ];

  if (killer) {
    changes.push(
      {
        type: "increment-statistic",
        tributeId: killer.id,
        statistic: "attemptedKills",
        amount: 1,
      },
      {
        type: "increment-statistic",
        tributeId: killer.id,
        statistic: "kills",
        amount: 1,
      },
    );
  }

  return changes;
}
