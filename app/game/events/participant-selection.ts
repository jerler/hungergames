import { selectWeightedItem, type RandomSource } from "~/game/engine/random";
import type {
  EventDefinition,
  EventItemSelection,
  EventItemsByRole,
  EventSelectionContext,
  ParticipantRoleDefinition,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { findAccessibleInventoryItem } from "~/game/items/inventory-engine";
import { areTributesInSameTruce } from "~/game/truces/truce-engine";
import type { GameTribute } from "~/game/types/game-state";

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

export interface ParticipantSelection {
  participantsByRole: ParticipantsByRole;
  participantTributeIds: string[];

  itemsByRole: EventItemsByRole;
  selectedItemInstanceIds: string[];
}

export function selectEventParticipants(
  definition: EventDefinition,
  context: EventSelectionContext,
  random: RandomSource,
  unavailableTributeIds: ReadonlySet<string>,
  unavailableItemInstanceIds: ReadonlySet<string> = new Set<string>(),
): ParticipantSelection | null {
  const selectedTributeIds = new Set(unavailableTributeIds);

  /*
   * Include items claimed by earlier events,
   * then add items selected within this event.
   */
  const reservedItemInstanceIds = new Set(unavailableItemInstanceIds);

  const participantsByRole: Record<string, GameTribute[]> = {};

  const itemsByRole: Record<string, EventItemSelection[]> = {};

  const selectedItemInstanceIds: string[] = [];

  for (const role of definition.roles) {
    const roleParticipants: GameTribute[] = [];
    const roleItems: EventItemSelection[] = [];

    /*
     * Assign these before selection so callbacks
     * may inspect participants already chosen for
     * this same role.
     */
    participantsByRole[role.id] = roleParticipants;

    itemsByRole[role.id] = roleItems;

    const roleContext = {
      ...context,
      participantsByRole,
    };

    for (let roleIndex = 0; roleIndex < role.count; roleIndex += 1) {
      const candidates = context.livingTributes.filter(
        (tribute) =>
          !selectedTributeIds.has(tribute.id) &&
          !isProtectedFromRoleByTruce(tribute, role, participantsByRole, context) &&
          (!roleRequiresItem(role) ||
            Boolean(
              findAccessibleInventoryItem(context.state, tribute, {
                definitionIds: role.requiredItemDefinitionIds,

                requiredTags: role.requiredItemTags,

                unavailableItemInstanceIds: reservedItemInstanceIds,
              }),
            )) &&
          (role.isEligible ? role.isEligible(tribute, roleContext) : true),
      );

      if (candidates.length === 0) {
        return null;
      }

      const selectedTribute = selectWeightedItem(
        candidates,

        (tribute) => role.getWeight?.(tribute, roleContext) ?? 1,

        random,
      );

      selectedTributeIds.add(selectedTribute.id);

      roleParticipants.push(selectedTribute);

      if (roleRequiresItem(role)) {
        const accessibleItem = findAccessibleInventoryItem(context.state, selectedTribute, {
          definitionIds: role.requiredItemDefinitionIds,

          requiredTags: role.requiredItemTags,

          unavailableItemInstanceIds: reservedItemInstanceIds,
        });

        if (!accessibleItem) {
          /*
           * This should be impossible because the
           * same requirement was checked while
           * building the candidate list.
           */
          return null;
        }

        roleItems.push({
          userTributeId: selectedTribute.id,

          owner: accessibleItem.owner,
          item: accessibleItem.item,
        });

        reservedItemInstanceIds.add(accessibleItem.item.id);

        selectedItemInstanceIds.push(accessibleItem.item.id);
      }
    }
  }

  const participantTributeIds = definition.roles.flatMap((role) =>
    participantsByRole[role.id].map((tribute) => tribute.id),
  );

  return {
    participantsByRole,
    participantTributeIds,
    itemsByRole,
    selectedItemInstanceIds,
  };
}
