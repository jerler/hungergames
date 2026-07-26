import type { EventResolutionContext } from "~/game/events/event-schema";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemAcquisitionSource, ItemDefinitionId } from "~/game/items/item-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { NightRestQuality } from "~/game/survival/survival-schema";
import type {
  GameChange,
  GameTribute,
  InventoryItem,
  RoundReference,
} from "~/game/types/game-state";

export function createSurvivalChanges(tributes: readonly GameTribute[]): GameChange[] {
  return tributes.map((tribute) => ({
    type: "increment-statistic",
    tributeId: tribute.id,
    statistic: "eventsSurvived",
    amount: 1,
  }));
}

export function createNightRestChanges(
  tributes: readonly GameTribute[],
  round: RoundReference,
  quality: NightRestQuality,
): GameChange[] {
  if (round.period !== "night") {
    throw new Error("Night rest can only be recorded during a night round.");
  }

  return tributes.map((tribute) => ({
    type: "record-night-rest",

    tributeId: tribute.id,

    round: {
      ...round,
    },

    quality,
  }));
}

export function createStatusChange(
  eventId: string,
  tribute: GameTribute,
  statusId: StatusEffectId,
  severity: 1 | 2 | 3,
  round: EventResolutionContext["round"],
  durationRounds?: number,
  sourceTributeId: string | null = null,
): GameChange {
  return {
    type: "apply-status",
    tributeId: tribute.id,

    status: createStatusEffectInstance(
      eventId,
      tribute.id,
      statusId,
      severity,
      round,
      durationRounds,
      sourceTributeId,
    ),
  };
}

/**
 * Creates item-acquisition changes and counts the event as
 * survived for the receiving tribute.
 *
 * Every new item must declare the mechanism through which
 * it entered the arena inventory system.
 */
export function createItemAcquisitionAndSurvivalChanges(
  eventId: string,
  tribute: GameTribute,
  itemIds: readonly ItemDefinitionId[],
  round: EventResolutionContext["round"],
  acquisitionSource: ItemAcquisitionSource,
  giftsReceived = 0,
): GameChange[] {
  const changes: GameChange[] = itemIds.map((itemId): GameChange => ({
    type: "acquire-item",

    tributeId: tribute.id,
    acquisitionSource,

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

export function createItemUseChange(
  itemOwner: GameTribute,
  item: InventoryItem,
  reason: string,
): GameChange {
  const sharedFields = {
    tributeId: itemOwner.id,
    itemInstanceId: item.id,
    reason,
  };

  if (item.usesRemaining === null) {
    return {
      type: "use-item",
      ...sharedFields,
    };
  }

  return {
    type: "consume-item",
    ...sharedFields,
    uses: 1,
  };
}

export function createEliminationChange(
  victim: GameTribute,
  causeId: string,
  causeLabel: string,
  summary: string,
  killerTributeIds: readonly string[] = [],
): GameChange {
  return {
    type: "eliminate-tribute",

    tributeId: victim.id,

    causeId,
    causeLabel,
    summary,

    killerTributeIds: [...killerTributeIds],
  };
}

export function createAttemptedKillChange(attacker: GameTribute): GameChange {
  return {
    type: "increment-statistic",

    tributeId: attacker.id,

    statistic: "attemptedKills",
    amount: 1,
  };
}

export function createKillCreditChange(killer: GameTribute): GameChange {
  return {
    type: "increment-statistic",

    tributeId: killer.id,

    statistic: "kills",
    amount: 1,
  };
}

export function createDeathLootChanges(victim: GameTribute, killer: GameTribute): GameChange[] {
  return victim.inventory.map((item): GameChange => ({
    type: "transfer-item",

    itemInstanceId: item.id,

    fromTributeId: victim.id,
    toTributeId: killer.id,

    reason: "death-loot",
  }));
}

export function createFatalChanges(
  victim: GameTribute,
  causeId: string,
  causeLabel: string,
  summary: string,
  killer: GameTribute | null = null,
): GameChange[] {
  const changes: GameChange[] = [
    createEliminationChange(victim, causeId, causeLabel, summary, killer ? [killer.id] : []),
  ];

  if (!killer) {
    return changes;
  }

  changes.push(
    createAttemptedKillChange(killer),

    createKillCreditChange(killer),

    ...createDeathLootChanges(victim, killer),
  );

  return changes;
}

/**
 * Creates a fatality caused by an earlier attributed action.
 *
 * The original attack already recorded attemptedKills, so
 * delayed resolution awards only the eventual kill.
 *
 * A dead attacker may still receive historical kill credit,
 * but cannot receive newly transferred inventory.
 */
export function createDelayedFatalChanges(
  victim: GameTribute,
  causeId: string,
  causeLabel: string,
  summary: string,
  killer: GameTribute | null,
): GameChange[] {
  const changes: GameChange[] = [
    createEliminationChange(victim, causeId, causeLabel, summary, killer ? [killer.id] : []),
  ];

  if (!killer) {
    return changes;
  }

  changes.push(createKillCreditChange(killer));

  if (killer.isAlive) {
    changes.push(...createDeathLootChanges(victim, killer));
  }

  return changes;
}
