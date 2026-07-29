import type { EventDefinition } from "~/game/events/event-schema";
import { compileAuthoredRoles } from "~/game/events/authoring/roles/compile-roles";
import { createAuthoredEventSelectionProfile } from "~/game/events/authoring/requirements/requirement-specificity";
import { validateAuthoredEvent } from "~/game/events/authoring/validation/validate-authored-event";

import type { AuthoredEventConfiguration, EventResolutionStrategy } from "./event-builder-types";
import { createAuthoredEventRecoveryProfile } from "./compile-event-recovery";

export function compileEvent(
  configuration: AuthoredEventConfiguration,
  strategy: EventResolutionStrategy,
): EventDefinition {
  validateAuthoredEvent(configuration, strategy);

  const roleIds = configuration.roles.map((role) => role.id);

  const roles = compileAuthoredRoles(configuration.roles, configuration.requirements);

  const selectionProfile = createAuthoredEventSelectionProfile(configuration.requirements);

  const recoveryProfile = createAuthoredEventRecoveryProfile(
    configuration.recoveryTargets,
    configuration.requirements,
  );

  return {
    id: configuration.id,

    category: configuration.category,
    tags: [...configuration.tags],

    periods: [...configuration.periods],
    baseWeight: configuration.baseWeight,

    ...(selectionProfile
      ? {
          selectionProfile,
        }
      : {}),

    ...(configuration.getWeightMultiplier
      ? {
          getWeightMultiplier: configuration.getWeightMultiplier,
        }
      : {}),

    ...(recoveryProfile
      ? {
          recoveryProfile,
        }
      : {}),

    roles,

    resolve: (context) => strategy.resolve(context, roleIds),
  };
}
