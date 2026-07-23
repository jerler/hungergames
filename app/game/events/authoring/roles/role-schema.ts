import type { ParticipantRoleDefinition } from "~/game/events/event-schema";

export type RoleWeight = NonNullable<ParticipantRoleDefinition["getWeight"]>;

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
}

export interface AuthoredRoleSpecification {
  id: string;
  count: number;

  getWeight?: RoleWeight;
  opposesRoleIds: readonly string[];
}

export function createAuthoredRole(
  id: string,
  count: number,
  { getWeight, opposesRoleIds = [] }: AuthoredRoleOptions = {},
): AuthoredRoleSpecification {
  return {
    id,
    count,

    getWeight,

    opposesRoleIds: [...opposesRoleIds],
  };
}
