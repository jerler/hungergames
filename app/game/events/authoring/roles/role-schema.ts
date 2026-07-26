import type { ParticipantRoleDefinition } from "~/game/events/event-schema";
import type { ItemDefinitionId, ItemTag } from "~/game/items/item-schema";

export type RoleWeight = NonNullable<ParticipantRoleDefinition["getWeight"]>;
export type RoleEligibility = NonNullable<ParticipantRoleDefinition["isEligible"]>;

export type RoleItemAccess = NonNullable<ParticipantRoleDefinition["itemAccess"]>;

export type RoleTargeting = NonNullable<ParticipantRoleDefinition["targeting"]>;

export interface AuthoredOptionalItemSelection {
  definitionIds?: readonly ItemDefinitionId[];
  tags?: readonly ItemTag[];
  access?: RoleItemAccess;
}

export interface AuthoredRoleOptions {
  /**
   * Controls the relative likelihood that an eligible
   * tribute will be selected for this role.
   */
  getWeight?: RoleWeight;

  /**
   * Applies candidate-specific eligibility that cannot be
   * expressed by a declarative authored requirement alone.
   */
  isEligible?: RoleEligibility;

  /**
   * Marks this participant as the target of
   * ordinary hostile action.
   *
   * Omitted roles are neutral.
   */
  targeting?: RoleTargeting;

  /**
   * Tributes selected for these roles cannot be active
   * truce partners with a candidate for this role.
   */
  opposesRoleIds?: readonly string[];

  /**
   * Selects and reserves a matching item when available,
   * without making that item an eligibility requirement.
   */
  optionalItem?: AuthoredOptionalItemSelection;
}

export interface AuthoredRoleSpecification {
  id: string;
  count: number;
  targeting?: RoleTargeting;

  getWeight?: RoleWeight;
  isEligible?: RoleEligibility;
  opposesRoleIds: readonly string[];

  optionalItemDefinitionIds?: readonly ItemDefinitionId[];
  optionalItemTags?: readonly ItemTag[];
  optionalItemAccess?: RoleItemAccess;
}

export function createAuthoredRole(
  id: string,
  count: number,
  { getWeight, isEligible, opposesRoleIds = [], optionalItem, targeting }: AuthoredRoleOptions = {},
): AuthoredRoleSpecification {
  return {
    id,
    count,

    ...(targeting
      ? {
          targeting,
        }
      : {}),

    getWeight,
    isEligible,
    opposesRoleIds: [...opposesRoleIds],

    ...(optionalItem
      ? {
          optionalItemDefinitionIds: optionalItem.definitionIds
            ? [...optionalItem.definitionIds]
            : undefined,

          optionalItemTags: optionalItem.tags ? [...optionalItem.tags] : undefined,

          optionalItemAccess: optionalItem.access ?? "accessible",
        }
      : {}),
  };
}
