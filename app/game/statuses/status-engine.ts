import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { GameState, GameTribute, RoundReference, StatusEffect } from "~/game/types/game-state";

export type StatusPenaltyKey = "combat" | "survival" | "awareness" | "foraging";

export function createStatusEffectInstance(
  eventId: string,
  tributeId: string,
  definitionId: StatusEffectId,
  severity: 1 | 2 | 3,
  round: RoundReference,
  durationRounds?: number,
): StatusEffect {
  const definition = getStatusDefinition(definitionId);

  return {
    id: `${eventId}:${tributeId}:${definitionId}`,
    definitionId,
    severity,
    remainingRounds: durationRounds ?? definition.defaultDurationRounds,
    sourceEventId: eventId,
    appliedRound: {
      ...round,
    },
  };
}

export function getStatusPenalty(tribute: GameTribute, penaltyKey: StatusPenaltyKey): number {
  return tribute.statuses.reduce((total, status) => {
    const definition = getStatusDefinition(status.definitionId);

    const penaltyPerSeverity = definition.penalties[`${penaltyKey}PerSeverity`];

    return total + penaltyPerSeverity * status.severity;
  }, 0);
}

function isSameRound(firstRound: RoundReference, secondRound: RoundReference): boolean {
  return firstRound.day === secondRound.day && firstRound.period === secondRound.period;
}

export function advanceStatusDurations(state: GameState): GameState {
  const completedRound = state.currentRound;

  if (!completedRound) {
    return state;
  }

  return {
    ...state,

    tributes: state.tributes.map((tribute) => {
      if (!tribute.isAlive) {
        return tribute;
      }

      const statuses = tribute.statuses
        .map((status) => {
          if (isSameRound(status.appliedRound, completedRound)) {
            return status;
          }

          return {
            ...status,
            remainingRounds: status.remainingRounds - 1,
          };
        })
        .filter((status) => status.remainingRounds > 0);

      return {
        ...tribute,
        statuses,
      };
    }),
  };
}
