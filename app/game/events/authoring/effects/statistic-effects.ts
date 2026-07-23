import type { SurvivedEffect } from "./effect-schema";

export function survived(roleId: string): SurvivedEffect {
  return {
    type: "survived",
    roleId,
  };
}
