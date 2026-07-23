import type { TributeStatValue } from "~/game/types/tribute";

import type {
  MaximumStatRequirement,
  MinimumStatRequirement,
  RequirementStat,
} from "./requirement-schema";

export function minimumStat(
  roleId: string,
  stat: RequirementStat,
  value: TributeStatValue,
): MinimumStatRequirement {
  return {
    kind: "minimum-stat",

    roleId,
    stat,
    value,
  };
}

export function maximumStat(
  roleId: string,
  stat: RequirementStat,
  value: TributeStatValue,
): MaximumStatRequirement {
  return {
    kind: "maximum-stat",

    roleId,
    stat,
    value,
  };
}
