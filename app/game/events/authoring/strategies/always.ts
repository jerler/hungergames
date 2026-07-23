import type { EventResolutionStrategy } from "~/game/events/authoring/builder/event-builder-types";
import {
  createEventTextContext,
  type EventText,
} from "~/game/events/authoring/characters/event-text-context";
import { compileEffects, validateEffects } from "~/game/events/authoring/effects/compile-effects";
import type { EventResult } from "~/game/events/authoring/outcomes/outcome-schema";
import { resolveOutcomeText } from "~/game/events/authoring/outcomes/resolve-outcome";

interface AlwaysStrategyOptions {
  intro?: EventText;
}

export function always(
  result: EventResult,
  { intro }: AlwaysStrategyOptions = {},
): EventResolutionStrategy {
  return {
    validate(eventId, roleIds): void {
      validateEffects(eventId, result.effects, roleIds);
    },

    resolve(context, roleIds) {
      const textContext = createEventTextContext(context, roleIds);

      return {
        text: resolveOutcomeText(context.eventId, result, textContext, intro),

        changes: compileEffects(result.effects, context),
      };
    },
  };
}
