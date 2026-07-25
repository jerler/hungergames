import { formatRoundLabel } from "~/game/engine/rounds";

import type { EventFeedGroup, ResolvedEvent, RoundReference } from "~/game/types/game-state";

interface RoundEventFeedProps {
  events: readonly ResolvedEvent[];
  round: RoundReference;
  totalPrimaryEventCount: number;
}

interface IndexedArenaEvent {
  event: ResolvedEvent;
  index: number;
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
    label: "Ran for the Cornucopia",
    description: "These tributes risked the opening Bloodbath for weapons and supplies.",
  },
  {
    id: "bloodbath-flee",
    label: "Ran for the trees",
    description: "These tributes abandoned the Cornucopia and fled into the arena.",
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

interface ArenaEventCardProps {
  event: ResolvedEvent;
  index: number;
}

function ArenaEventCard({ event, index }: ArenaEventCardProps) {
  const eliminations = event.changes.filter((change) => change.type === "eliminate-tribute");

  const cannonAnnouncement =
    eliminations.length === 1 ? "1 cannon fired" : `${eliminations.length} cannons fired`;

  return (
    <li className="event-card" data-event-kind={event.kind}>
      <span className="event-card__number">{String(index + 1).padStart(2, "0")}</span>

      <p>{event.text}</p>

      {eliminations.length > 0 ? (
        <div className="event-card__fatalities" role="group" aria-label={cannonAnnouncement}>
          {eliminations.map((elimination) => (
            <span className="event-card__fatal" key={elimination.tributeId} aria-hidden="true">
              Cannon fired
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

interface ArenaEventGroupProps {
  id: ArenaEventGroupId;
  label: string;
  description: string;
  events: readonly IndexedArenaEvent[];
}

function ArenaEventGroup({ id, label, description, events }: ArenaEventGroupProps) {
  const titleId = `event-feed-group-${id}-title`;

  return (
    <section className="event-feed-group" data-event-feed-group={id} aria-labelledby={titleId}>
      <header className="event-feed-group__header">
        <h3 id={titleId}>{label}</h3>

        <p>{description}</p>
      </header>

      <ol className="event-feed__list">
        {events.map(({ event, index }) => (
          <ArenaEventCard event={event} index={index} key={event.id} />
        ))}
      </ol>
    </section>
  );
}

export function RoundEventFeed({ events, round, totalPrimaryEventCount }: RoundEventFeedProps) {
  /*
   * Preparation events are not expected after Phase 2, but retaining
   * this boundary guard keeps the component safe for focused tests
   * and stale in-memory state created before migration.
   */
  const arenaEvents = events.filter((event) => event.kind !== "preparation");

  const indexedArenaEvents = arenaEvents.map((event, index) => ({
    event,
    index,
  }));

  const bloodbathGroups = BLOODBATH_EVENT_FEED_GROUPS.map((group) => ({
    ...group,

    events: indexedArenaEvents.filter(({ event }) => event.feedGroup === group.id),
  }));

  const hasBloodbathGroups = bloodbathGroups.some((group) => group.events.length > 0);

  /*
   * Never hide an event merely because it has no recognized feed group.
   *
   * Ordinary rounds render these events in the existing flat list.
   * During a grouped Bloodbath feed, they appear in an aftermath section.
   */
  const ungroupedArenaEvents = indexedArenaEvents.filter(
    ({ event }) => !isBloodbathEventFeedGroup(event.feedGroup),
  );

  const revealedPrimaryEventCount = arenaEvents.filter((event) => event.kind === "primary").length;

  return (
    <section className="event-feed" aria-labelledby="event-feed-title">
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
          <p>The arena falls silent.</p>

          <span>Reveal the first event to discover what happens.</span>
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
            />
          ) : null}
        </div>
      ) : (
        <ol className="event-feed__list" aria-live="polite">
          {indexedArenaEvents.map(({ event, index }) => (
            <ArenaEventCard event={event} index={index} key={event.id} />
          ))}
        </ol>
      )}
    </section>
  );
}
