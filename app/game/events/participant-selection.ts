import type {
  EventDefinition,
  EventSelectionContext,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { selectWeightedItem, type RandomSource } from "~/game/engine/random";
import type { GameTribute } from "~/game/types/game-state";
import { tributeHasUsableItem } from "~/game/items/inventory-engine";

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

    for (let roleIndex = 0; roleIndex < role.count; roleIndex += 1) {
      const candidates = context.livingTributes.filter(
        (tribute) =>
          !selectedTributeIds.has(tribute.id) &&
          tributeHasUsableItem(tribute, {
            requiredTags: role.requiredItemTags,
            definitionIds: role.requiredItemDefinitionIds,
          }) &&
          (role.isEligible ? role.isEligible(tribute, context) : true),
      );

      if (candidates.length === 0) {
        return null;
      }

      const selectedTribute = selectWeightedItem(
        candidates,
        (tribute) => role.getWeight?.(tribute, context) ?? 1,
        random,
      );

      selectedTributeIds.add(selectedTribute.id);

      roleParticipants.push(selectedTribute);
    }

    participantsByRole[role.id] = roleParticipants;
  }

  const participantTributeIds = definition.roles.flatMap((role) =>
    participantsByRole[role.id].map((tribute) => tribute.id),
  );

  return {
    participantsByRole,
    participantTributeIds,
  };
}
