import { EventTributeAvatar } from "./event-tribute-avatar";
import { createEventCardPresentation, type EventVisualKind } from "./event-card-presentation";

import type { GameTribute, ResolvedEvent } from "~/game/types/game-state";

interface EventCardProps {
  event: ResolvedEvent;
  tributes: readonly GameTribute[];
}

interface EventTypeIconProps {
  type: EventVisualKind;
  className?: string;
}

function EventTypeIcon({ type, className = "event-card__type-icon" }: EventTypeIconProps) {
  switch (type) {
    case "combat":
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 4 6.5 6.5" />
          <path d="m13.5 12.5 6.5 6.5" />
          <path d="m19 4-6.5 6.5" />
          <path d="m10.5 13.5-6.5 6.5" />
          <path d="m4 4 3 1-2 2Z" />
          <path d="m20 4-3 1 2 2Z" />
        </svg>
      );

    case "accidental-death":
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 10a7 7 0 1 1 14 0c0 3-1.5 4.8-3.5 6v3H8.5v-3C6.5 14.8 5 13 5 10Z" />
          <circle cx="9" cy="10" r="1.2" />
          <circle cx="15" cy="10" r="1.2" />
          <path d="m10 14 2-1 2 1" />
          <path d="M10 19v2M14 19v2" />
        </svg>
      );

    case "survival":
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19.5 4.5C12 4.5 6 8 6 14.5c0 2.6 1.8 4.5 4.4 4.5 6.1 0 8.6-7.2 9.1-14.5Z" />
          <path d="M5 20c2.6-4.1 6-7.1 10.5-9.2" />
        </svg>
      );

    case "hazard":
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3 2.8 20h18.4Z" />
          <path d="M12 9v4.5" />
          <path d="M12 17h.01" />
        </svg>
      );

    case "relationship":
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="3" />
          <circle cx="16" cy="8" r="3" />
          <path d="M2.8 19c.8-3.3 2.7-5 5.2-5 1.7 0 3 .7 4 2" />
          <path d="M21.2 19c-.8-3.3-2.7-5-5.2-5-1.7 0-3 .7-4 2" />
        </svg>
      );

    case "theft":
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 9.5c2-2 4.3-3 7-3s5 1 7 3l-1.4 6.8c-1.8.8-3.7 1.2-5.6 1.2s-3.8-.4-5.6-1.2Z" />
          <path d="M8.3 12.2h2" />
          <path d="M13.7 12.2h2" />
          <path d="M9 5 7.5 3.5" />
          <path d="m15 5 1.5-1.5" />
        </svg>
      );

    case "inventory":
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4 8 8-4 8 4-8 4Z" />
          <path d="M4 8v8l8 4 8-4V8" />
          <path d="M12 12v8" />
        </svg>
      );

    case "status":
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12h4l2-5 3.2 10 2.3-6H21" />
          <path d="M12 21C6 17.5 3.5 14.5 3.5 10.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 8.5 2.5c0 4-2.5 7-8.5 10.5Z" />
        </svg>
      );

    case "special":
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m12 3 2.4 5.4L20 9l-4.2 3.8 1.2 5.7-5-2.9-5 2.9 1.2-5.7L4 9l5.6-.6Z" />
        </svg>
      );
  }
}

function SkullIcon() {
  return (
    <svg
      className="event-card__outcome-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 10a7 7 0 1 1 14 0c0 3-1.5 4.8-3.5 6v3H8.5v-3C6.5 14.8 5 13 5 10Z" />
      <circle cx="9" cy="10" r="1.2" />
      <circle cx="15" cy="10" r="1.2" />
      <path d="m10 14 2-1 2 1" />
      <path d="M10 19v2M14 19v2" />
    </svg>
  );
}

function OutcomeChevronIcon() {
  return (
    <svg
      className="event-card__outcome-chevron"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function formatNameList(names: readonly string[]): string {
  if (names.length === 0) {
    return "";
  }

  if (names.length === 1) {
    return names[0] ?? "";
  }

  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function EventCard({ event, tributes }: EventCardProps) {
  const presentation = createEventCardPresentation(event, tributes);

  const primaryWasEliminated =
    presentation.primaryTribute !== null &&
    presentation.deaths.some((death) => death.tribute?.id === presentation.primaryTribute?.id);

  const hasOutcomes =
    presentation.deaths.length > 0 ||
    presentation.statusChanges.length > 0 ||
    presentation.itemChanges.length > 0;

  return (
    <li
      className="event-card"
      data-event-kind={event.kind}
      data-event-id={event.id}
      data-event-type={presentation.visualKind}
    >
      <div
        className={[
          "event-card__main",
          presentation.primaryTributeName ? "" : "event-card__main--without-primary",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {presentation.primaryTributeName ? (
          <div className="event-card__primary">
            <EventTributeAvatar
              tribute={presentation.primaryTribute}
              fallbackName={presentation.primaryTributeName}
              size="primary"
              muted={primaryWasEliminated}
            />

            <div className="event-card__primary-identity">
              <strong>{presentation.primaryTributeName}</strong>

              {presentation.primaryTribute ? (
                <span>District {presentation.primaryTribute.district}</span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="event-card__story">
          <div className="event-card__story-header">
            <span className="event-card__type-badge">
              <EventTypeIcon type={presentation.visualKind} />

              <span>{presentation.visualLabel}</span>
            </span>
          </div>

          <p className="event-card__text">{event.text}</p>
        </div>
      </div>

      {hasOutcomes ? (
        <div className="event-card__outcomes">
          {presentation.deaths.length > 0 ? (
            <details className="event-card__outcome-drawer" data-outcome-kind="deaths">
              <summary className="event-card__outcome-summary">
                <SkullIcon />
                <span className="event-card__outcome-summary-label">Deaths</span>
                <span className="event-card__outcome-count">{presentation.deaths.length}</span>
                <OutcomeChevronIcon />
              </summary>

              <div className="event-card__outcome-body">
                <div className="event-card__death-grid">
                  {presentation.deaths.map((death) => (
                    <article
                      className="event-card__death"
                      data-event-death-id={death.tribute?.id ?? "unknown"}
                      key={death.key}
                    >
                      <EventTributeAvatar
                        tribute={death.tribute}
                        fallbackName={death.tributeName}
                        muted
                      />

                      <div className="event-card__death-copy">
                        <strong>{death.tributeName}</strong>
                        <span>{death.causeLabel}</span>

                        {death.killerNames.length > 0 ? (
                          <small>Killed by {formatNameList(death.killerNames)}</small>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </details>
          ) : null}

          {presentation.statusChanges.length > 0 ? (
            <details className="event-card__outcome-drawer" data-outcome-kind="statuses">
              <summary className="event-card__outcome-summary">
                <EventTypeIcon type="status" className="event-card__outcome-icon" />
                <span className="event-card__outcome-summary-label">Status changes</span>
                <span className="event-card__outcome-count">
                  {presentation.statusChanges.length}
                </span>
                <OutcomeChevronIcon />
              </summary>

              <div className="event-card__outcome-body">
                <div className="event-card__status-list">
                  {presentation.statusChanges.map((statusChange) => (
                    <div
                      className="event-card__status-change"
                      data-status-tone={statusChange.tone}
                      key={statusChange.key}
                      title={statusChange.description}
                    >
                      <EventTributeAvatar
                        tribute={statusChange.tribute}
                        fallbackName={statusChange.tributeName}
                      />

                      <div className="event-card__status-copy">
                        <strong>{statusChange.tributeName}</strong>

                        <span>
                          {statusChange.action === "removed"
                            ? `${statusChange.label} cleared`
                            : statusChange.label}
                        </span>
                      </div>

                      <span className="event-card__status-meta">{statusChange.meta}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ) : null}

          {presentation.itemChanges.length > 0 ? (
            <details className="event-card__outcome-drawer" data-outcome-kind="items">
              <summary className="event-card__outcome-summary">
                <EventTypeIcon type="inventory" className="event-card__outcome-icon" />
                <span className="event-card__outcome-summary-label">Item changes</span>
                <span className="event-card__outcome-count">{presentation.itemChanges.length}</span>
                <OutcomeChevronIcon />
              </summary>

              <div className="event-card__outcome-body">
                <div className="event-card__item-list">
                  {presentation.itemChanges.map((itemChange) =>
                    itemChange.kind === "acquired" ? (
                      <div className="event-card__item-acquisition" key={itemChange.key}>
                        <EventTributeAvatar
                          tribute={itemChange.tribute}
                          fallbackName={itemChange.tributeName}
                        />

                        <div className="event-card__item-copy">
                          <strong>{itemChange.tributeName}</strong>

                          <span>
                            Acquired <b>{itemChange.itemLabel}</b>
                          </span>
                        </div>

                        <span className="event-card__item-source">{itemChange.sourceLabel}</span>
                      </div>
                    ) : (
                      <div
                        className="event-card__item-transfer"
                        data-transfer-kind={itemChange.kind}
                        key={itemChange.key}
                      >
                        <div className="event-card__transfer-person">
                          <EventTributeAvatar
                            tribute={itemChange.fromTribute}
                            fallbackName={itemChange.fromTributeName}
                          />

                          <span>{itemChange.fromTributeName}</span>
                        </div>

                        <div className="event-card__transfer-action">
                          {itemChange.kind === "stolen" ? (
                            <EventTypeIcon type="theft" className="event-card__transfer-icon" />
                          ) : null}

                          <span>{itemChange.kind === "stolen" ? "Stolen" : "Transferred"}</span>

                          <strong>{itemChange.itemLabel}</strong>
                          <span aria-hidden="true">→</span>
                        </div>

                        <div className="event-card__transfer-person event-card__transfer-person--recipient">
                          <EventTributeAvatar
                            tribute={itemChange.toTribute}
                            fallbackName={itemChange.toTributeName}
                          />

                          <span>{itemChange.toTributeName}</span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
