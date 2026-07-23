import type { EventDefinition } from "~/game/events/event-schema";
import { compileAuthoredRoles } from "~/game/events/authoring/roles/compile-roles";
import { validateAuthoredEvent } from "~/game/events/authoring/validation/validate-authored-event";

import type { AuthoredEventConfiguration, EventResolutionStrategy } from "./event-builder-types";

export function compileEvent(
  configuration: AuthoredEventConfiguration,
  strategy: EventResolutionStrategy,
): EventDefinition {
  validateAuthoredEvent(configuration, strategy);

  const roleIds = configuration.roles.map((role) => role.id);

  const roles = compileAuthoredRoles(configuration.roles, configuration.requirements);

  return {
    id: configuration.id,

    category: configuration.category,
    tags: [...configuration.tags],

    periods: [...configuration.periods],
    baseWeight: configuration.baseWeight,

    ...(configuration.getWeightMultiplier
      ? {
          getWeightMultiplier: configuration.getWeightMultiplier,
        }
      : {}),

    roles,

    resolve: (context) => strategy.resolve(context, roleIds),
  };
}
