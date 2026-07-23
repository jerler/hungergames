import type { EventText } from "~/game/events/authoring/characters/event-text-context";
import type { EventEffect } from "~/game/events/authoring/effects/effect-schema";

export interface EventResult {
  text?: EventText;
  append?: EventText;
  effects: readonly EventEffect[];
}

export interface StatCheckResults {
  criticalFailure: EventResult;
  failure: EventResult;
  success: EventResult;
  exceptionalSuccess: EventResult;
}
