import type { ParticipantRoleDefinition } from "~/game/events/event-schema";
import type { ItemDefinitionId, ItemTag } from "~/game/items/item-schema";

export type RoleWeight = NonNullable<ParticipantRoleDefinition["getWeight"]>;

export type RoleItemAccess = NonNullable<ParticipantRoleDefinition["itemAccess"]>;

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

  getWeight?: RoleWeight;
  opposesRoleIds: readonly string[];

  optionalItemDefinitionIds?: readonly ItemDefinitionId[];
  optionalItemTags?: readonly ItemTag[];
  optionalItemAccess?: RoleItemAccess;
}

export function createAuthoredRole(
  id: string,
  count: number,
  { getWeight, opposesRoleIds = [], optionalItem }: AuthoredRoleOptions = {},
): AuthoredRoleSpecification {
  return {
    id,
    count,

    getWeight,
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
