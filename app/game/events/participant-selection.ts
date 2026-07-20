import type {
  EventDefinition,
  EventSelectionContext,
  ParticipantRoleDefinition,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { areTributesInSameTruce } from "~/game/truces/truce-engine";
import { selectWeightedItem, type RandomSource } from "~/game/engine/random";
import type { GameTribute } from "~/game/types/game-state";
import { tributeHasUsableItem } from "~/game/items/inventory-engine";

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

export interface ParticipantSelection {
  participantsByRole: ParticipantsByRole;
  participantTributeIds: string[];
}

export function selectEventParticipants(
  definition: EventDefinition,
  context: EventSelectionContext,
  random: RandomSource,
  unavailableTributeIds: ReadonlySet<string>,
): ParticipantSelection | null {
  const selectedTributeIds = new Set(unavailableTributeIds);

  const participantsByRole: Record<string, GameTribute[]> = {};

  for (const role of definition.roles) {
    const roleParticipants: GameTribute[] = [];

    /*
     * Assign this before selection so
     * callbacks can inspect participants
     * already chosen for this same role.
     */
    participantsByRole[role.id] = roleParticipants;

    const roleContext = {
      ...context,
      participantsByRole,
    };

    for (let roleIndex = 0; roleIndex < role.count; roleIndex += 1) {
      const candidates = context.livingTributes.filter(
        (tribute) =>
          !selectedTributeIds.has(tribute.id) &&
          !isProtectedFromRoleByTruce(tribute, role, participantsByRole, context) &&
          tributeHasUsableItem(tribute, {
            requiredTags: role.requiredItemTags,

            definitionIds: role.requiredItemDefinitionIds,
          }) &&
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
    }
  }

  const participantTributeIds = definition.roles.flatMap((role) =>
    participantsByRole[role.id].map((tribute) => tribute.id),
  );

  return {
    participantsByRole,
    participantTributeIds,
  };
}
