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

export type RequiredItemEffect = RecordRequiredItemUseEffect | ConsumeRequiredItemEffect;

export type EventEffect =
  SurvivedEffect | ApplyStatusEffect | AcquireNaturalResourceEffect | RequiredItemEffect;
