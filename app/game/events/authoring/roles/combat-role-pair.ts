import { attackerRole, victimRole } from "./role-presets";
import type { AuthoredRoleOptions, AuthoredRoleSpecification } from "./role-schema";

export interface CombatRolePairOptions {
  killerRoleId?: string;
  victimRoleId?: string;

  killer?: AuthoredRoleOptions;
  victim?: AuthoredRoleOptions;
}

function withOpposition(options: AuthoredRoleOptions, opposingRoleId: string): AuthoredRoleOptions {
  return {
    ...options,

    opposesRoleIds: [...new Set([opposingRoleId, ...(options.opposesRoleIds ?? [])])],
  };
}

/**
 * Creates the standard ordinary-combat participant pair.
 *
 * The victim is authored first to preserve existing selection
 * order. Both roles explicitly oppose one another so active
 * truce partners cannot be selected against each other.
 */
export function combatRolePair({
  killerRoleId = "killer",
  victimRoleId = "victim",
  killer = {},
  victim = {},
}: CombatRolePairOptions = {}): readonly [AuthoredRoleSpecification, AuthoredRoleSpecification] {
  return [
    victimRole(victimRoleId, withOpposition(victim, killerRoleId)),

    attackerRole(killerRoleId, withOpposition(killer, victimRoleId)),
  ];
}
