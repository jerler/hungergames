import { describe, expect, it } from "vitest";

import { BLOODBATH_EVENT_CATALOGUE } from "~/game/events/catalogue/bloodbath";
import {
  CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS,
  CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS,
  CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS,
  CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS,
  CORNUCOPIA_PACK_ITEM_POOL,
} from "~/game/events/catalogue/bloodbath/cornucopia-item-pool";
import { EVENT_CATALOGUE } from "~/game/events/catalogue";
import type { EventDefinition } from "~/game/events/event-schema";
import { ITEM_CATALOGUE } from "~/game/items/item-catalogue";
import { ITEM_TAGS, type ItemDefinition } from "~/game/items/item-schema";
import { LEGACY_FOOD_WATER_ITEM_IDS } from "~/game/survival/survival-resource-schema";
import { STATUS_CATALOGUE } from "~/game/statuses/status-catalogue";

const RETIRED_ITEM_DEFINITION_IDS = [
  "food",
  "medicine",
  "rope",
  ...LEGACY_FOOD_WATER_ITEM_IDS,
] as const;

const RETIRED_STATUS_DEFINITION_IDS = ["exposed", "sick", "concealed"] as const;

const PLAYABLE_EVENT_CATALOGUE: readonly EventDefinition[] = [
  ...BLOODBATH_EVENT_CATALOGUE,
  ...EVENT_CATALOGUE,
];

function getReferencedStatusIds(definition: ItemDefinition): string[] {
  const statusIds: string[] = [];

  for (const effect of definition.useEffects ?? []) {
    switch (effect.type) {
      case "remove-medical-statuses":
        break;
      case "remove-status":
        statusIds.push(...effect.statusIds);
        break;
      case "grant-status":
      case "chance-to-grant-status":
        statusIds.push(effect.statusId);
        break;
    }
  }

  const restFailureStatusId = definition.rest?.check?.criticalFailureStatus?.statusId;

  if (restFailureStatusId) {
    statusIds.push(restFailureStatusId);
  }

  return statusIds;
}

function getEventItemDefinitionIds(): string[] {
  return PLAYABLE_EVENT_CATALOGUE.flatMap((definition) =>
    definition.roles.flatMap((role) => [
      ...(role.requiredItemDefinitionIds ?? []),
      ...(role.optionalItemDefinitionIds ?? []),
    ]),
  );
}

function getAcquisitionPoolItemIds(): string[] {
  return [
    ...CORNUCOPIA_PACK_ITEM_POOL.map((entry) => entry.itemId),
    ...CORNUCOPIA_EDGE_DIRECT_WEAPON_ITEM_IDS,
    ...CORNUCOPIA_HEAVY_DIRECT_WEAPON_ITEM_IDS,
    ...CORNUCOPIA_BRAINS_OFFENSE_ITEM_IDS,
    ...CORNUCOPIA_CONTESTED_DIRECT_WEAPON_ITEM_IDS,
  ];
}

describe("catalogue boundaries", () => {
  it("keeps food and water outside the item model", () => {
    const itemDefinitionIds = new Set<string>(ITEM_CATALOGUE.map((definition) => definition.id));

    for (const resourceId of LEGACY_FOOD_WATER_ITEM_IDS) {
      expect(itemDefinitionIds.has(resourceId)).toBe(false);
    }

    expect(ITEM_TAGS).not.toContain("food");
    expect(ITEM_TAGS).not.toContain("water");
    expect(ITEM_TAGS).toContain("medicine");
  });

  it("does not expose retired item definitions", () => {
    const itemDefinitionIds = new Set<string>(ITEM_CATALOGUE.map((definition) => definition.id));

    for (const retiredItemId of RETIRED_ITEM_DEFINITION_IDS) {
      expect(itemDefinitionIds.has(retiredItemId)).toBe(false);
    }
  });

  it("does not expose retired statuses", () => {
    const statusDefinitionIds = new Set<string>(
      STATUS_CATALOGUE.map((definition) => definition.id),
    );
    const itemStatusReferences = new Set(ITEM_CATALOGUE.flatMap(getReferencedStatusIds));

    for (const retiredStatusId of RETIRED_STATUS_DEFINITION_IDS) {
      expect(statusDefinitionIds.has(retiredStatusId)).toBe(false);
      expect(itemStatusReferences.has(retiredStatusId)).toBe(false);
    }
  });

  it("keeps retired items out of roles and acquisition pools", () => {
    const eventItemDefinitionIds = new Set(getEventItemDefinitionIds());
    const acquisitionPoolItemIds = new Set(getAcquisitionPoolItemIds());

    for (const retiredItemId of RETIRED_ITEM_DEFINITION_IDS) {
      expect(eventItemDefinitionIds.has(retiredItemId)).toBe(false);
      expect(acquisitionPoolItemIds.has(retiredItemId)).toBe(false);
    }
  });

  it("keeps ordinary defense out of contextual capabilities", () => {
    for (const definition of ITEM_CATALOGUE) {
      expect(
        Object.prototype.hasOwnProperty.call(definition.contextual ?? {}, "hostileDefenseBonus"),
      ).toBe(false);
    }
  });
});
