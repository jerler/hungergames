import { getItemDefinition } from "~/game/items/item-catalogue";

import {
  getAccessibleInventoryItems,
  type AccessibleInventoryItem,
} from "~/game/items/inventory-engine";

import { getMedicalStatusIdsTreatedByItem } from "~/game/items/medical-item-capabilities";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import { isMedicalStatusId, MEDICAL_STATUS_IDS } from "~/game/statuses/medical-statuses";

import { getStatusDefinition } from "~/game/statuses/status-catalogue";

import type { StatusEffectId } from "~/game/statuses/status-schema";

import type { GameState, GameTribute, StatusEffect } from "~/game/types/game-state";

export interface MedicalTreatmentPlan {
  /**
   * The highest-priority status that caused
   * this treatment to be selected.
   */
  targetStatus: StatusEffect;

  /**
   * The selected item and its physical owner.
   */
  selection: AccessibleInventoryItem;

  /**
   * Every status definition the selected item
   * will actually remove from this patient.
   */
  treatedStatusIds: StatusEffectId[];
}

function isFatalMedicalStatus(status: StatusEffect): boolean {
  const definition = getStatusDefinition(status.definitionId);

  return definition.duration.kind === "timed" && definition.duration.expiration === "fatal";
}

/**
 * Lower values are more urgent.
 *
 * 0: fatal next round
 * 1: fatal later
 * 2: nonfatal medical condition
 */
function getMedicalUrgencyBand(status: StatusEffect): number {
  if (!isFatalMedicalStatus(status)) {
    return 2;
  }

  return status.remainingRounds !== null && status.remainingRounds <= 1 ? 0 : 1;
}

function compareMedicalStatuses(first: StatusEffect, second: StatusEffect): number {
  const firstUrgency = getMedicalUrgencyBand(first);

  const secondUrgency = getMedicalUrgencyBand(second);

  if (firstUrgency !== secondUrgency) {
    return firstUrgency - secondUrgency;
  }

  /*
   * Fatal conditions become more urgent
   * as their remaining duration decreases.
   */
  if (firstUrgency <= 1 && secondUrgency <= 1) {
    const firstRemaining = first.remainingRounds ?? Number.POSITIVE_INFINITY;

    const secondRemaining = second.remainingRounds ?? Number.POSITIVE_INFINITY;

    if (firstRemaining !== secondRemaining) {
      return firstRemaining - secondRemaining;
    }
  }

  /*
   * Severity is the primary distinction
   * among otherwise comparable statuses.
   */
  if (first.severity !== second.severity) {
    return second.severity - first.severity;
  }

  /*
   * For recoverable conditions, a status
   * with longer remaining duration is a
   * better use of scarce medicine.
   */
  if (firstUrgency === 2 && secondUrgency === 2) {
    const firstRemaining = first.remainingRounds ?? 0;

    const secondRemaining = second.remainingRounds ?? 0;

    if (firstRemaining !== secondRemaining) {
      return secondRemaining - firstRemaining;
    }
  }

  return first.definitionId.localeCompare(second.definitionId) || first.id.localeCompare(second.id);
}

function getMedicalFallbackRank(itemId: ItemDefinitionId): number {
  return itemId === "med-kit" ? 1 : 0;
}

function getTreatmentBreadth(itemId: ItemDefinitionId): number {
  return getMedicalStatusIdsTreatedByItem(itemId).length;
}

function compareMedicalSelections(
  patient: GameTribute,
  first: AccessibleInventoryItem,
  second: AccessibleInventoryItem,
): number {
  const firstFallbackRank = getMedicalFallbackRank(first.item.definitionId);

  const secondFallbackRank = getMedicalFallbackRank(second.item.definitionId);

  /*
   * Specific medicine beats med-kit fallback,
   * even when the specific item is borrowed.
   */
  if (firstFallbackRank !== secondFallbackRank) {
    return firstFallbackRank - secondFallbackRank;
  }

  /*
   * Within the same treatment category,
   * prefer the patient's own item.
   */
  const firstBorrowed = first.owner.id !== patient.id;

  const secondBorrowed = second.owner.id !== patient.id;

  if (firstBorrowed !== secondBorrowed) {
    return Number(firstBorrowed) - Number(secondBorrowed);
  }

  /*
   * Prefer the narrowest applicable medicine
   * when ownership is otherwise equivalent.
   *
   * Example: painkillers preserve bandages
   * for a future bleeding condition.
   */
  const firstBreadth = getTreatmentBreadth(first.item.definitionId);

  const secondBreadth = getTreatmentBreadth(second.item.definitionId);

  if (firstBreadth !== secondBreadth) {
    return firstBreadth - secondBreadth;
  }

  const firstDefinition = getItemDefinition(first.item.definitionId);

  const secondDefinition = getItemDefinition(second.item.definitionId);

  return (
    firstDefinition.id.localeCompare(secondDefinition.id) ||
    first.owner.id.localeCompare(second.owner.id) ||
    first.item.id.localeCompare(second.item.id)
  );
}

function getPatientMedicalStatuses(patient: GameTribute): StatusEffect[] {
  return patient.statuses
    .filter((status) => isMedicalStatusId(status.definitionId))
    .sort(compareMedicalStatuses);
}

function getActuallyTreatedStatusIds(
  patient: GameTribute,
  selection: AccessibleInventoryItem,
): StatusEffectId[] {
  const treatableStatusIds = new Set(getMedicalStatusIdsTreatedByItem(selection.item.definitionId));

  const treatedStatusIds = new Set<StatusEffectId>();

  for (const status of getPatientMedicalStatuses(patient)) {
    if (treatableStatusIds.has(status.definitionId)) {
      treatedStatusIds.add(status.definitionId);
    }
  }

  return [...treatedStatusIds];
}

export function findMedicalTreatmentPlan(
  state: GameState,
  patient: GameTribute,
  unavailableItemInstanceIds: ReadonlySet<string> = new Set(),
): MedicalTreatmentPlan | null {
  const medicalStatuses = getPatientMedicalStatuses(patient);

  if (medicalStatuses.length === 0) {
    return null;
  }

  const accessibleMedicine = getAccessibleInventoryItems(state, patient, {
    requiredTags: ["medicine"],

    unavailableItemInstanceIds,

    requireUsable: true,
  });

  if (accessibleMedicine.length === 0) {
    return null;
  }

  /*
   * Examine statuses in urgency order.
   *
   * An untreatable urgent status does not
   * block treatment of the next-most-urgent
   * status that has applicable medicine.
   */
  for (const status of medicalStatuses) {
    const candidates = accessibleMedicine
      .filter((selection) =>
        getMedicalStatusIdsTreatedByItem(selection.item.definitionId).includes(status.definitionId),
      )
      .sort((first, second) => compareMedicalSelections(patient, first, second));

    const selection = candidates[0];

    if (!selection) {
      continue;
    }

    return {
      targetStatus: status,
      selection,

      treatedStatusIds: getActuallyTreatedStatusIds(patient, selection),
    };
  }

  return null;
}

/**
 * Exported for focused ordering tests without
 * exposing planner implementation details.
 */
export function compareMedicalStatusUrgency(first: StatusEffect, second: StatusEffect): number {
  return compareMedicalStatuses(first, second);
}

/**
 * Used by validation and tests to verify that
 * a broad fallback still covers the complete
 * medical-status catalogue.
 */
export function isBroadMedicalTreatment(itemId: ItemDefinitionId): boolean {
  return getMedicalStatusIdsTreatedByItem(itemId).length === MEDICAL_STATUS_IDS.length;
}
