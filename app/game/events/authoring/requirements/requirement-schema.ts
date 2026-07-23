import type { ParticipantRoleDefinition } from "~/game/events/event-schema";
import type { ItemDefinitionId, ItemTag } from "~/game/items/item-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { TributeStats, TributeStatValue } from "~/game/types/tribute";

export type RequirementStat = keyof TributeStats;

export type RequiredItemAccess = NonNullable<ParticipantRoleDefinition["itemAccess"]>;

/* Status requirements */

export interface HasStatusRequirement {
  kind: "has-status";
  roleId: string;
  statusId: StatusEffectId;
}

export interface LacksStatusRequirement {
  kind: "lacks-status";
  roleId: string;
  statusId: StatusEffectId;
}

export interface HasAnyHarmfulStatusRequirement {
  kind: "has-any-harmful-status";
  roleId: string;
}

/* Stat requirements */

export interface MinimumStatRequirement {
  kind: "minimum-stat";
  roleId: string;
  stat: RequirementStat;
  value: TributeStatValue;
}

export interface MaximumStatRequirement {
  kind: "maximum-stat";
  roleId: string;
  stat: RequirementStat;
  value: TributeStatValue;
}

/* Relationship requirements */

export interface InActiveTruceRequirement {
  kind: "in-active-truce";
  roleId: string;
}

export interface NotInSameTruceRequirement {
  kind: "not-in-same-truce";
  firstRoleId: string;
  secondRoleId: string;
}

/* Required-item requirements */

interface ItemRequirementBase {
  roleId: string;
  access: RequiredItemAccess;
}

export interface HasItemRequirement extends ItemRequirementBase {
  kind: "has-item";

  definitionIds: readonly ItemDefinitionId[];
}

export interface HasItemTagRequirement extends ItemRequirementBase {
  kind: "has-item-tag";

  tags: readonly ItemTag[];
}

export interface HasTreatmentForRequirement extends ItemRequirementBase {
  kind: "has-treatment-for";

  statusId: StatusEffectId;
}

export type StatusRequirement =
  HasStatusRequirement | LacksStatusRequirement | HasAnyHarmfulStatusRequirement;

export type StatRequirement = MinimumStatRequirement | MaximumStatRequirement;

export type RelationshipRequirement = InActiveTruceRequirement | NotInSameTruceRequirement;

export type ItemRequirement =
  HasItemRequirement | HasItemTagRequirement | HasTreatmentForRequirement;

export type AuthoredRequirement =
  StatusRequirement | StatRequirement | RelationshipRequirement | ItemRequirement;

/**
 * Returns every role referenced by a requirement.
 *
 * Validation and compilation use this helper so role
 * reference handling remains centralized.
 */
export function getRequirementRoleIds(requirement: AuthoredRequirement): readonly string[] {
  switch (requirement.kind) {
    case "has-status":
    case "lacks-status":
    case "has-any-harmful-status":
    case "minimum-stat":
    case "maximum-stat":
    case "in-active-truce":
    case "has-item":
    case "has-item-tag":
    case "has-treatment-for":
      return [requirement.roleId];

    case "not-in-same-truce":
      return [requirement.firstRoleId, requirement.secondRoleId];
  }
}
