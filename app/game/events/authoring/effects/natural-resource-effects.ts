import type { PersistentNaturalResourceItemId } from "~/game/items/item-schema";

import type { AcquirePersistentNaturalResourceEffect } from "./effect-schema";

export function acquirePersistentNaturalResource(
  roleId: string,
  itemId: PersistentNaturalResourceItemId,
): AcquirePersistentNaturalResourceEffect {
  return {
    type: "acquire-natural-resource",
    roleId,
    itemId,
  };
}
