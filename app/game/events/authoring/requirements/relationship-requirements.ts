import type { InActiveTruceRequirement, NotInSameTruceRequirement } from "./requirement-schema";

export function inActiveTruce(roleId: string): InActiveTruceRequirement {
  return {
    kind: "in-active-truce",

    roleId,
  };
}

/**
 * Prevents participants in two roles from belonging
 * to the same active truce.
 *
 * During compilation this will be translated into the
 * existing `opposesRoleIds` mechanism rather than an
 * additional truce eligibility callback.
 */
export function notInSameTruce(
  firstRoleId: string,
  secondRoleId: string,
): NotInSameTruceRequirement {
  return {
    kind: "not-in-same-truce",

    firstRoleId,
    secondRoleId,
  };
}
