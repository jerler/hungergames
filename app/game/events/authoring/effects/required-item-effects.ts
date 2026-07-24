import type {
  ApplyRequiredItemEffectsEffect,
  ApplyRequiredItemRestEffect,
  ConsumeRequiredItemEffect,
  RecordRequiredItemUseEffect,
} from "./effect-schema";

export interface RequiredItemEffectOptions {
  /**
   * Reason recorded in the inventory transaction.
   *
   * Defaults to the resolved event ID when omitted.
   */
  reason?: string;
}

export function applyRequiredItemEffects(
  roleId: string,
  { reason }: RequiredItemEffectOptions = {},
): ApplyRequiredItemEffectsEffect {
  return {
    type: "apply-required-item-effects",
    roleId,

    ...(reason !== undefined
      ? {
          reason,
        }
      : {}),
  };
}

export function applyRequiredItemRest(
  roleId: string,
  { reason }: RequiredItemEffectOptions = {},
): ApplyRequiredItemRestEffect {
  return {
    type: "apply-required-item-rest",
    roleId,

    ...(reason !== undefined
      ? {
          reason,
        }
      : {}),
  };
}

export function recordRequiredItemUse(
  roleId: string,
  { reason }: RequiredItemEffectOptions = {},
): RecordRequiredItemUseEffect {
  return {
    type: "use-required-item",
    roleId,

    ...(reason !== undefined
      ? {
          reason,
        }
      : {}),
  };
}

export function consumeRequiredItem(
  roleId: string,
  { reason }: RequiredItemEffectOptions = {},
): ConsumeRequiredItemEffect {
  return {
    type: "consume-required-item",
    roleId,

    ...(reason !== undefined
      ? {
          reason,
        }
      : {}),
  };
}
