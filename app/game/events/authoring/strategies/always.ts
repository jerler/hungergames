import type { EventResolutionStrategy } from "~/game/events/authoring/builder/event-builder-types";
import {
  createEventTextContext,
  type EventText,
} from "~/game/events/authoring/characters/event-text-context";
import { compileEffects, validateEffects } from "~/game/events/authoring/effects/compile-effects";
import type { AuthoredOutcome } from "~/game/events/authoring/outcomes/outcome-schema";
import {
  getConcreteEventResults,
  resolveAuthoredOutcome,
} from "~/game/events/authoring/outcomes/random-result";
import { resolveOutcomeText } from "~/game/events/authoring/outcomes/resolve-outcome";

interface AlwaysStrategyOptions {
  intro?: EventText;
}

export function always(
  outcome: AuthoredOutcome,
  { intro }: AlwaysStrategyOptions = {},
): EventResolutionStrategy {
  return {
    validate(eventId, roleIds, requiredItemRoleIds): void {
      for (const eventResult of getConcreteEventResults(outcome)) {
        validateEffects(eventId, eventResult.effects, roleIds, requiredItemRoleIds);
      }
    },

    resolve(context, roleIds) {
      const eventResult = resolveAuthoredOutcome(outcome, context.random);
      const textContext = createEventTextContext(context, roleIds);

      return {
        text: resolveOutcomeText(context.eventId, eventResult, textContext, intro),
        changes: compileEffects(eventResult.effects, context),
      };
    },
  };
}
