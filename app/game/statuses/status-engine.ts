import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { StatusEffectId, StatusModifiers } from "~/game/statuses/status-schema";
import type {
  GameChange,
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
  StatusEffect,
} from "~/game/types/game-state";

export type StatusScoreKey = "combat" | "survival" | "awareness" | "foraging";

const STATUS_MODIFIER_KEYS = {
  combat: "combatPerSeverity",
  survival: "survivalPerSeverity",
  awareness: "awarenessPerSeverity",
  foraging: "foragingPerSeverity",
} satisfies Record<StatusScoreKey, keyof StatusModifiers>;

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
    id: `${eventId}:` + `${tributeId}:` + definitionId,

    definitionId,
    severity,

    remainingRounds: durationRounds ?? definition.defaultDurationRounds,

    sourceEventId: eventId,

    appliedRound: {
      ...round,
    },
  };
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
        if (status.remainingRounds > 0) {
          return false;
        }

        return getStatusDefinition(status.definitionId).expiration === "fatal";
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
      if (status.remainingRounds > 0) {
        return true;
      }

      return getStatusDefinition(status.definitionId).expiration === "fatal";
    }),
  };
}

function createFatalStatusEvent(
  tribute: GameTribute,
  status: StatusEffect,
  round: RoundReference,
): ResolvedEvent {
  const definition = getStatusDefinition(status.definitionId);

  if (definition.expiration !== "fatal") {
    throw new Error(`Recovering status "${definition.id}" cannot create a fatal event.`);
  }

  const eventId =
    `status-fatality:${round.day}:` + `${round.period}:` + `${tribute.id}:` + status.id;

  const text = `${tribute.snapshot.name} ` + definition.fatalSummary;

  const removeStatusChanges: GameChange[] = tribute.statuses.map((activeStatus) => ({
    type: "remove-status",
    tributeId: tribute.id,
    statusId: activeStatus.id,
  }));

  return {
    id: eventId,

    definitionId: `status-fatality:` + definition.id,

    resolutionMode: "standard",

    round: {
      ...round,
    },

    participantTributeIds: [tribute.id],

    text,

    changes: [
      {
        type: "eliminate-tribute",
        tributeId: tribute.id,

        causeId: `status:` + definition.id,

        causeLabel: definition.fatalCauseLabel,

        summary: text,
        killerTributeIds: [],
      },

      ...removeStatusChanges,
    ],
  };
}

function chooseSimultaneousFatalitySurvivor(
  fatalCandidates: readonly GameTribute[],
  livingTributes: readonly GameTribute[],
): string | null {
  if (fatalCandidates.length === 0 || fatalCandidates.length !== livingTributes.length) {
    return null;
  }

  /*
   * If every remaining tribute would
   * die at the same instant, the
   * highest-Luck tribute narrowly
   * survives so the Games still have
   * one victor.
   */
  return (
    [...fatalCandidates].sort(
      (firstTribute, secondTribute) =>
        secondTribute.snapshot.stats.luck - firstTribute.snapshot.stats.luck ||
        firstTribute.id.localeCompare(secondTribute.id),
    )[0]?.id ?? null
  );
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
         * A status does not consume
         * one of its active rounds
         * during the round in which
         * it was first applied.
         */
        if (isSameRound(status.appliedRound, completedRound)) {
          return status;
        }

        return {
          ...status,

          remainingRounds: status.remainingRounds - 1,
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

  let nextState: GameState = {
    ...state,

    tributes: tributesWithResolvedRecoveries.map((tribute) => {
      if (tribute.id !== sparedTributeId) {
        return tribute;
      }

      return {
        ...tribute,

        statuses: tribute.statuses.filter((status) => status.remainingRounds > 0),
      };
    }),
  };

  const fatalEvents = fatalCandidates
    .filter((tribute) => tribute.id !== sparedTributeId)
    .map((tribute) => {
      const fatalStatus = getFatalStatus(tribute);

      if (!fatalStatus) {
        throw new Error(`Fatal status could not be resolved for tribute "${tribute.id}".`);
      }

      return createFatalStatusEvent(tribute, fatalStatus, completedRound);
    });

  for (const fatalEvent of fatalEvents) {
    nextState = applyResolvedEvent(nextState, fatalEvent);
  }

  return {
    ...nextState,

    /*
     * Fatal status deaths happen
     * automatically at the end of the
     * round, so they are immediately
     * revealed in the event feed.
     *
     * Recovering effects simply
     * disappear and do not create a
     * separate event.
     */
    roundEvents: [...nextState.roundEvents, ...fatalEvents],

    revealedEventCount: nextState.revealedEventCount + fatalEvents.length,
  };
}
