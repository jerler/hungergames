import { selectWeightedItem, type RandomSource } from "~/game/engine/random";
import type {
  EventDefinition,
  EventItemSelection,
  EventItemsByRole,
  EventSelectionContext,
  ParticipantRoleDefinition,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import {
  getAccessibleInventoryItems,
  type AccessibleInventoryItem,
} from "~/game/items/inventory-engine";
import { areTributesInSameTruce } from "~/game/truces/truce-engine";
import type { GameTribute } from "~/game/types/game-state";
import { getHostileTargetingWeightMultiplier } from "~/game/statuses/hostile-targeting";
import { getHostileItemTargetWeightMultiplier } from "~/game/items/item-contextual-capabilities";

function isProtectedFromRoleByTruce(
  candidate: GameTribute,
  role: ParticipantRoleDefinition,
  participantsByRole: Readonly<Record<string, readonly GameTribute[]>>,
  context: EventSelectionContext,
): boolean {
  const opposingTributes = (role.opposesRoleIds ?? []).flatMap(
    (roleId) => participantsByRole[roleId] ?? [],
  );

  return opposingTributes.some((opposingTribute) =>
    areTributesInSameTruce(context.state, candidate.id, opposingTribute.id),
  );
}

function roleRequiresItem(role: ParticipantRoleDefinition): boolean {
  return (
    (role.requiredItemTags?.length ?? 0) > 0 || (role.requiredItemDefinitionIds?.length ?? 0) > 0
  );
}

function roleSelectsOptionalItem(role: ParticipantRoleDefinition): boolean {
  return (
    (role.optionalItemTags?.length ?? 0) > 0 || (role.optionalItemDefinitionIds?.length ?? 0) > 0
  );
}

function findAvailableRoleItem(
  context: EventSelectionContext,
  tribute: GameTribute,
  role: ParticipantRoleDefinition,
  reservedItemInstanceIds: ReadonlySet<string>,
  unavailableTributeIds: ReadonlySet<string>,
): AccessibleInventoryItem | null {
  const required = roleRequiresItem(role);

  const definitionIds = required ? role.requiredItemDefinitionIds : role.optionalItemDefinitionIds;

  const requirements = {
    definitionIds,

    requiredTags: required ? role.requiredItemTags : role.optionalItemTags,

    unavailableItemInstanceIds: reservedItemInstanceIds,

    requireUsable: required ? (role.requiredItemRequireUsable ?? true) : true,
  };

  const access = required ? role.itemAccess : role.optionalItemAccess;

  const candidates = getAccessibleInventoryItems(context.state, tribute, requirements).filter(
    ({ owner }) =>
      !unavailableTributeIds.has(owner.id) && (access !== "owned" || owner.id === tribute.id),
  );

  if (required || !definitionIds?.length) {
    return candidates[0] ?? null;
  }

  return (
    [...candidates].sort(
      (first, second) =>
        definitionIds.indexOf(first.item.definitionId) -
        definitionIds.indexOf(second.item.definitionId),
    )[0] ?? null
  );
}

export interface ParticipantSelection {
  participantsByRole: ParticipantsByRole;
  participantTributeIds: string[];

  itemsByRole: EventItemsByRole;
  selectedItemInstanceIds: string[];
}

interface ParticipantSelectionState {
  participantsByRole: Record<string, GameTribute[]>;

  itemsByRole: Record<string, EventItemSelection[]>;

  selectedTributeIds: Set<string>;

  reservedItemInstanceIds: Set<string>;

  selectedItemInstanceIds: string[];
}

interface RoleCandidate {
  tribute: GameTribute;

  accessibleItem: AccessibleInventoryItem | null;

  targetingWeightMultiplier: number;
}

/**
 * Selects a complete participant assignment for an event.
 *
 * Role candidates are selected using their configured weights.
 * When a selected candidate makes a later role impossible to
 * fill, the selector retries another candidate for the earlier
 * role before rejecting the event definition.
 */
export function selectEventParticipants(
  definition: EventDefinition,
  context: EventSelectionContext,
  random: RandomSource,
  unavailableTributeIds: ReadonlySet<string>,
  unavailableItemInstanceIds: ReadonlySet<string> = new Set<string>(),
): ParticipantSelection | null {
  /*
   * Expand role counts into sequential assignment slots.
   *
   * A role with count 3 therefore appears in three adjacent
   * slots while continuing to share one participantsByRole
   * collection.
   */
  const roleSlots = definition.roles.flatMap((role) =>
    Array.from(
      {
        length: role.count,
      },

      () => role,
    ),
  );

  function selectRoleSlot(
    slotIndex: number,
    state: ParticipantSelectionState,
  ): ParticipantSelection | null {
    if (slotIndex >= roleSlots.length) {
      const participantTributeIds = definition.roles.flatMap((role) =>
        (state.participantsByRole[role.id] ?? []).map((tribute) => tribute.id),
      );

      return {
        participantsByRole: state.participantsByRole,

        participantTributeIds,

        itemsByRole: state.itemsByRole,

        selectedItemInstanceIds: state.selectedItemInstanceIds,
      };
    }

    const role = roleSlots[slotIndex];

    /*
     * Make the current role visible to its callbacks before
     * selecting its next participant. This preserves the
     * existing same-role participant-context behaviour.
     */
    const participantsByRole =
      state.participantsByRole[role.id] === undefined
        ? {
            ...state.participantsByRole,

            [role.id]: [],
          }
        : state.participantsByRole;

    const itemsByRole =
      state.itemsByRole[role.id] === undefined
        ? {
            ...state.itemsByRole,

            [role.id]: [],
          }
        : state.itemsByRole;

    const roleContext = {
      ...context,
      participantsByRole,
    };

    const requiresItem = roleRequiresItem(role);
    const selectsOptionalItem = roleSelectsOptionalItem(role);
    const selectsItem = requiresItem || selectsOptionalItem;

    let remainingCandidates: RoleCandidate[] = context.livingTributes.flatMap(
      (tribute): RoleCandidate[] => {
        if (state.selectedTributeIds.has(tribute.id)) {
          return [];
        }

        if (isProtectedFromRoleByTruce(tribute, role, participantsByRole, context)) {
          return [];
        }

        const targetingWeightMultiplier =
          role.targeting === "hostile"
            ? getHostileTargetingWeightMultiplier(tribute) *
              getHostileItemTargetWeightMultiplier(tribute)
            : 1;

        if (targetingWeightMultiplier <= 0) {
          return [];
        }

        const accessibleItem = selectsItem
          ? findAvailableRoleItem(
              context,
              tribute,
              role,
              state.reservedItemInstanceIds,
              state.selectedTributeIds,
            )
          : null;

        if (requiresItem && !accessibleItem) {
          return [];
        }

        if (role.isEligible && !role.isEligible(tribute, roleContext)) {
          return [];
        }

        return [
          {
            tribute,
            accessibleItem,
            targetingWeightMultiplier,
          },
        ];
      },
    );

    while (remainingCandidates.length > 0) {
      const selectedCandidate = selectWeightedItem(
        remainingCandidates,
        ({ tribute, targetingWeightMultiplier }) =>
          (role.getWeight?.(tribute, roleContext) ?? 1) * targetingWeightMultiplier,
        random,
      );

      const {
        tribute: selectedTribute,

        accessibleItem,
      } = selectedCandidate;

      /*
       * Each attempted path receives its own reservation
       * state. Failed paths therefore cannot leak tribute
       * or item reservations into later retries.
       */
      const nextSelectedTributeIds = new Set(state.selectedTributeIds);

      nextSelectedTributeIds.add(selectedTribute.id);

      const nextReservedItemInstanceIds = new Set(state.reservedItemInstanceIds);

      const nextItemsByRole = {
        ...itemsByRole,

        [role.id]: [...(itemsByRole[role.id] ?? [])],
      };

      const nextSelectedItemInstanceIds = [...state.selectedItemInstanceIds];

      if (accessibleItem) {
        nextItemsByRole[role.id].push({
          userTributeId: selectedTribute.id,

          owner: accessibleItem.owner,

          item: accessibleItem.item,
        });

        /*
         * The physical owner may be a hidden truce partner.
         * Reserve them as part of this attempted branch.
         */
        nextSelectedTributeIds.add(accessibleItem.owner.id);

        nextReservedItemInstanceIds.add(accessibleItem.item.id);

        nextSelectedItemInstanceIds.push(accessibleItem.item.id);
      }

      const completedSelection = selectRoleSlot(
        slotIndex + 1,

        {
          participantsByRole: {
            ...participantsByRole,

            [role.id]: [...(participantsByRole[role.id] ?? []), selectedTribute],
          },

          itemsByRole: nextItemsByRole,

          selectedTributeIds: nextSelectedTributeIds,

          reservedItemInstanceIds: nextReservedItemInstanceIds,

          selectedItemInstanceIds: nextSelectedItemInstanceIds,
        },
      );

      if (completedSelection) {
        return completedSelection;
      }

      /*
       * This candidate led to an impossible later role.
       * Retry the current role without selecting the same
       * tribute again.
       */
      remainingCandidates = remainingCandidates.filter(
        ({ tribute }) => tribute.id !== selectedTribute.id,
      );
    }

    return null;
  }

  return selectRoleSlot(0, {
    participantsByRole: {},
    itemsByRole: {},

    selectedTributeIds: new Set(unavailableTributeIds),

    reservedItemInstanceIds: new Set(unavailableItemInstanceIds),

    selectedItemInstanceIds: [],
  });
}
