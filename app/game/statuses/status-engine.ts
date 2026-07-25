import { applyAutomaticResolutionEvents } from "~/game/engine/apply-automatic-resolution-events";
import { chooseSimultaneousFatalitySurvivor } from "~/game/engine/simultaneous-fatality";
import { createFatalStatusResolutionEvent } from "~/game/events/catalogue/statuses/resolution-events";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { StatusEffectId, StatusModifiers } from "~/game/statuses/status-schema";
import type { GameState, GameTribute, RoundReference, StatusEffect } from "~/game/types/game-state";

import { removeConflictingStatuses } from "./status-conflicts";

export type StatusScoreKey = "combat" | "survival" | "awareness" | "foraging";

const STATUS_MODIFIER_KEYS = {
  combat: "combatPerSeverity",
  survival: "survivalPerSeverity",
  awareness: "awarenessPerSeverity",
  foraging: "foragingPerSeverity",
} satisfies Record<StatusScoreKey, keyof StatusModifiers>;

function mergeStatusDuration(
  existingDuration: number | null,

  incomingDuration: number | null,
): number | null {
  if (existingDuration === null || incomingDuration === null) {
    if (existingDuration !== incomingDuration) {
      throw new Error("Cannot merge timed and persistent instances of the same status.");
    }

    return null;
  }

  return Math.max(existingDuration, incomingDuration);
}

export function createStatusEffectInstance(
  eventId: string,
  tributeId: string,
  definitionId: StatusEffectId,
  severity: 1 | 2 | 3,
  round: RoundReference,
  durationRounds?: number,
  sourceTributeId: string | null = null,
): StatusEffect {
  const definition = getStatusDefinition(definitionId);

  if (durationRounds !== undefined && (!Number.isInteger(durationRounds) || durationRounds <= 0)) {
    throw new Error(`Status "${definitionId}" duration override must be a positive integer.`);
  }

  if (definition.duration.kind === "persistent" && durationRounds !== undefined) {
    throw new Error(`Persistent status "${definitionId}" cannot receive a duration override.`);
  }

  if (sourceTributeId === tributeId) {
    throw new Error(`Tribute "${tributeId}" cannot be the attributed source of their own status.`);
  }

  return {
    id: `${eventId}:${tributeId}:${definitionId}`,
    definitionId,
    severity,

    remainingRounds:
      definition.duration.kind === "timed"
        ? (durationRounds ?? definition.duration.defaultRounds)
        : null,

    sourceEventId: eventId,
    sourceTributeId,

    appliedRound: {
      ...round,
    },
  };
}

/**
 * Adds or merges a status while enforcing the centralized
 * latest-status-wins conflict policy.
 */
export function upsertStatusEffect(
  statuses: readonly StatusEffect[],

  incomingStatus: StatusEffect,
): StatusEffect[] {
  const statusesWithoutConflicts = removeConflictingStatuses(statuses, incomingStatus.definitionId);

  const existingStatus = statusesWithoutConflicts.find(
    (status) => status.definitionId === incomingStatus.definitionId,
  );

  if (!existingStatus) {
    return [...statusesWithoutConflicts, incomingStatus];
  }

  const definition = getStatusDefinition(incomingStatus.definitionId);

  return statusesWithoutConflicts.map((status) => {
    if (status.id !== existingStatus.id) {
      return status;
    }

    return {
      ...status,

      /*
       * Preserve the existing additive merge rule:
       *
       * Injured 1 plus Injured 2 becomes Injured 3,
       * capped by the catalogue maximum.
       */
      severity: Math.min(
        definition.maxSeverity,
        status.severity + incomingStatus.severity,
      ) as StatusEffect["severity"],

      remainingRounds: mergeStatusDuration(status.remainingRounds, incomingStatus.remainingRounds),
    };
  });
}

export function getStatusModifier(tribute: GameTribute, scoreKey: StatusScoreKey): number {
  const modifierKey = STATUS_MODIFIER_KEYS[scoreKey];

  return tribute.statuses.reduce((total, status) => {
    const definition = getStatusDefinition(status.definitionId);

    return total + definition.modifiers[modifierKey] * status.severity;
  }, 0);
}

function isSameRound(firstRound: RoundReference, secondRound: RoundReference): boolean {
  return firstRound.day === secondRound.day && firstRound.period === secondRound.period;
}

function getFatalStatus(tribute: GameTribute): StatusEffect | null {
  return (
    [...tribute.statuses]
      .filter((status) => {
        if (status.remainingRounds === null || status.remainingRounds > 0) {
          return false;
        }

        const definition = getStatusDefinition(status.definitionId);

        return definition.duration.kind === "timed" && definition.duration.expiration === "fatal";
      })
      .sort(
        (firstStatus, secondStatus) =>
          secondStatus.severity - firstStatus.severity ||
          firstStatus.definitionId.localeCompare(secondStatus.definitionId),
      )[0] ?? null
  );
}

function removeExpiredRecoveringStatuses(tribute: GameTribute): GameTribute {
  return {
    ...tribute,
    statuses: tribute.statuses.filter((status) => {
      if (status.remainingRounds === null || status.remainingRounds > 0) {
        return true;
      }

      const definition = getStatusDefinition(status.definitionId);

      return definition.duration.kind === "timed" && definition.duration.expiration === "fatal";
    }),
  };
}

export function advanceStatusDurations(state: GameState): GameState {
  const completedRound = state.currentRound;

  if (!completedRound) {
    return state;
  }

  const tributesWithAdvancedStatuses = state.tributes.map((tribute) => {
    if (!tribute.isAlive) {
      return tribute;
    }

    return {
      ...tribute,

      statuses: tribute.statuses.map((status) => {
        /*
         * Persistent statuses require explicit removal
         * and never consume rounds automatically.
         *
         * A timed status does not consume one of its
         * active rounds during the round in which it
         * was first applied.
         */
        if (status.remainingRounds === null || isSameRound(status.appliedRound, completedRound)) {
          return status;
        }

        return {
          ...status,
          remainingRounds: Math.max(0, status.remainingRounds - 1),
        };
      }),
    };
  });

  const tributesWithResolvedRecoveries = tributesWithAdvancedStatuses.map(
    removeExpiredRecoveringStatuses,
  );

  const livingTributes = tributesWithResolvedRecoveries.filter((tribute) => tribute.isAlive);

  const fatalCandidates = livingTributes.filter((tribute) => getFatalStatus(tribute) !== null);

  const sparedTributeId = chooseSimultaneousFatalitySurvivor(fatalCandidates, livingTributes);

  const nextState: GameState = {
    ...state,

    tributes: tributesWithResolvedRecoveries.map((tribute) => {
      if (tribute.id !== sparedTributeId) {
        return tribute;
      }

      return {
        ...tribute,

        statuses: tribute.statuses.filter(
          (status) => status.remainingRounds === null || status.remainingRounds > 0,
        ),
      };
    }),
  };

  let resolvedState = nextState;

  /*
   * Build and apply fatal status events one at a time.
   *
   * This ensures delayed death loot checks the attacker's
   * current life state rather than the state that existed
   * before all simultaneous fatalities were processed.
   */
  for (const candidate of fatalCandidates) {
    if (candidate.id === sparedTributeId) {
      continue;
    }

    const tribute = resolvedState.tributes.find(
      (currentTribute) => currentTribute.id === candidate.id,
    );

    if (!tribute || !tribute.isAlive) {
      continue;
    }

    const fatalStatus = getFatalStatus(tribute);

    if (!fatalStatus) {
      throw new Error(`Fatal status could not be resolved ` + `for tribute "${tribute.id}".`);
    }

    const event = createFatalStatusResolutionEvent(
      resolvedState,
      tribute,
      fatalStatus,
      completedRound,
    );

    resolvedState = applyAutomaticResolutionEvents(resolvedState, [event]);
  }

  return resolvedState;
}
