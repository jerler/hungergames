import type {
  ChanceToGrantStatusItemEffect,
  GrantStatusItemEffect,
  ItemUseEffect,
  RemoveMedicalStatusesItemEffect,
  RemoveStatusItemEffect,
} from "~/game/items/item-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";

export function itemMayGrantStatus(
  statusId: StatusEffectId,
  severity: 1 | 2 | 3,
  chance: number,
  durationRounds?: number,
): ChanceToGrantStatusItemEffect {
  return {
    type: "chance-to-grant-status",

    statusId,
    severity,
    chance,

    ...(durationRounds !== undefined
      ? {
          durationRounds,
        }
      : {}),
  };
}

export function itemRemovesStatuses(
  ...statusIds: readonly StatusEffectId[]
): RemoveStatusItemEffect {
  return {
    type: "remove-status",
    statusIds: [...statusIds],
  };
}

export function itemRemovesMedicalStatuses(): RemoveMedicalStatusesItemEffect {
  return {
    type: "remove-medical-statuses",
  };
}

export function itemGrantsStatus(
  statusId: StatusEffectId,
  severity: 1 | 2 | 3,
  durationRounds?: number,
): GrantStatusItemEffect {
  return {
    type: "grant-status",
    statusId,
    severity,

    ...(durationRounds !== undefined
      ? {
          durationRounds,
        }
      : {}),
  };
}

export function isItemUseEffect(value: unknown): value is ItemUseEffect {
  return typeof value === "object" && value !== null && "type" in value;
}
