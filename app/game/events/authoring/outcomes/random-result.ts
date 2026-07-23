import { selectRandomItem, type RandomSource } from "~/game/engine/random";

import type { AuthoredOutcome, EventResult, RandomEventResult } from "./outcome-schema";

function isRandomEventResult(outcome: AuthoredOutcome): outcome is RandomEventResult {
  return outcome.kind === "random-result";
}

export function randomResult(...results: readonly EventResult[]): RandomEventResult {
  if (results.length === 0) {
    throw new Error("A random event result must contain at least one result.");
  }

  return {
    kind: "random-result",
    results: [...results],
  };
}

export function getConcreteEventResults(outcome: AuthoredOutcome): readonly EventResult[] {
  return isRandomEventResult(outcome) ? outcome.results : [outcome];
}

export function resolveAuthoredOutcome(
  outcome: AuthoredOutcome,
  random: RandomSource,
): EventResult {
  if (isRandomEventResult(outcome)) {
    if (outcome.results.length === 0) {
      throw new Error("A random event result must contain at least one result.");
    }

    return selectRandomItem(outcome.results, random);
  }

  return outcome;
}
