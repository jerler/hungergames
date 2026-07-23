import type { EventText } from "~/game/events/authoring/characters/event-text-context";
import type { EventEffect } from "~/game/events/authoring/effects/effect-schema";

export interface EventResult {
  /**
   * Prevents EventResult from overlapping with
   * discriminated outcome wrapper types.
   */
  kind?: never;

  text?: EventText;
  append?: EventText;

  effects: readonly EventEffect[];
}

export interface RandomEventResult {
  kind: "random-result";

  results: readonly EventResult[];
}

export type AuthoredOutcome = EventResult | RandomEventResult;

export interface StatCheckResults {
  criticalFailure: AuthoredOutcome;
  failure: AuthoredOutcome;
  success: AuthoredOutcome;
  exceptionalSuccess: AuthoredOutcome;
}
