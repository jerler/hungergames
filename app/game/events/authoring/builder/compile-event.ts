import type { EventDefinition } from "~/game/events/event-schema";
import { validateAuthoredEvent } from "~/game/events/authoring/validation/validate-authored-event";

import type { AuthoredEventConfiguration, EventResolutionStrategy } from "./event-builder-types";

export function compileEvent(
  configuration: AuthoredEventConfiguration,

  strategy: EventResolutionStrategy,
): EventDefinition {
  validateAuthoredEvent(configuration, strategy);

  const roleIds = configuration.roles.map((role) => role.id);

  return {
    id: configuration.id,

    category: configuration.category,

    tags: [...configuration.tags],

    periods: [...configuration.periods],

    baseWeight: configuration.baseWeight,

    roles: configuration.roles.map((role) => ({
      ...role,
    })),

    resolve: (context) => strategy.resolve(context, roleIds),
  };
}
