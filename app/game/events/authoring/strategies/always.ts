import type { EventResolutionStrategy } from "~/game/events/authoring/builder/event-builder-types";
import type { EventText } from "~/game/events/authoring/characters/event-text-context";
import { validateEffects } from "~/game/events/authoring/effects/compile-effects";
import type { AuthoredOutcome } from "~/game/events/authoring/outcomes/outcome-schema";
import {
  getConcreteEventResults,
  resolveAuthoredOutcome,
} from "~/game/events/authoring/outcomes/random-result";
import { resolveAuthoredResult } from "~/game/events/authoring/outcomes/resolve-authored-result";

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

      return resolveAuthoredResult(eventResult, context, roleIds, intro);
    },
  };
}
