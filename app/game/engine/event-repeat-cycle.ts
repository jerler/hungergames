import type { ResolvedEvent } from "~/game/types/game-state";

export interface EventRepeatCycleState {
  /**
   * Primary authored definitions selected since the most recent cycle reset.
   */
  usedDefinitionIds: Set<string>;
}

export interface EventRepeatCycleCandidate {
  definition: {
    id: string;
  };
}

export interface EventRepeatCycleSelection<Candidate extends EventRepeatCycleCandidate> {
  candidates: readonly Candidate[];

  /**
   * True when every currently selectable definition was already used and the
   * selected definition must begin a fresh cycle.
   */
  resetsCycle: boolean;
}

function getPrimaryEventPlanningIndex(event: ResolvedEvent): number {
  const idParts = event.id.split("-");
  const eventIndexPart = idParts[0] === "bloodbath" ? idParts[3] : idParts[2];
  const eventIndex = Number(eventIndexPart);

  return Number.isInteger(eventIndex) && eventIndex >= 0 ? eventIndex : Number.MAX_SAFE_INTEGER;
}

/**
 * Presentation order may differ from canonical planning order inside a round.
 * Reconstructing the cycle therefore sorts primary events by round and by the
 * event index embedded in their deterministic event IDs.
 */
export function getCanonicalPrimaryEventHistory(events: readonly ResolvedEvent[]): ResolvedEvent[] {
  return events
    .map((event, historyIndex) => ({
      event,
      historyIndex,
    }))
    .filter(({ event }) => event.kind === "primary")
    .sort(
      (first, second) =>
        first.event.round.day - second.event.round.day ||
        (first.event.round.period === second.event.round.period
          ? 0
          : first.event.round.period === "day"
            ? -1
            : 1) ||
        getPrimaryEventPlanningIndex(first.event) - getPrimaryEventPlanningIndex(second.event) ||
        first.historyIndex - second.historyIndex,
    )
    .map(({ event }) => event);
}

/**
 * Rebuilds the active repetition cycle without adding persisted schema state.
 *
 * A repeated primary definition is the observable reset boundary: the old
 * cycle is cleared immediately before that repeated definition begins the new
 * cycle.
 */
export function createEventRepeatCycleState(
  eventHistory: readonly ResolvedEvent[],
): EventRepeatCycleState {
  const usedDefinitionIds = new Set<string>();

  for (const event of getCanonicalPrimaryEventHistory(eventHistory)) {
    if (usedDefinitionIds.has(event.definitionId)) {
      usedDefinitionIds.clear();
    }

    usedDefinitionIds.add(event.definitionId);
  }

  return {
    usedDefinitionIds,
  };
}

/**
 * Prefers currently selectable definitions that have not appeared in the
 * active game-wide cycle.
 *
 * When every currently selectable definition is already used, the complete
 * selectable pool is returned and the eventual accepted selection begins a
 * fresh cycle. An empty candidate list stays empty so the sequencer can use
 * its existing fallback or no-event handling.
 */
export function selectEventRepeatCycleCandidates<Candidate extends EventRepeatCycleCandidate>(
  candidates: readonly Candidate[],
  state: EventRepeatCycleState,
): EventRepeatCycleSelection<Candidate> {
  const unusedCandidates = candidates.filter(
    (candidate) => !state.usedDefinitionIds.has(candidate.definition.id),
  );

  if (unusedCandidates.length > 0) {
    return {
      candidates: unusedCandidates,
      resetsCycle: false,
    };
  }

  return {
    candidates,
    resetsCycle: candidates.length > 0,
  };
}

/**
 * Records only an accepted event. Rejected resolution attempts must never
 * mutate the repetition cycle.
 */
export function recordEventRepeatCycleSelection(
  state: EventRepeatCycleState,
  definitionId: string,
  resetsCycle: boolean,
): void {
  if (resetsCycle) {
    state.usedDefinitionIds.clear();
  }

  state.usedDefinitionIds.add(definitionId);
}
