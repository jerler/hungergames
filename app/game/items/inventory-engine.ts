import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemDefinitionId, ItemTag } from "~/game/items/item-schema";
import type {
  GameState,
  GameTribute,
  InventoryItem,
  RoundReference,
} from "~/game/types/game-state";
import { isItemUsableBy } from "~/game/items/item-usability";

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
  //Set false for narrative ownership/access checks where the item will not actually be used.
  requireUsable?: boolean;
}

export interface AccessibleInventoryItem {
  owner: GameTribute;
  item: InventoryItem;
}

function itemMatchesRequirements(
  item: InventoryItem,
  actingTribute: GameTribute,
  requirements: InventoryItemRequirements,
): boolean {
  if (requirements.unavailableItemInstanceIds?.has(item.id)) {
    return false;
  }

  if (requirements.definitionIds && !requirements.definitionIds.includes(item.definitionId)) {
    return false;
  }

  const definition = getItemDefinition(item.definitionId);

  if (
    requirements.requiredTags &&
    !requirements.requiredTags.every((tag) => definition.tags.includes(tag))
  ) {
    return false;
  }

  const requireUsable = requirements.requireUsable ?? true;

  if (requireUsable && !isItemUsableBy(actingTribute, item)) {
    return false;
  }

  return true;
}

export function findUsableInventoryItem(
  tribute: GameTribute,
  requirements: InventoryItemRequirements,
): InventoryItem | null {
  const usableRequirements = {
    ...requirements,
    requireUsable: true,
  };

  return (
    tribute.inventory.find((item) => itemMatchesRequirements(item, tribute, usableRequirements)) ??
    null
  );
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
      itemMatchesRequirements(item, tribute, requirements)
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

  return Boolean(
    findAccessibleInventoryItem(state, tribute, {
      ...requirements,
      requireUsable: true,
    }),
  );
}

export function getInventoryBonus(
  tribute: GameTribute,
  bonus: "combatBonus" | "survivalBonus" | "awarenessBonus" | "foragingBonus",
): number {
  return tribute.inventory.reduce((total, item) => {
    if (!isItemUsableBy(tribute, item)) {
      return total;
    }

    return total + (getItemDefinition(item.definitionId)[bonus] ?? 0);
  }, 0);
}
