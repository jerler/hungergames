import { ITEM_CATALOGUE } from "~/game/items/item-catalogue";
import type { ItemDefinitionId, ItemTag } from "~/game/items/item-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import { isMedicalStatusId } from "~/game/statuses/medical-statuses";

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
  requireUsable?: boolean;
}

export interface HasItemTagOptions {
  tags: readonly ItemTag[];
  access?: RequiredItemAccess;
  requireUsable?: boolean;
}

export interface HasTreatmentForOptions {
  access?: RequiredItemAccess;
  requireUsable?: boolean;
}

export function hasItem(
  roleId: string,
  { definitionIds, access = "accessible", requireUsable = true }: HasItemOptions,
): HasItemRequirement {
  return {
    kind: "has-item",
    roleId,

    definitionIds: [...definitionIds],

    access,
    requireUsable,
  };
}

export function hasItemTag(
  roleId: string,
  { tags, access = "accessible", requireUsable = true }: HasItemTagOptions,
): HasItemTagRequirement {
  return {
    kind: "has-item-tag",
    roleId,

    tags: [...tags],

    access,
    requireUsable,
  };
}

export function hasTreatmentFor(
  roleId: string,
  statusId: StatusEffectId,
  { access = "accessible", requireUsable = true }: HasTreatmentForOptions = {},
): HasTreatmentForRequirement {
  return {
    kind: "has-treatment-for",
    roleId,
    statusId,
    access,
    requireUsable,
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
  return ITEM_CATALOGUE.flatMap((definition) => {
    const removesStatus =
      definition.useEffects?.some((effect) => {
        if (effect.type === "remove-status") {
          return effect.statusIds.includes(statusId);
        }

        if (effect.type === "remove-medical-statuses") {
          return isMedicalStatusId(statusId);
        }

        return false;
      }) ?? false;

    return removesStatus ? [definition.id] : [];
  });
}
