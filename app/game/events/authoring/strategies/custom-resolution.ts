import type { EventResolution, EventResolutionContext } from "~/game/events/event-schema";

import type { EventResolutionStrategy } from "../builder/event-builder-types";
import { validateEffects } from "../effects/compile-effects";
import type { EventResult } from "../outcomes/outcome-schema";
import { resolveAuthoredResult } from "../outcomes/resolve-authored-result";
import type { EventText } from "../characters/event-text-context";

export interface CustomResolutionHelpers {
  resolveResult(
    eventResult: EventResult,
    contextOverride?: EventResolutionContext,
    intro?: EventText,
  ): EventResolution;
}

export type CustomEventResolver = (
  context: EventResolutionContext,
  helpers: CustomResolutionHelpers,
) => EventResolution;

export interface CustomResolutionOptions {
  /**
   * Every result that the custom resolver may produce.
   *
   * These are validated when the event definition is created.
   */
  possibleResults?: readonly EventResult[];
}

export function customResolution(
  resolver: CustomEventResolver,
  { possibleResults = [] }: CustomResolutionOptions = {},
): EventResolutionStrategy {
  return {
    validate(eventId, roleIds, requiredItemRoleIds): void {
      for (const eventResult of possibleResults) {
        validateEffects(eventId, eventResult.effects, roleIds, requiredItemRoleIds);
      }
    },

    resolve(context, roleIds) {
      return resolver(context, {
        resolveResult(eventResult, contextOverride = context, intro) {
          return resolveAuthoredResult(eventResult, contextOverride, roleIds, intro);
        },
      });
    },
  };
}
