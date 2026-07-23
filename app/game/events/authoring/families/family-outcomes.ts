import type { EventEffect } from "~/game/events/authoring/effects/effect-schema";
import type {
  AuthoredOutcome,
  EventResult,
  StatCheckResults,
} from "~/game/events/authoring/outcomes/outcome-schema";

export const STAT_OUTCOME_KEYS = [
  "criticalFailure",
  "failure",
  "success",
  "exceptionalSuccess",
] as const satisfies readonly (keyof StatCheckResults)[];

export type StatOutcomeKey = (typeof STAT_OUTCOME_KEYS)[number];

function appendEffectToResult(eventResult: EventResult, effect: EventEffect): EventResult {
  return {
    ...eventResult,
    effects: [...eventResult.effects, effect],
  };
}

export function appendEffectToOutcome(
  outcome: AuthoredOutcome,
  effect: EventEffect,
): AuthoredOutcome {
  if (outcome.kind === "random-result") {
    return {
      ...outcome,
      results: outcome.results.map((eventResult) => appendEffectToResult(eventResult, effect)),
    };
  }

  return appendEffectToResult(outcome, effect);
}

export function appendEffectToStatOutcomes(
  outcomes: StatCheckResults,
  effect: EventEffect,
  selectedOutcomes: readonly StatOutcomeKey[],
): StatCheckResults {
  const selected = new Set(selectedOutcomes);

  return {
    criticalFailure: selected.has("criticalFailure")
      ? appendEffectToOutcome(outcomes.criticalFailure, effect)
      : outcomes.criticalFailure,

    failure: selected.has("failure")
      ? appendEffectToOutcome(outcomes.failure, effect)
      : outcomes.failure,

    success: selected.has("success")
      ? appendEffectToOutcome(outcomes.success, effect)
      : outcomes.success,

    exceptionalSuccess: selected.has("exceptionalSuccess")
      ? appendEffectToOutcome(outcomes.exceptionalSuccess, effect)
      : outcomes.exceptionalSuccess,
  };
}
