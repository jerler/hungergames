import type { StatusEffectId } from "~/game/statuses/status-schema";

export interface SurvivedEffect {
  type: "survived";
  roleId: string;
}

export interface ApplyStatusEffect {
  type: "apply-status";
  roleId: string;
  statusId: StatusEffectId;
  severity: 1 | 2 | 3;
}

export type EventEffect = SurvivedEffect | ApplyStatusEffect;
