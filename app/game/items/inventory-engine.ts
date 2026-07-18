import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemDefinitionId, ItemTag } from "~/game/items/item-schema";
import type {
  GameState,
  GameTribute,
  InventoryItem,
  InventoryTransaction,
  RoundReference,
  StatusEffect,
} from "~/game/types/game-state";

export function createInventoryItemInstance(
  eventId: string,
  tributeId: string,
  definitionId: ItemDefinitionId,
  round: RoundReference,
): InventoryItem {
  const definition = getItemDefinition(definitionId);

  return {
    id: `${eventId}:${tributeId}:${definitionId}`,
    definitionId,
    usesRemaining: definition.maxUses,
    sourceEventId: eventId,
    acquiredRound: {
      ...round,
    },
  };
}

export function findUsableInventoryItem(
  tribute: GameTribute,
  options: {
    definitionIds?: readonly ItemDefinitionId[];
    requiredTags?: readonly ItemTag[];
  },
): InventoryItem | null {
  return (
    tribute.inventory.find((item) => {
      if (item.usesRemaining <= 0) {
        return false;
      }

      const definition = getItemDefinition(item.definitionId);

      if (options.definitionIds && !options.definitionIds.includes(item.definitionId)) {
        return false;
      }

      return options.requiredTags?.every((tag) => definition.tags.includes(tag)) ?? true;
    }) ?? null
  );
}

export function tributeHasUsableItem(
  tribute: GameTribute,
  options: {
    definitionIds?: readonly ItemDefinitionId[];
    requiredTags?: readonly ItemTag[];
  },
): boolean {
  const hasDefinitionRequirement = (options.definitionIds?.length ?? 0) > 0;

  const hasTagRequirement = (options.requiredTags?.length ?? 0) > 0;

  if (!hasDefinitionRequirement && !hasTagRequirement) {
    return true;
  }

  return Boolean(findUsableInventoryItem(tribute, options));
}

export function getInventoryBonus(
  tribute: GameTribute,
  bonus: "combatBonus" | "survivalBonus" | "awarenessBonus" | "foragingBonus",
): number {
  return tribute.inventory.reduce((total, item) => {
    if (item.usesRemaining <= 0) {
      return total;
    }

    return total + (getItemDefinition(item.definitionId)[bonus] ?? 0);
  }, 0);
}

interface TreatmentCandidate {
  item: InventoryItem;
  status: StatusEffect;
  severityReduction: number;
  durationReduction: number;
  priority: number;
}

function findTreatmentCandidate(
  tribute: GameTribute,
  status: StatusEffect,
): TreatmentCandidate | null {
  const candidates = tribute.inventory.flatMap((item) => {
    if (item.usesRemaining <= 0) {
      return [];
    }

    const definition = getItemDefinition(item.definitionId);

    const treatment = definition.treatments?.find(
      (candidate) => candidate.statusId === status.definitionId,
    );

    if (!treatment) {
      return [];
    }

    return [
      {
        item,
        status,
        ...treatment,
      },
    ];
  });

  candidates.sort(
    (first, second) =>
      second.priority - first.priority ||
      second.severityReduction - first.severityReduction ||
      first.item.id.localeCompare(second.item.id),
  );

  return candidates[0] ?? null;
}

export function prepareTributesForRound(state: GameState, round: RoundReference): GameState {
  const itemTransactions = [...state.itemTransactions];

  const tributes = state.tributes.map((tribute) => {
    if (!tribute.isAlive) {
      return tribute;
    }

    let statuses = [...tribute.statuses];

    let inventory = [...tribute.inventory];

    const orderedStatuses = [...statuses].sort((first, second) => second.severity - first.severity);

    for (const statusSnapshot of orderedStatuses) {
      const currentStatus = statuses.find((status) => status.id === statusSnapshot.id);

      if (!currentStatus) {
        continue;
      }

      const currentTribute = {
        ...tribute,
        statuses,
        inventory,
      };

      const treatment = findTreatmentCandidate(currentTribute, currentStatus);

      if (!treatment) {
        continue;
      }

      const nextSeverity = currentStatus.severity - treatment.severityReduction;

      const nextDuration = currentStatus.remainingRounds - treatment.durationReduction;

      if (nextSeverity <= 0 || nextDuration <= 0) {
        statuses = statuses.filter((status) => status.id !== currentStatus.id);
      } else {
        statuses = statuses.map((status) =>
          status.id === currentStatus.id
            ? {
                ...status,
                severity: nextSeverity as 1 | 2 | 3,
                remainingRounds: nextDuration,
              }
            : status,
        );
      }

      inventory = inventory
        .map((item) =>
          item.id === treatment.item.id
            ? {
                ...item,
                usesRemaining: item.usesRemaining - 1,
              }
            : item,
        )
        .filter((item) => item.usesRemaining > 0);

      const transaction: InventoryTransaction = {
        id: [
          "automatic-use",
          round.period,
          round.day,
          tribute.id,
          treatment.item.id,
          currentStatus.id,
        ].join(":"),

        type: "consumed",
        tributeId: tribute.id,
        itemInstanceId: treatment.item.id,
        definitionId: treatment.item.definitionId,
        uses: 1,
        round: {
          ...round,
        },
        sourceId: `automatic-treatment:${currentStatus.definitionId}`,
      };

      itemTransactions.push(transaction);
    }

    return {
      ...tribute,
      statuses,
      inventory,
    };
  });

  return {
    ...state,
    tributes,
    itemTransactions,
  };
}
