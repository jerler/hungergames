import type { ItemDefinitionId } from "~/game/items/item-schema";
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

  /**
   * Overrides the catalogue duration for this timed instance.
   */
  durationRounds?: number;
}

export interface ApplyRequiredItemEffectsEffect {
  type: "apply-required-item-effects";
  roleId: string;
  reason?: string;
}

export interface ApplyRequiredItemRestEffect {
  type: "apply-required-item-rest";
  roleId: string;
  reason?: string;
}

export interface AcquireNaturalResourceEffect {
  type: "acquire-natural-resource";
  roleId: string;

  itemId: ItemDefinitionId;
}

export interface RecordRequiredItemUseEffect {
  type: "use-required-item";
  roleId: string;

  /**
   * Defaults to the resolved event ID.
   */
  reason?: string;
}

export interface ConsumeRequiredItemEffect {
  type: "consume-required-item";
  roleId: string;

  /**
   * Defaults to the resolved event ID.
   */
  reason?: string;
}

export type RequiredItemEffect =
  | RecordRequiredItemUseEffect
  | ConsumeRequiredItemEffect
  | ApplyRequiredItemEffectsEffect
  | ApplyRequiredItemRestEffect;

export type EventEffect =
  | SurvivedEffect
  | ApplyStatusEffect
  | AcquireNaturalResourceEffect
  | RequiredItemEffect
  | EliminateEffect;

export interface EliminateEffect {
  type: "eliminate";

  /**
   * The role being eliminated.
   */
  roleId: string;

  /**
   * Omitted for environmental fatalities.
   */
  killerRoleId?: string;

  causeId: string;
  causeLabel: string;
}
