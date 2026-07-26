import { formatRoundLabel } from "~/game/engine/rounds";

import type { StatusEffect } from "~/game/types/game-state";

import { getStatusDefinition } from "./status-catalogue";

import type { FatalStatusDefinition, StatusDefinition, StatusEffectId } from "./status-schema";

export type StatusPresentationTone = "critical" | "warning" | "stable" | "temporary" | "beneficial";

export interface StatusPresentationOptions {
  sourceTributeName?: string | null;
}

export interface StatusPresentationDetails {
  label: string;
  description: string;

  tone: StatusPresentationTone;

  kindLabel: string;
  severityLabel: string;
  durationLabel: string;

  lifecycleSummary: string;
  appliedRoundLabel: string;
  sourceLabel: string | null;

  effectSummaries: readonly string[];

  fatalCauseLabel: string | null;
  fatalConsequence: string | null;
}

const WARNING_NEED_STATUS_IDS = new Set<StatusEffectId>(["hungry", "thirsty"]);

function isFatalStatusDefinition(
  definition: StatusDefinition,
): definition is FatalStatusDefinition {
  return definition.duration.kind === "timed" && definition.duration.expiration === "fatal";
}

function getFatalUrgency(remainingRounds: number | null): StatusPresentationTone {
  if (remainingRounds === null || remainingRounds >= 3) {
    return "stable";
  }

  if (remainingRounds === 2) {
    return "warning";
  }

  return "critical";
}

function getStatusTone(status: StatusEffect, definition: StatusDefinition): StatusPresentationTone {
  if (isFatalStatusDefinition(definition)) {
    return getFatalUrgency(status.remainingRounds);
  }

  if (definition.kind === "beneficial") {
    return "beneficial";
  }

  if (WARNING_NEED_STATUS_IDS.has(definition.id)) {
    return "warning";
  }

  return "temporary";
}

function formatRoundCount(roundCount: number): string {
  return `${roundCount} ` + (roundCount === 1 ? "round" : "rounds");
}

function getDurationLabel(status: StatusEffect, definition: StatusDefinition): string {
  if (definition.duration.kind === "persistent") {
    return "Persistent";
  }

  if (status.remainingRounds === null) {
    return "Unknown duration";
  }

  return formatRoundCount(status.remainingRounds);
}

function getLifecycleSummary(status: StatusEffect, definition: StatusDefinition): string {
  if (definition.duration.kind === "persistent") {
    return definition.removalDescription ?? "Requires explicit removal.";
  }

  const remainingRounds = status.remainingRounds;

  if (remainingRounds === null) {
    return "Duration unavailable.";
  }

  if (definition.duration.expiration === "fatal") {
    if (remainingRounds <= 1) {
      return "Fatal at the end of the " + "next round if untreated.";
    }

    return `Fatal in ${remainingRounds} ` + "rounds if untreated.";
  }

  if (definition.kind === "beneficial") {
    if (remainingRounds <= 1) {
      return "Wears off at the end of " + "the next round.";
    }

    return `Wears off in ${remainingRounds} ` + "rounds.";
  }

  if (remainingRounds <= 1) {
    return "Recovers at the end of the " + "next round.";
  }

  return `Recovers in ${remainingRounds} ` + "rounds.";
}

function getKindLabel(definition: StatusDefinition): string {
  if (isFatalStatusDefinition(definition)) {
    return "Fatal condition";
  }

  if (definition.duration.kind === "persistent") {
    return "Persistent need";
  }

  return definition.kind === "beneficial" ? "Beneficial status" : "Harmful status";
}

function getSeverityLabel(status: StatusEffect, definition: StatusDefinition): string {
  const label = definition.kind === "beneficial" ? "Strength" : "Severity";

  return `${label} ${status.severity} ` + `of ${definition.maxSeverity}`;
}

function formatSignedValue(value: number): string {
  const roundedValue = Math.round(value * 100) / 100;

  if (roundedValue > 0) {
    return `+${roundedValue}`;
  }

  return String(roundedValue).replace("-", "−");
}

function createModifierSummary(label: string, value: number): string | null {
  if (value === 0) {
    return null;
  }

  return `${label} score ` + formatSignedValue(value);
}

function getSpecialEffectSummaries(status: StatusEffect): string[] {
  switch (status.definitionId) {
    case "lucky":
      return [`Effective Luck +${status.severity}, up to 5.`];

    case "hidden": {
      if (status.severity >= 3) {
        return ["Excluded from ordinary hostile targeting."];
      }

      const remainingWeight = 1 - status.severity / 3;

      const percentage = Math.round(remainingWeight * 100);

      return [`Ordinary hostile targeting reduced to ${percentage}% of normal.`];
    }

    default:
      return [];
  }
}

function getEffectSummaries(status: StatusEffect, definition: StatusDefinition): string[] {
  const severity = status.severity;

  const modifierSummaries = [
    createModifierSummary(
      "Combat",

      definition.modifiers.combatPerSeverity * severity,
    ),

    createModifierSummary(
      "Survival",

      definition.modifiers.survivalPerSeverity * severity,
    ),

    createModifierSummary(
      "Awareness",

      definition.modifiers.awarenessPerSeverity * severity,
    ),

    createModifierSummary(
      "Foraging",

      definition.modifiers.foragingPerSeverity * severity,
    ),
  ].filter((summary): summary is string => summary !== null);

  return [...getSpecialEffectSummaries(status), ...modifierSummaries];
}

function getSourceLabel(
  status: StatusEffect,
  sourceTributeName: string | null | undefined,
): string | null {
  if (status.sourceTributeId === null) {
    return null;
  }

  if (sourceTributeName) {
    return `Caused by ` + `${sourceTributeName}.`;
  }

  return "Caused by another tribute.";
}

export function createStatusPresentation(
  status: StatusEffect,
  { sourceTributeName = null }: StatusPresentationOptions = {},
): StatusPresentationDetails {
  const definition = getStatusDefinition(status.definitionId);

  const fatalDefinition = isFatalStatusDefinition(definition) ? definition : null;

  return {
    label: definition.label,

    description: definition.description,

    tone: getStatusTone(status, definition),

    kindLabel: getKindLabel(definition),

    severityLabel: getSeverityLabel(status, definition),

    durationLabel: getDurationLabel(status, definition),

    lifecycleSummary: getLifecycleSummary(status, definition),

    appliedRoundLabel: `Received during ${formatRoundLabel(status.appliedRound)}.`,

    sourceLabel: getSourceLabel(status, sourceTributeName),

    effectSummaries: getEffectSummaries(status, definition),

    fatalCauseLabel: fatalDefinition?.fatalCauseLabel ?? null,

    fatalConsequence: fatalDefinition
      ? "If untreated, the tribute " + fatalDefinition.fatalSummary
      : null,
  };
}

function getStatusSortGroup(status: StatusEffect, definition: StatusDefinition): number {
  if (isFatalStatusDefinition(definition)) {
    return 0;
  }

  if (definition.kind === "harmful") {
    return 1;
  }

  return 2;
}

export function compareStatusesByUrgency(
  firstStatus: StatusEffect,
  secondStatus: StatusEffect,
): number {
  const firstDefinition = getStatusDefinition(firstStatus.definitionId);

  const secondDefinition = getStatusDefinition(secondStatus.definitionId);

  const firstRounds = firstStatus.remainingRounds ?? Number.POSITIVE_INFINITY;

  const secondRounds = secondStatus.remainingRounds ?? Number.POSITIVE_INFINITY;

  return (
    getStatusSortGroup(firstStatus, firstDefinition) -
      getStatusSortGroup(secondStatus, secondDefinition) ||
    firstRounds - secondRounds ||
    secondStatus.severity - firstStatus.severity ||
    firstStatus.definitionId.localeCompare(secondStatus.definitionId)
  );
}
