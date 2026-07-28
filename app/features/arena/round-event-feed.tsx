import { useEffect, useRef } from "react";

import { EventCard } from "~/features/arena/event-card";
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";
import { formatRoundLabel } from "~/game/engine/rounds";

import type {
  EventFeedGroup,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";

interface RoundEventFeedProps {
  events: readonly ResolvedEvent[];
  tributes: readonly GameTribute[];
  round: RoundReference;
  totalPrimaryEventCount: number;
}

interface EventFeedGroupPresentation {
  id: EventFeedGroup;
  label: string;
  description: string;
}

type ArenaEventGroupId = EventFeedGroup | "arena-aftermath";

const BLOODBATH_EVENT_FEED_GROUPS = [
  {
    id: "bloodbath-cornucopia",
    label: "At the Cornucopia",
    description: "The opening scramble for weapons and supplies begins.",
  },
  {
    id: "bloodbath-flee",
    label: "Ran for the trees",
    description: "The fleeing tributes disappear into the arena.",
  },
] satisfies readonly EventFeedGroupPresentation[];

const BLOODBATH_EVENT_FEED_GROUP_IDS = new Set<EventFeedGroup>(
  BLOODBATH_EVENT_FEED_GROUPS.map((group) => group.id),
);

function isBloodbathEventFeedGroup(
  feedGroup: EventFeedGroup | undefined,
): feedGroup is EventFeedGroup {
  return feedGroup !== undefined && BLOODBATH_EVENT_FEED_GROUP_IDS.has(feedGroup);
}

interface ArenaEventGroupProps {
  id: ArenaEventGroupId;
  label: string;
  description: string;
  events: readonly ResolvedEvent[];
  tributes: readonly GameTribute[];
}

function ArenaEventGroup({ id, label, description, events, tributes }: ArenaEventGroupProps) {
  const titleId = `event-feed-group-${id}-title`;

  return (
    <section className="event-feed-group" data-event-feed-group={id} aria-labelledby={titleId}>
      <header className="event-feed-group__header">
        <h3 id={titleId}>{label}</h3>

        <p>{description}</p>
      </header>

      <ol className="event-feed__list">
        {events.map((event) => (
          <EventCard event={event} tributes={tributes} key={event.id} />
        ))}
      </ol>
    </section>
  );
}

export function RoundEventFeed({
  events,
  tributes,
  round,
  totalPrimaryEventCount,
}: RoundEventFeedProps) {
  /*
   * Preparation events are not expected in the visible arena report,
   * but retaining this guard keeps the component safe for focused tests
   * and stale in-memory state created before migration.
   */
  const arenaEvents = events.filter((event) => event.kind !== "preparation");

  const feedRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const previousArenaEventCountRef = useRef(arenaEvents.length);
  const lastRevealedEventId = arenaEvents.at(-1)?.id ?? null;

  useEffect(() => {
    const previousEventCount = previousArenaEventCountRef.current;

    previousArenaEventCountRef.current = arenaEvents.length;

    if (arenaEvents.length <= previousEventCount || lastRevealedEventId === null) {
      return;
    }

    const eventElements = feedRef.current?.querySelectorAll<HTMLElement>("[data-event-id]");

    const newlyRevealedEvent = eventElements
      ? Array.from(eventElements).find((element) => element.dataset.eventId === lastRevealedEventId)
      : null;

    newlyRevealedEvent?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [arenaEvents.length, lastRevealedEventId, prefersReducedMotion]);

  const bloodbathGroups = BLOODBATH_EVENT_FEED_GROUPS.map((group) => ({
    ...group,

    events: arenaEvents.filter((event) => event.feedGroup === group.id),
  }));

  const hasBloodbathGroups = bloodbathGroups.some((group) => group.events.length > 0);

  /*
   * Never hide an event merely because it has no recognized feed group.
   *
   * Ordinary rounds render these events in the flat list.
   * During a grouped Bloodbath feed, they appear in an aftermath section.
   */
  const ungroupedArenaEvents = arenaEvents.filter(
    (event) => !isBloodbathEventFeedGroup(event.feedGroup),
  );

  const revealedPrimaryEventCount = arenaEvents.filter((event) => event.kind === "primary").length;
  const isDayOneBloodbath = round.day === 1 && round.period === "day";

  const emptyState = isDayOneBloodbath
    ? {
        title: "The tributes are in motion.",
        description: "Reveal the first event to see how the Bloodbath unfolds.",
      }
    : {
        title: "The arena falls silent.",
        description: "Reveal the first event to discover what happens.",
      };
  return (
    <section ref={feedRef} className="event-feed" aria-labelledby="event-feed-title">
      <header className="event-feed__header">
        <div>
          <p className="eyebrow">Arena report</p>

          <h2 id="event-feed-title">{formatRoundLabel(round)}</h2>
        </div>

        <p>
          {revealedPrimaryEventCount} of {totalPrimaryEventCount} arena events revealed
        </p>
      </header>

      {arenaEvents.length === 0 ? (
        <div className="event-feed__empty">
          <p>{emptyState.title}</p>

          <span>{emptyState.description}</span>
        </div>
      ) : hasBloodbathGroups ? (
        <div className="event-feed__groups" aria-live="polite">
          {bloodbathGroups.map((group) =>
            group.events.length > 0 ? (
              <ArenaEventGroup
                id={group.id}
                label={group.label}
                description={group.description}
                events={group.events}
                tributes={tributes}
                key={group.id}
              />
            ) : null,
          )}

          {ungroupedArenaEvents.length > 0 ? (
            <ArenaEventGroup
              id="arena-aftermath"
              label="Arena aftermath"
              description="Other consequences and developments from the opening round."
              events={ungroupedArenaEvents}
              tributes={tributes}
            />
          ) : null}
        </div>
      ) : (
        <ol className="event-feed__list" aria-live="polite">
          {arenaEvents.map((event) => (
            <EventCard event={event} tributes={tributes} key={event.id} />
          ))}
        </ol>
      )}
    </section>
  );
}
