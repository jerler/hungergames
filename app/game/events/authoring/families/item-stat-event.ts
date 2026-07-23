import {
  consumeRequiredItem,
  recordRequiredItemUse,
} from "~/game/events/authoring/effects/required-item-effects";
import type { StatCheckResults } from "~/game/events/authoring/outcomes/outcome-schema";
import { hasItem } from "~/game/events/authoring/requirements/item-requirements";
import type {
  AuthoredRequirement,
  RequiredItemAccess,
} from "~/game/events/authoring/requirements/requirement-schema";
import type { EventDefinition, EventTag } from "~/game/events/event-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemDefinitionId } from "~/game/items/item-schema";

import {
  appendEffectToStatOutcomes,
  STAT_OUTCOME_KEYS,
  type StatOutcomeKey,
} from "./family-outcomes";
import { createSoloStatEvent, type SoloStatEventOptions } from "./solo-stat-event";

export interface ItemStatEventOptions extends Omit<
  SoloStatEventOptions,
  "outcomes" | "requirements"
> {
  itemId: ItemDefinitionId;
  outcomes: StatCheckResults;

  access?: RequiredItemAccess;

  /**
   * Defaults to every outcome.
   */
  itemEffectOutcomes?: readonly StatOutcomeKey[];

  /**
   * Defaults to the event definition ID.
   */
  itemReason?: string;

  requirements?: readonly AuthoredRequirement[];
}

export function createItemStatEvent(
  id: string,
  {
    itemId,
    outcomes,

    access = "accessible",
    itemEffectOutcomes = STAT_OUTCOME_KEYS,
    itemReason = id,

    requirements = [],
    tags = [],

    ...metadata
  }: ItemStatEventOptions,
): EventDefinition {
  const roleId = metadata.roleId ?? "tribute";
  const itemDefinition = getItemDefinition(itemId);

  const itemEffect =
    itemDefinition.maxUses === undefined
      ? recordRequiredItemUse(roleId, { reason: itemReason })
      : consumeRequiredItem(roleId, { reason: itemReason });

  /*
   * Event authors may include "item" wherever it belongs
   * in the catalogue's preferred tag order. Add it only
   * when they omit it.
   */
  const itemTags: EventTag[] = tags.includes("item") ? [...tags] : ["item", ...tags];

  return createSoloStatEvent(id, {
    ...metadata,

    roleId,
    tags: itemTags,

    requirements: [
      hasItem(roleId, {
        definitionIds: [itemId],
        access,
      }),
      ...requirements,
    ],

    outcomes: appendEffectToStatOutcomes(outcomes, itemEffect, itemEffectOutcomes),
  });
}
