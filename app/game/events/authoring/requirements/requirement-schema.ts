import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { TributeStats, TributeStatValue } from "~/game/types/tribute";

export type RequirementStat = keyof TributeStats;

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

export interface InActiveTruceRequirement {
  kind: "in-active-truce";

  roleId: string;
}

export interface NotInSameTruceRequirement {
  kind: "not-in-same-truce";

  firstRoleId: string;
  secondRoleId: string;
}

export type StatusRequirement =
  HasStatusRequirement | LacksStatusRequirement | HasAnyHarmfulStatusRequirement;

export type StatRequirement = MinimumStatRequirement | MaximumStatRequirement;

export type RelationshipRequirement = InActiveTruceRequirement | NotInSameTruceRequirement;

export type AuthoredRequirement = StatusRequirement | StatRequirement | RelationshipRequirement;

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
      return [requirement.roleId];

    case "not-in-same-truce":
      return [requirement.firstRoleId, requirement.secondRoleId];
  }
}
