import { ITEM_CATALOGUE } from "~/game/items/item-catalogue";
import type { ItemDefinitionId, ItemTag } from "~/game/items/item-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";

import type {
  AuthoredRequirement,
  HasItemRequirement,
  HasItemTagRequirement,
  HasTreatmentForRequirement,
  ItemRequirement,
  RequiredItemAccess,
} from "./requirement-schema";

export interface HasItemOptions {
  definitionIds: readonly ItemDefinitionId[];
  access?: RequiredItemAccess;
}

export interface HasItemTagOptions {
  tags: readonly ItemTag[];
  access?: RequiredItemAccess;
}

export interface HasTreatmentForOptions {
  access?: RequiredItemAccess;
}

export function hasItem(
  roleId: string,
  { definitionIds, access = "accessible" }: HasItemOptions,
): HasItemRequirement {
  return {
    kind: "has-item",
    roleId,

    definitionIds: [...definitionIds],

    access,
  };
}

export function hasItemTag(
  roleId: string,
  { tags, access = "accessible" }: HasItemTagOptions,
): HasItemTagRequirement {
  return {
    kind: "has-item-tag",
    roleId,

    tags: [...tags],

    access,
  };
}

export function hasTreatmentFor(
  roleId: string,
  statusId: StatusEffectId,
  { access = "accessible" }: HasTreatmentForOptions = {},
): HasTreatmentForRequirement {
  return {
    kind: "has-treatment-for",
    roleId,
    statusId,
    access,
  };
}

export function isItemRequirement(
  requirement: AuthoredRequirement,
): requirement is ItemRequirement {
  return (
    requirement.kind === "has-item" ||
    requirement.kind === "has-item-tag" ||
    requirement.kind === "has-treatment-for"
  );
}

export function getTreatmentItemDefinitionIds(statusId: StatusEffectId): ItemDefinitionId[] {
  return ITEM_CATALOGUE.flatMap((definition) =>
    definition.treatments?.some((treatment) => treatment.statusId === statusId)
      ? [definition.id]
      : [],
  );
}
