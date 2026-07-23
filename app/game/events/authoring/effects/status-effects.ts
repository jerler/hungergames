import type { StatusEffectId } from "~/game/statuses/status-schema";

import type { ApplyStatusEffect } from "./effect-schema";

export function applyStatus(
  roleId: string,
  statusId: StatusEffectId,
  severity: 1 | 2 | 3,
): ApplyStatusEffect {
  return {
    type: "apply-status",
    roleId,
    statusId,
    severity,
  };
}
