import { formatRoundLabel } from "~/game/engine/rounds";

import {
  createPreparationFeedPresentation,
  type PreparationEventPresentation,
} from "~/game/survival/preparation-presentation";

import type { GameTribute, ResolvedEvent, RoundReference } from "~/game/types/game-state";

interface RoundEventFeedProps {
  events: readonly ResolvedEvent[];
  round: RoundReference;
  totalPrimaryEventCount: number;
  tributes: readonly GameTribute[];
}

interface PreparationEventCardProps {
  event: PreparationEventPresentation;
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

export function RoundEventFeed({
  events,
  round,
  totalPrimaryEventCount,
  tributes,
}: RoundEventFeedProps) {
  const preparationEvents = events.filter((event) => event.kind === "preparation");

  const preparationGroups = createPreparationFeedPresentation(preparationEvents, tributes);

  const arenaEvents = events.filter((event) => event.kind !== "preparation");

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
      ) : (
        <ol className="event-feed__list" aria-live="polite">
          {arenaEvents.map((event, index) => (
            <ArenaEventCard event={event} index={index} key={event.id} />
          ))}
        </ol>
      )}
    </section>
  );
}
