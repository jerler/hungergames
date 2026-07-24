import type { StatusEffectId } from "~/game/statuses/status-schema";

export const MEDICAL_STATUS_IDS = [
  "injured",
  "bleeding",
  "poisoned",
  "burned",
] as const satisfies readonly StatusEffectId[];

export function isMedicalStatusId(statusId: StatusEffectId): boolean {
  return (MEDICAL_STATUS_IDS as readonly StatusEffectId[]).includes(statusId);
}
