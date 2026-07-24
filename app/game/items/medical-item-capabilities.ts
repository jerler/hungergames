import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { isMedicalStatusId, MEDICAL_STATUS_IDS } from "~/game/statuses/medical-statuses";
import type { StatusEffectId } from "~/game/statuses/status-schema";

export function getMedicalStatusIdsTreatedByItem(itemId: ItemDefinitionId): StatusEffectId[] {
  const definition = getItemDefinition(itemId);

  const treatedStatusIds = new Set<StatusEffectId>();

  for (const effect of definition.useEffects ?? []) {
    if (effect.type === "remove-medical-statuses") {
      for (const statusId of MEDICAL_STATUS_IDS) {
        treatedStatusIds.add(statusId);
      }

      continue;
    }

    if (effect.type !== "remove-status") {
      continue;
    }

    for (const statusId of effect.statusIds) {
      if (isMedicalStatusId(statusId)) {
        treatedStatusIds.add(statusId);
      }
    }
  }

  return [...treatedStatusIds];
}
