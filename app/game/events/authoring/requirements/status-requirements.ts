import type { StatusEffectId } from "~/game/statuses/status-schema";

import type {
  DeprivationStatusEligibleRequirement,
  HasAnyHarmfulStatusRequirement,
  HasStatusRequirement,
  LacksStatusRequirement,
} from "./requirement-schema";

export function hasStatus(roleId: string, statusId: StatusEffectId): HasStatusRequirement {
  return {
    kind: "has-status",

    roleId,
    statusId,
  };
}

export function lacksStatus(roleId: string, statusId: StatusEffectId): LacksStatusRequirement {
  return {
    kind: "lacks-status",

    roleId,
    statusId,
  };
}

export function hasAnyHarmfulStatus(roleId: string): HasAnyHarmfulStatusRequirement {
  return {
    kind: "has-any-harmful-status",

    roleId,
  };
}

export function isHungerStatusEligible(roleId: string): DeprivationStatusEligibleRequirement {
  return {
    kind: "deprivation-status-eligible",
    roleId,
    need: "food",
  };
}

export function isThirstStatusEligible(roleId: string): DeprivationStatusEligibleRequirement {
  return {
    kind: "deprivation-status-eligible",
    roleId,
    need: "water",
  };
}
