import {
  getCombatSelectionWeight,
  getForagingScore,
  getVulnerabilityWeight,
} from "~/game/engine/stat-formulas";

import {
  createAuthoredRole,
  type AuthoredRoleOptions,
  type AuthoredRoleSpecification,
  type RoleWeight,
} from "./role-schema";

function withDefaultWeight(
  options: AuthoredRoleOptions,
  defaultWeight: RoleWeight,
): AuthoredRoleOptions {
  return {
    ...options,

    getWeight: options.getWeight ?? defaultWeight,
  };
}

function withDefaultTargeting(
  options: AuthoredRoleOptions,
  targeting: NonNullable<AuthoredRoleOptions["targeting"]>,
): AuthoredRoleOptions {
  return {
    ...options,
    targeting: options.targeting ?? targeting,
  };
}

/**
 * A neutral single-participant role.
 *
 * Defaults to the familiar "tribute" role ID.
 */
export function soloRole(
  roleId = "tribute",
  options: AuthoredRoleOptions = {},
): AuthoredRoleSpecification {
  return createAuthoredRole(roleId, 1, options);
}

/**
 * A single role weighted toward tributes with a
 * stronger current foraging score.
 */
export function foragerRole(
  roleId = "forager",
  options: AuthoredRoleOptions = {},
): AuthoredRoleSpecification {
  return createAuthoredRole(
    roleId,
    1,

    withDefaultWeight(options, getForagingScore),
  );
}

/**
 * A single role weighted toward stronger combatants.
 *
 * Truce opposition is not assumed here because the
 * opposing role may have a different ID in each event.
 */
export function attackerRole(
  roleId = "attacker",
  options: AuthoredRoleOptions = {},
): AuthoredRoleSpecification {
  return createAuthoredRole(
    roleId,
    1,

    withDefaultWeight(options, getCombatSelectionWeight),
  );
}

/**
 * A single role weighted toward more vulnerable tributes.
 */
export function victimRole(
  roleId = "victim",
  options: AuthoredRoleOptions = {},
): AuthoredRoleSpecification {
  return createAuthoredRole(
    roleId,
    1,
    withDefaultTargeting(withDefaultWeight(options, getVulnerabilityWeight), "hostile"),
  );
}

/**
 * A vulnerable target who cannot be selected from the
 * same active truce as a participant in the opposing role.
 *
 * This compiles through `opposesRoleIds`, allowing the
 * existing participant selector to enforce the protection.
 */
export function opposedTargetRole(
  roleId = "target",
  opposingRoleId = "attacker",
  options: AuthoredRoleOptions = {},
): AuthoredRoleSpecification {
  const opposesRoleIds = [opposingRoleId, ...(options.opposesRoleIds ?? [])];

  return createAuthoredRole(
    roleId,
    1,
    withDefaultTargeting(
      withDefaultWeight(
        {
          ...options,
          opposesRoleIds: [...new Set(opposesRoleIds)],
        },
        getVulnerabilityWeight,
      ),
      "hostile",
    ),
  );
}

/**
 * A repeated same-role group.
 *
 * The existing participant selector expands the count
 * into sequential slots while preserving the shared
 * participantsByRole context.
 */
export function groupRole(
  roleId: string,
  count: number,
  options: AuthoredRoleOptions = {},
): AuthoredRoleSpecification {
  return createAuthoredRole(roleId, count, options);
}
