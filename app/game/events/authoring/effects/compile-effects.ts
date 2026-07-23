import { createStatusChange, createSurvivalChanges } from "~/game/events/event-change-builders";
import { requireSingleParticipant, type EventResolutionContext } from "~/game/events/event-schema";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { GameChange } from "~/game/types/game-state";

import type { EventEffect } from "./effect-schema";

export function validateEffects(
  eventId: string,
  effects: readonly EventEffect[],
  roleIds: readonly string[],
): void {
  const knownRoleIds = new Set(roleIds);

  for (const effect of effects) {
    if (!knownRoleIds.has(effect.roleId)) {
      throw new Error(
        `Event "${eventId}": effect "${effect.type}" ` +
          `references unknown role "${effect.roleId}".`,
      );
    }

    if (effect.type === "apply-status") {
      try {
        getStatusDefinition(effect.statusId);
      } catch {
        throw new Error(
          `Event "${eventId}": effect "apply-status" ` +
            `references unknown status "${effect.statusId}".`,
        );
      }
    }
  }
}

export function compileEffects(
  effects: readonly EventEffect[],
  context: EventResolutionContext,
): GameChange[] {
  return effects.flatMap((effect): GameChange[] => {
    const tribute = requireSingleParticipant(context.participantsByRole, effect.roleId);

    switch (effect.type) {
      case "survived":
        return createSurvivalChanges([tribute]);

      case "apply-status":
        return [
          createStatusChange(
            context.eventId,
            tribute,
            effect.statusId,
            effect.severity,
            context.round,
          ),
        ];
    }
  });
}
