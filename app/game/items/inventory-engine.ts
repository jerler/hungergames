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
    usesRemaining: definition.maxUses ?? null,
    sourceEventId: eventId,
    acquiredRound: {
      ...round,
    },
  };
}

export interface InventoryItemRequirements {
  definitionIds?: readonly ItemDefinitionId[];
  requiredTags?: readonly ItemTag[];
  unavailableItemInstanceIds?: ReadonlySet<string>;
}

export interface AccessibleInventoryItem {
  owner: GameTribute;
  item: InventoryItem;
}

function itemHasRemainingUses(item: InventoryItem): boolean {
  return item.usesRemaining === null || item.usesRemaining > 0;
}

function itemMatchesRequirements(
  item: InventoryItem,
  requirements: InventoryItemRequirements,
): boolean {
  if (!itemHasRemainingUses(item)) {
    return false;
  }

  if (requirements.unavailableItemInstanceIds?.has(item.id)) {
    return false;
  }

  if (requirements.definitionIds && !requirements.definitionIds.includes(item.definitionId)) {
    return false;
  }

  const definition = getItemDefinition(item.definitionId);

  return requirements.requiredTags?.every((tag) => definition.tags.includes(tag)) ?? true;
}

export function findUsableInventoryItem(
  tribute: GameTribute,
  requirements: InventoryItemRequirements,
): InventoryItem | null {
  return tribute.inventory.find((item) => itemMatchesRequirements(item, requirements)) ?? null;
}

export function tributeHasUsableItem(
  tribute: GameTribute,
  requirements: InventoryItemRequirements,
): boolean {
  const hasDefinitionRequirement = (requirements.definitionIds?.length ?? 0) > 0;

  const hasTagRequirement = (requirements.requiredTags?.length ?? 0) > 0;

  if (!hasDefinitionRequirement && !hasTagRequirement) {
    return true;
  }

  return Boolean(findUsableInventoryItem(tribute, requirements));
}

function getAccessibleInventoryOwners(state: GameState, tribute: GameTribute): GameTribute[] {
  const truce = state.truces.find((candidate) => candidate.tributeIds.includes(tribute.id));

  if (!truce) {
    return [tribute];
  }

  const partners = truce.tributeIds.flatMap((tributeId) => {
    if (tributeId === tribute.id) {
      return [];
    }

    const partner = state.tributes.find(
      (candidate) => candidate.id === tributeId && candidate.isAlive,
    );

    return partner ? [partner] : [];
  });

  /*
   * Prefer the acting tribute's own item
   * when otherwise-equivalent items are
   * available within the truce.
   */
  return [tribute, ...partners];
}

export function getAccessibleInventoryItems(
  state: GameState,
  tribute: GameTribute,
  requirements: InventoryItemRequirements = {},
): AccessibleInventoryItem[] {
  return getAccessibleInventoryOwners(state, tribute).flatMap((owner) =>
    owner.inventory.flatMap((item) =>
      itemMatchesRequirements(item, requirements)
        ? [
            {
              owner,
              item,
            },
          ]
        : [],
    ),
  );
}

export function findAccessibleInventoryItem(
  state: GameState,
  tribute: GameTribute,
  requirements: InventoryItemRequirements,
): AccessibleInventoryItem | null {
  return getAccessibleInventoryItems(state, tribute, requirements)[0] ?? null;
}

export function tributeCanAccessUsableItem(
  state: GameState,
  tribute: GameTribute,
  requirements: InventoryItemRequirements,
): boolean {
  const hasDefinitionRequirement = (requirements.definitionIds?.length ?? 0) > 0;

  const hasTagRequirement = (requirements.requiredTags?.length ?? 0) > 0;

  if (!hasDefinitionRequirement && !hasTagRequirement) {
    return true;
  }

  return Boolean(findAccessibleInventoryItem(state, tribute, requirements));
}

export function getInventoryBonus(
  tribute: GameTribute,
  bonus: "combatBonus" | "survivalBonus" | "awarenessBonus" | "foragingBonus",
): number {
  return tribute.inventory.reduce((total, item) => {
    if (!itemHasRemainingUses(item)) {
      return total;
    }

    return total + (getItemDefinition(item.definitionId)[bonus] ?? 0);
  }, 0);
}

interface TreatmentCandidate extends AccessibleInventoryItem {
  status: StatusEffect;
  severityReduction: number;
  durationReduction: number;
  priority: number;
}

function findTreatmentCandidate(
  state: GameState,
  tribute: GameTribute,
  status: StatusEffect,
): TreatmentCandidate | null {
  const candidates = getAccessibleInventoryItems(state, tribute).flatMap(({ owner, item }) => {
    const definition = getItemDefinition(item.definitionId);

    const treatment = definition.treatments?.find(
      (candidate) => candidate.statusId === status.definitionId,
    );

    if (!treatment) {
      return [];
    }

    return [
      {
        owner,
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
      /*
       * Prefer the patient's own item when
       * the treatment quality is identical.
       */
      Number(second.owner.id === tribute.id) - Number(first.owner.id === tribute.id) ||
      first.item.id.localeCompare(second.item.id),
  );

  return candidates[0] ?? null;
}

export function prepareTributesForRound(state: GameState, round: RoundReference): GameState {
  let nextState: GameState = {
    ...state,

    tributes: state.tributes.map((tribute) => ({
      ...tribute,
      statuses: [...tribute.statuses],
      inventory: [...tribute.inventory],
    })),

    itemTransactions: [...state.itemTransactions],
  };

  for (const tributeSnapshot of state.tributes) {
    const tributeAtStart = nextState.tributes.find((tribute) => tribute.id === tributeSnapshot.id);

    if (!tributeAtStart || !tributeAtStart.isAlive) {
      continue;
    }

    const orderedStatusIds = [...tributeAtStart.statuses]
      .sort((first, second) => second.severity - first.severity)
      .map((status) => status.id);

    for (const statusId of orderedStatusIds) {
      const currentTribute = nextState.tributes.find(
        (tribute) => tribute.id === tributeSnapshot.id,
      );

      if (!currentTribute) {
        throw new Error(`Missing tribute "${tributeSnapshot.id}" during automatic treatment.`);
      }

      const currentStatus = currentTribute.statuses.find((status) => status.id === statusId);

      if (!currentStatus) {
        continue;
      }

      const treatment = findTreatmentCandidate(nextState, currentTribute, currentStatus);

      if (!treatment) {
        continue;
      }

      const nextSeverity = currentStatus.severity - treatment.severityReduction;

      const nextDuration = currentStatus.remainingRounds - treatment.durationReduction;

      const patientId = currentTribute.id;
      const itemOwnerId = treatment.owner.id;
      const itemInstanceId = treatment.item.id;

      const itemHasLimitedUses = treatment.item.usesRemaining !== null;
      const transaction: InventoryTransaction | null = itemHasLimitedUses
        ? {
            id: [
              "automatic-use",
              round.period,
              round.day,
              patientId,
              itemOwnerId,
              itemInstanceId,
              currentStatus.id,
            ].join(":"),

            type: "consumed",

            tributeId: itemOwnerId,
            itemInstanceId,
            definitionId: treatment.item.definitionId,
            uses: 1,

            round: {
              ...round,
            },

            sourceId: `automatic-treatment:${currentStatus.definitionId}`,
          }
        : null;

      nextState = {
        ...nextState,

        tributes: nextState.tributes.map((tribute) => {
          let updatedTribute = tribute;

          if (tribute.id === patientId) {
            updatedTribute = {
              ...updatedTribute,

              statuses:
                nextSeverity <= 0 || nextDuration <= 0
                  ? updatedTribute.statuses.filter((status) => status.id !== currentStatus.id)
                  : updatedTribute.statuses.map((status) =>
                      status.id === currentStatus.id
                        ? {
                            ...status,

                            severity: nextSeverity as 1 | 2 | 3,

                            remainingRounds: nextDuration,
                          }
                        : status,
                    ),
            };
          }

          if (tribute.id === itemOwnerId && itemHasLimitedUses) {
            updatedTribute = {
              ...updatedTribute,

              inventory: updatedTribute.inventory
                .map((item) => {
                  if (item.id !== itemInstanceId || item.usesRemaining === null) {
                    return item;
                  }

                  return {
                    ...item,
                    usesRemaining: item.usesRemaining - 1,
                  };
                })
                .filter((item) => item.usesRemaining === null || item.usesRemaining > 0),
            };
          }

          return updatedTribute;
        }),

        itemTransactions: transaction
          ? [...nextState.itemTransactions, transaction]
          : nextState.itemTransactions,
      };
    }
  }

  return nextState;
}
