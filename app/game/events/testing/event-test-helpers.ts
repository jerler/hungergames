import type {
  EventDefinition,
  EventItemsByRole,
  EventResolution,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import {
  selectEventParticipants,
  type ParticipantSelection,
} from "~/game/events/participant-selection";
import { AUTHORING_TEST_ROUND } from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createSequenceRandom } from "~/game/events/authoring/testing/resolve-authored-event";
import type { GameState, GameTribute, RoundReference, StatusEffect } from "~/game/types/game-state";

export function requireEventDefinition(
  events: readonly EventDefinition[],
  eventId: string,
): EventDefinition {
  const definition = events.find((candidate) => candidate.id === eventId);

  if (!definition) {
    throw new Error(`Missing event definition "${eventId}".`);
  }

  return definition;
}

function getDistinctParticipants(participantsByRole: ParticipantsByRole): GameTribute[] {
  return [
    ...new Map(
      Object.values(participantsByRole)
        .flat()
        .map((tribute) => [tribute.id, tribute]),
    ).values(),
  ];
}

interface ResolveEventWithParticipantsOptions {
  definition: EventDefinition;
  state: GameState;
  participantsByRole: ParticipantsByRole;
  randomValues: readonly number[];

  round?: RoundReference;
  eventId?: string;
  itemsByRole?: EventItemsByRole;

  unavailableItemInstanceIds?: ReadonlySet<string>;
}

export function resolveEventWithParticipants({
  definition,
  state,
  participantsByRole,
  randomValues,

  round = AUTHORING_TEST_ROUND,
  eventId = `test:${definition.id}`,
  itemsByRole,

  unavailableItemInstanceIds = new Set<string>(),
}: ResolveEventWithParticipantsOptions): EventResolution {
  return definition.resolve({
    state,
    round,

    livingTributes: getDistinctParticipants(participantsByRole),

    eventId,
    random: createSequenceRandom(randomValues),

    participantsByRole,
    itemsByRole,
    unavailableItemInstanceIds,
  });
}

interface SelectAndResolveEventOptions {
  definition: EventDefinition;
  state: GameState;
  livingTributes: readonly GameTribute[];
  randomValues: readonly number[];

  selectionRandomValues?: readonly number[];

  round?: RoundReference;

  unavailableTributeIds?: ReadonlySet<string>;
  unavailableItemInstanceIds?: ReadonlySet<string>;
}

export interface SelectedEventResolution {
  selection: ParticipantSelection;
  resolution: EventResolution;
}

export function selectAndResolveEvent({
  definition,
  state,
  livingTributes,
  randomValues,

  selectionRandomValues = [0],

  round = AUTHORING_TEST_ROUND,

  unavailableTributeIds = new Set<string>(),

  unavailableItemInstanceIds = new Set<string>(),
}: SelectAndResolveEventOptions): SelectedEventResolution {
  const selection = selectEventParticipants(
    definition,
    {
      state,
      round,
      livingTributes,
    },
    createSequenceRandom(selectionRandomValues),
    unavailableTributeIds,
    unavailableItemInstanceIds,
  );

  if (!selection) {
    throw new Error(`Could not select participants for event "${definition.id}".`);
  }

  const resolution = definition.resolve({
    state,
    round,
    livingTributes,

    eventId: `test:${definition.id}`,

    random: createSequenceRandom(randomValues),

    participantsByRole: selection.participantsByRole,

    itemsByRole: selection.itemsByRole,

    unavailableItemInstanceIds,
  });

  return {
    selection,
    resolution,
  };
}

export function getAppliedStatuses(resolution: EventResolution): StatusEffect[] {
  return resolution.changes.flatMap((change) =>
    change.type === "apply-status" ? [change.status] : [],
  );
}

export function getAppliedStatusIds(resolution: EventResolution): string[] {
  return getAppliedStatuses(resolution).map((status) => status.definitionId);
}

export function getAcquiredItemIds(resolution: EventResolution): string[] {
  return resolution.changes.flatMap((change) =>
    change.type === "acquire-item" ? [change.item.definitionId] : [],
  );
}

export function hasSurvivalCredit(resolution: EventResolution, tributeId: string): boolean {
  return resolution.changes.some(
    (change) =>
      change.type === "increment-statistic" &&
      change.tributeId === tributeId &&
      change.statistic === "eventsSurvived" &&
      change.amount > 0,
  );
}

export function getEliminations(resolution: EventResolution) {
  return resolution.changes.filter((change) => change.type === "eliminate-tribute");
}

export function sampleOutcomeSignatures<T>(
  resolve: (randomValue: number) => T,
  getSignature: (value: T) => string,
  sampleCount = 1_000,
): Set<string> {
  const signatures = new Set<string>();

  for (let index = 0; index < sampleCount; index += 1) {
    const randomValue = (index + 0.5) / sampleCount;

    signatures.add(getSignature(resolve(randomValue)));
  }

  return signatures;
}
