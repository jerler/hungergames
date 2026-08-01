import { createSeededRandom, shuffleItems } from "~/game/engine/random";
import { createRoundSeed } from "~/game/engine/rounds";
import type { ResolvedEvent, RoundReference, Truce, Vendetta } from "~/game/types/game-state";

interface EventPresentationState {
  seed: string;
  truces: readonly Truce[];
  vendettas: readonly Vendetta[];
}

interface PresentationDependencies {
  repeatedParticipantTributeIds: ReadonlySet<string>;
  relationshipTributeIds: ReadonlySet<string>;
  referencedItemInstanceIds: ReadonlySet<string>;
  referencedStatusIds: ReadonlySet<string>;
}

const PRESENTATION_ORDER_SEED_SUFFIX = "event-presentation-order";

const OPENING_PODIUM_EVENT_DEFINITION_IDS = new Set<string>([
  "cornucopia-fatal-podium-detonation-bits",
  "cornucopia-fatal-podium-detonation-balloon",
]);

function createPresentationSeed(gameSeed: string, round: RoundReference): string {
  return [createRoundSeed(gameSeed, round), PRESENTATION_ORDER_SEED_SUFFIX].join(":");
}

function collectPresentationDependencies(
  state: EventPresentationState,
  events: readonly ResolvedEvent[],
): PresentationDependencies {
  const participantAppearanceCounts = new Map<string, number>();
  const relationshipTributeIds = new Set<string>();
  const referencedItemInstanceIds = new Set<string>();
  const referencedStatusIds = new Set<string>();

  for (const truce of state.truces) {
    for (const tributeId of truce.tributeIds) {
      relationshipTributeIds.add(tributeId);
    }
  }

  for (const vendetta of state.vendettas) {
    relationshipTributeIds.add(vendetta.hunterTributeId);
    relationshipTributeIds.add(vendetta.targetTributeId);
  }

  for (const event of events) {
    for (const tributeId of event.participantTributeIds) {
      participantAppearanceCounts.set(
        tributeId,
        (participantAppearanceCounts.get(tributeId) ?? 0) + 1,
      );
    }

    for (const change of event.changes) {
      switch (change.type) {
        case "form-truce":
          for (const tributeId of change.truce.tributeIds) {
            relationshipTributeIds.add(tributeId);
          }
          break;

        case "form-vendetta":
          relationshipTributeIds.add(change.vendetta.hunterTributeId);
          relationshipTributeIds.add(change.vendetta.targetTributeId);
          break;

        case "consume-item":
        case "use-item":
        case "destroy-item":
        case "transfer-item":
          referencedItemInstanceIds.add(change.itemInstanceId);
          break;

        case "remove-status":
          referencedStatusIds.add(change.statusId);
          break;

        default:
          break;
      }
    }
  }

  const repeatedParticipantTributeIds = new Set(
    [...participantAppearanceCounts.entries()]
      .filter(([, appearanceCount]) => appearanceCount > 1)
      .map(([tributeId]) => tributeId),
  );

  return {
    repeatedParticipantTributeIds,
    relationshipTributeIds,
    referencedItemInstanceIds,
    referencedStatusIds,
  };
}

function mustKeepCanonicalSlot(
  event: ResolvedEvent,
  dependencies: PresentationDependencies,
): boolean {
  /*
   * Repeated participation creates a direct narrative and state dependency:
   * the tribute's first event must resolve before the later event that may
   * eliminate them. Keep every event involving that tribute in its canonical
   * slot while independent events continue to shuffle around those anchors.
   */
  if (
    event.participantTributeIds.some((tributeId) =>
      dependencies.repeatedParticipantTributeIds.has(tributeId),
    )
  ) {
    return true;
  }

  return event.changes.some((change) => {
    switch (change.type) {
      /*
       * Relationship mutations are order-sensitive. Deaths can also
       * generate automatic truce dissolution and vendetta aftermath.
       */
      case "form-truce":
      case "break-truce":
      case "form-vendetta":
        return true;

      case "eliminate-tribute":
        return dependencies.relationshipTributeIds.has(change.tributeId);

      /*
       * Preserve producer/consumer order for the uncommon case where
       * one round both creates and later references the same instance.
       */
      case "acquire-item":
        return dependencies.referencedItemInstanceIds.has(change.item.id);

      case "consume-item":
      case "use-item":
      case "destroy-item":
      case "transfer-item":
        return true;

      case "apply-status":
        return dependencies.referencedStatusIds.has(change.status.id);

      case "remove-status":
      case "declare-victory":
        return true;

      default:
        return false;
    }
  });
}

function shuffleIndependentSlots(
  events: readonly ResolvedEvent[],
  seed: string,
  dependencies: PresentationDependencies,
): ResolvedEvent[] {
  const fixedEventIds = new Set(
    events.filter((event) => mustKeepCanonicalSlot(event, dependencies)).map((event) => event.id),
  );

  const shuffledMovableEvents = shuffleItems(
    events.filter((event) => !fixedEventIds.has(event.id)),
    createSeededRandom(seed),
  );

  let nextMovableIndex = 0;

  return events.map((event) => {
    if (fixedEventIds.has(event.id)) {
      return event;
    }

    const shuffledEvent = shuffledMovableEvents[nextMovableIndex];

    if (!shuffledEvent) {
      throw new Error("Event presentation shuffle lost a movable event.");
    }

    nextMovableIndex += 1;

    return shuffledEvent;
  });
}

/**
 * Randomizes presentation without changing event selection or violating
 * causal dependencies between resolved changes.
 *
 * Bloodbath ordering remains:
 *
 * 1. Countdown/podium deaths
 * 2. Remaining Cornucopia events
 * 3. "Ran for the trees" events
 * 4. Any ungrouped opening aftermath
 *
 * Events that share a participant, mutate relationships, or depend on
 * same-round instances keep their canonical slots. Independent events
 * shuffle around those anchors.
 */
export function shuffleRoundEventsForPresentation(
  state: EventPresentationState,
  round: RoundReference,
  events: readonly ResolvedEvent[],
): ResolvedEvent[] {
  const presentationSeed = createPresentationSeed(state.seed, round);
  const dependencies = collectPresentationDependencies(state, events);

  const isBloodbath = round.day === 1 && round.period === "day";

  if (!isBloodbath) {
    return shuffleIndependentSlots(events, presentationSeed, dependencies);
  }

  const openingPodiumEvents = events.filter((event) =>
    OPENING_PODIUM_EVENT_DEFINITION_IDS.has(event.definitionId),
  );
  const cornucopiaEvents = events.filter(
    (event) =>
      event.feedGroup === "bloodbath-cornucopia" &&
      !OPENING_PODIUM_EVENT_DEFINITION_IDS.has(event.definitionId),
  );
  const fleeEvents = events.filter((event) => event.feedGroup === "bloodbath-flee");
  const ungroupedEvents = events.filter(
    (event) =>
      event.feedGroup !== "bloodbath-cornucopia" &&
      event.feedGroup !== "bloodbath-flee" &&
      !OPENING_PODIUM_EVENT_DEFINITION_IDS.has(event.definitionId),
  );

  return [
    ...shuffleIndependentSlots(
      openingPodiumEvents,
      `${presentationSeed}:bloodbath-podium`,
      dependencies,
    ),
    ...shuffleIndependentSlots(
      cornucopiaEvents,
      `${presentationSeed}:bloodbath-cornucopia`,
      dependencies,
    ),
    ...shuffleIndependentSlots(fleeEvents, `${presentationSeed}:bloodbath-flee`, dependencies),
    ...shuffleIndependentSlots(
      ungroupedEvents,
      `${presentationSeed}:bloodbath-other`,
      dependencies,
    ),
  ];
}
