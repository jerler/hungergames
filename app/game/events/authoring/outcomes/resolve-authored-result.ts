import type { EventResolution } from "~/game/events/event-schema";
import type { EventResolutionContext } from "~/game/events/event-schema";

import { createEventTextContext, type EventText } from "../characters/event-text-context";
import { compileEffects } from "../effects/compile-effects";
import type { EventResult } from "./outcome-schema";
import { resolveOutcomeText } from "./resolve-outcome";

export function resolveAuthoredResult(
  eventResult: EventResult,
  context: EventResolutionContext,
  roleIds: readonly string[],
  intro?: EventText,
): EventResolution {
  const textContext = createEventTextContext(context, roleIds);

  const text = resolveOutcomeText(context.eventId, eventResult, textContext, intro);

  return {
    text,
    changes: compileEffects(eventResult.effects, context, text),
  };
}
