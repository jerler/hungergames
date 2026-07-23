import type { ItemDefinitionId } from "~/game/items/item-schema";

import type { AcquireNaturalResourceEffect } from "./effect-schema";

export function acquireNaturalResource(
  roleId: string,
  itemId: ItemDefinitionId,
): AcquireNaturalResourceEffect {
  return {
    type: "acquire-natural-resource",
    roleId,
    itemId,
  };
}
