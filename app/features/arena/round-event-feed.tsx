import { formatRoundLabel } from "~/game/engine/rounds";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { GameTribute, ResolvedEvent, RoundReference } from "~/game/types/game-state";

interface RoundEventFeedProps {
  events: readonly ResolvedEvent[];
  round: RoundReference;
  totalPrimaryEventCount: number;
  tributes: readonly GameTribute[];
}

function getTributeName(tributes: readonly GameTribute[], tributeId: string): string {
  return tributes.find((tribute) => tribute.id === tributeId)?.snapshot.name ?? tributeId;
}

function formatNeed(need: "food" | "water"): string {
  return need === "water" ? "Hydration" : "Food";
}

function formatRestQuality(quality: "comfortable" | "sheltered" | "unsheltered"): string {
  return quality.charAt(0).toUpperCase() + quality.slice(1);
}

function getRemainingUsesLabel(usesRemaining: number | null | undefined): string | null {
  if (usesRemaining === undefined) {
    return null;
  }

  if (usesRemaining === null) {
    return "Reusable";
  }

  return `${usesRemaining} ` + `${usesRemaining === 1 ? "use" : "uses"} remaining`;
}

interface PreparationEventCardProps {
  event: ResolvedEvent;
  tributes: readonly GameTribute[];
}

function PreparationEventCard({ event, tributes }: PreparationEventCardProps) {
  const details = event.preparation;

  if (!details) {
    return (
      <li className="preparation-card" data-event-kind={event.kind}>
        <p>{event.text}</p>
      </li>
    );
  }

  const actingName = getTributeName(tributes, details.actingTributeId);

  const itemLabel = details.itemDefinitionId
    ? getItemDefinition(details.itemDefinitionId).label
    : null;

  const ownerName = details.itemOwnerTributeId
    ? getTributeName(tributes, details.itemOwnerTributeId)
    : null;

  const isBorrowed =
    details.itemOwnerTributeId !== undefined &&
    details.itemOwnerTributeId !== details.actingTributeId;

  const remainingUsesLabel = getRemainingUsesLabel(details.usesRemainingAfter);

  const affectedStatusLabels =
    details.affectedStatusIds?.map((statusId) => getStatusDefinition(statusId).label) ?? [];

  return (
    <li className="preparation-card" data-event-kind={event.kind}>
      <div className="preparation-card__body">
        <strong>{actingName}</strong>

        <p>{event.text}</p>
      </div>

      <ul className="preparation-card__details" aria-label={`${actingName} preparation details`}>
        {itemLabel ? <li>Item: {itemLabel}</li> : null}

        {isBorrowed && ownerName ? <li>Borrowed from: {ownerName}</li> : null}

        {remainingUsesLabel ? <li>{remainingUsesLabel}</li> : null}

        {details.affectedNeed ? <li>Need: {formatNeed(details.affectedNeed)}</li> : null}

        {affectedStatusLabels.length > 0 ? (
          <li>Statuses: {affectedStatusLabels.join(", ")}</li>
        ) : null}

        {details.restQuality ? <li>Rest: {formatRestQuality(details.restQuality)}</li> : null}
      </ul>
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

      {preparationEvents.length > 0 ? (
        <section className="preparation-feed" aria-labelledby="preparation-feed-title">
          <header className="preparation-feed__header">
            <p className="eyebrow">Before the round</p>

            <h3 id="preparation-feed-title">Before the round</h3>
          </header>

          <ol className="preparation-feed__list">
            {preparationEvents.map((event) => (
              <PreparationEventCard event={event} tributes={tributes} key={event.id} />
            ))}
          </ol>
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
