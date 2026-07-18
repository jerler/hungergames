import { getCombatSelectionWeight } from "~/game/engine/stat-formulas";
import type { ItemDefinitionId, ItemTag } from "~/game/items/item-schema";

import type { ParticipantRoleDefinition } from "./event-schema";

interface CombatantRoleOptions {
  id?: string;
  requiredItemDefinitionIds?: readonly ItemDefinitionId[];
  requiredItemTags?: readonly ItemTag[];
}

export function createCombatantRole({
  id = "killer",
  requiredItemDefinitionIds,
  requiredItemTags,
}: CombatantRoleOptions = {}): ParticipantRoleDefinition {
  return {
    id,
    count: 1,
    getWeight: getCombatSelectionWeight,
    requiredItemDefinitionIds,
    requiredItemTags,
  };
}
