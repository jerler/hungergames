import type { EventTextContext } from "~/game/events/authoring/characters/event-text-context";
import { createEvent } from "~/game/events/authoring/builder/create-event";
import { acquireNaturalResource } from "~/game/events/authoring/effects/natural-resource-effects";
import { survived } from "~/game/events/authoring/effects/statistic-effects";
import { randomResult } from "~/game/events/authoring/outcomes/random-result";
import { result } from "~/game/events/authoring/outcomes/result";
import type { AuthoredRoleOptions } from "~/game/events/authoring/roles/role-schema";
import { foragerRole } from "~/game/events/authoring/roles/role-presets";
import { always } from "~/game/events/authoring/strategies/always";
import type { EventDefinition, EventTag } from "~/game/events/event-schema";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { RoundReference } from "~/game/types/game-state";

import { mergeEventTags } from "./family-types";

export type NaturalResourceEventText = (
  context: EventTextContext,
  itemId: ItemDefinitionId,
) => string;

export interface NaturalResourceEventOptions {
  resources: readonly ItemDefinitionId[];
  text: NaturalResourceEventText;

  periods?: readonly RoundReference["period"][];
  weight?: number;
  tags?: readonly EventTag[];
  roleOptions?: AuthoredRoleOptions;
}

export function createNaturalResourceEvent(
  id: string,
  {
    resources,
    text,
    periods = ["day"],
    weight = 8,
    tags = [],
    roleOptions = {},
  }: NaturalResourceEventOptions,
): EventDefinition {
  if (resources.length === 0) {
    throw new Error(`Natural-resource event "${id}" must declare at least one resource.`);
  }

  const results = resources.map((itemId) =>
    result({
      text: (context) => text(context, itemId),
      effects: [acquireNaturalResource("tribute", itemId), survived("tribute")],
    }),
  );

  const outcome = results.length === 1 ? results[0] : randomResult(...results);

  return createEvent(id)
    .roles(foragerRole("tribute", roleOptions))
    .category("survival")
    .tags(...mergeEventTags(["survival", "item", "resource"], tags))
    .during(...periods)
    .weight(weight)
    .resolve(always(outcome));
}
