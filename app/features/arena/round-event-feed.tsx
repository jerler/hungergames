import { formatRoundLabel } from "~/game/engine/rounds";

import {
  createPreparationFeedPresentation,
  type PreparationEventPresentation,
} from "~/game/survival/preparation-presentation";

import type {
  EventFeedGroup,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";

interface RoundEventFeedProps {
  events: readonly ResolvedEvent[];
  round: RoundReference;
  totalPrimaryEventCount: number;
  tributes: readonly GameTribute[];
}

interface PreparationEventCardProps {
  event: PreparationEventPresentation;
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

function PreparationEventCard({ event }: PreparationEventCardProps) {
  return (
    <li className="preparation-card" data-impact-tone={event.impactTone}>
      <div className="preparation-card__body">
        <strong>{event.actingTributeName}</strong>

        <p>{event.text}</p>
      </div>

      {event.itemLabel || event.borrowedFromLabel || event.remainingUsesLabel ? (
        <ul
          className="preparation-card__details"
          aria-label={`${event.actingTributeName} preparation items`}
        >
          {event.itemLabel ? <li>Item: {event.itemLabel}</li> : null}

          {event.borrowedFromLabel ? <li>Borrowed from: {event.borrowedFromLabel}</li> : null}

          {event.remainingUsesLabel ? <li>{event.remainingUsesLabel}</li> : null}
        </ul>
      ) : null}

      {event.impactDetails.length > 0 ? (
        <ul
          className="preparation-card__impact"
          aria-label={`${event.actingTributeName} preparation impact`}
        >
          {event.impactDetails.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
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

export function RoundEventFeed({
  events,
  round,
  totalPrimaryEventCount,
  tributes,
}: RoundEventFeedProps) {
  const preparationEvents = events.filter((event) => event.kind === "preparation");

  const preparationGroups = createPreparationFeedPresentation(preparationEvents, tributes);

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

      {preparationGroups.length > 0 ? (
        <section className="preparation-feed" aria-labelledby="preparation-feed-title">
          <header className="preparation-feed__header">
            <p className="eyebrow">Before the round</p>

            <h3 id="preparation-feed-title">Before the round</h3>
          </header>

          <div className="preparation-feed__groups">
            {preparationGroups.map((group) => {
              const titleId = `preparation-group-${group.id}-title`;

              return (
                <section
                  className="preparation-group"
                  data-preparation-group={group.id}
                  aria-labelledby={titleId}
                  key={group.id}
                >
                  <header className="preparation-group__header">
                    <h4 id={titleId}>{group.label}</h4>

                    <p>{group.description}</p>
                  </header>

                  <ol className="preparation-group__list">
                    {group.events.map((event) => (
                      <PreparationEventCard event={event} key={event.id} />
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
        </section>
      ) : null}

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
