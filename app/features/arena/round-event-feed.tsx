import type { ResolvedEvent, RoundReference } from "~/game/types/game-state";
import { formatRoundLabel } from "~/game/engine/rounds";

interface RoundEventFeedProps {
  events: readonly ResolvedEvent[];
  round: RoundReference;
  totalEventCount: number;
}

export function RoundEventFeed({ events, round, totalEventCount }: RoundEventFeedProps) {
  return (
    <section className="event-feed" aria-labelledby="event-feed-title">
      <header className="event-feed__header">
        <div>
          <p className="eyebrow">Arena report</p>

          <h2 id="event-feed-title">{formatRoundLabel(round)}</h2>
        </div>

        <p>
          {events.length} of {totalEventCount} events revealed
        </p>
      </header>

      {events.length === 0 ? (
        <div className="event-feed__empty">
          <p>The arena falls silent.</p>

          <span>Reveal the first event to discover what happens.</span>
        </div>
      ) : (
        <ol className="event-feed__list" aria-live="polite">
          {events.map((event, index) => (
            <li className="event-card" key={event.id}>
              <span className="event-card__number">{String(index + 1).padStart(2, "0")}</span>

              <p>{event.text}</p>

              {event.changes.some((change) => change.type === "eliminate-tribute") ? (
                <span className="event-card__fatal">Cannon fired</span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
