import { formatRoundLabel } from "~/game/engine/rounds";
import { getActiveStatuses } from "~/game/statuses/status-selectors";
import { createStatusPresentation } from "~/game/statuses/status-presentation";
import { createRestPresentation } from "~/game/survival/rest-presentation";
import type { GameTribute, TributeDeath } from "~/game/types/game-state";

interface TributeSidebarProps {
  tributes: readonly GameTribute[];
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatNameList(names: readonly string[]): string {
  if (names.length === 0) {
    return "";
  }

  if (names.length === 1) {
    return names[0];
  }

  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function getKillerNames(death: TributeDeath, tributes: readonly GameTribute[]): string[] {
  return death.killerTributeIds
    .map((killerId) => tributes.find((tribute) => tribute.id === killerId)?.snapshot.name)
    .filter((name): name is string => Boolean(name));
}

export function TributeSidebar({ tributes }: TributeSidebarProps) {
  const sortedTributes = [...tributes].sort(
    (firstTribute, secondTribute) =>
      firstTribute.district - secondTribute.district ||
      firstTribute.districtPosition - secondTribute.districtPosition,
  );

  const tributeNameById = new Map(
    sortedTributes.map((tribute) => [tribute.id, tribute.snapshot.name]),
  );

  const livingCount = sortedTributes.filter((tribute) => tribute.isAlive).length;

  return (
    <aside className="tribute-sidebar" aria-labelledby="tribute-sidebar-title">
      <header className="tribute-sidebar__header">
        <div>
          <p className="eyebrow">The tributes</p>
          <h2 id="tribute-sidebar-title">{livingCount} remaining</h2>
        </div>

        <span>{sortedTributes.length} entered</span>
      </header>

      <div className="tribute-sidebar__grid">
        {sortedTributes.map((tribute) => {
          const death = tribute.death;

          const statusPresentations = getActiveStatuses(tribute).map((status) => ({
            status,
            details: createStatusPresentation(status, {
              sourceTributeName: status.sourceTributeId
                ? tributeNameById.get(status.sourceTributeId)
                : null,
            }),
          }));

          const restPresentation =
            tribute.isAlive && tribute.survival.lastNightRest
              ? createRestPresentation(tribute.survival.lastNightRest)
              : null;

          const killerNames = death ? getKillerNames(death, sortedTributes) : [];

          const deathTooltipId = `${tribute.id}-death-tooltip`;

          return (
            <article
              className={["sidebar-tribute", tribute.isAlive ? "" : "sidebar-tribute--dead"]
                .filter(Boolean)
                .join(" ")}
              key={tribute.id}
              aria-label={
                `${tribute.snapshot.name}, District ${tribute.district}, ` +
                (tribute.isAlive
                  ? "alive"
                  : `eliminated ${death ? formatRoundLabel(death.round) : ""}`)
              }
            >
              <div className="sidebar-tribute__portrait">
                <div className="sidebar-tribute__portrait-media">
                  {tribute.snapshot.portraitUrl ? (
                    <img
                      src={tribute.snapshot.portraitUrl}
                      alt=""
                      style={{
                        objectPosition:
                          `${tribute.snapshot.portraitPosition?.x ?? 50}% ` +
                          `${tribute.snapshot.portraitPosition?.y ?? 50}%`,
                      }}
                    />
                  ) : (
                    <span aria-hidden="true">{getInitials(tribute.snapshot.name)}</span>
                  )}
                </div>

                {death ? (
                  <div className="sidebar-tribute__indicator sidebar-tribute__indicator--top">
                    <button
                      className="sidebar-tribute__bar sidebar-tribute__death"
                      type="button"
                      aria-label={`${death.causeLabel}. ${death.summary}`}
                      aria-describedby={deathTooltipId}
                    >
                      <strong>{formatRoundLabel(death.round)}</strong>
                      <span>{death.causeLabel}</span>
                    </button>

                    <div className="sidebar-tribute__tooltip" id={deathTooltipId} role="tooltip">
                      <strong>
                        {killerNames.length > 0
                          ? `${death.causeLabel} by ${formatNameList(killerNames)}`
                          : death.causeLabel}
                      </strong>

                      <p>{death.summary}</p>
                      <span>{formatRoundLabel(death.round)}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="sidebar-tribute__identity">
                <strong>{tribute.snapshot.name}</strong>
                <span>District {tribute.district}</span>

                {restPresentation ? (
                  <span
                    className={[
                      "sidebar-tribute__rest",
                      `sidebar-tribute__rest--${restPresentation.tone}`,
                    ].join(" ")}
                    aria-label={restPresentation.summary}
                  >
                    {restPresentation.label}
                    {" · "}
                    {restPresentation.roundLabel}
                  </span>
                ) : null}
              </div>

              {tribute.isAlive && statusPresentations.length > 0 ? (
                <ul
                  className="sidebar-tribute__statuses"
                  aria-label={`${tribute.snapshot.name} active statuses`}
                >
                  {statusPresentations.map(({ status, details }, statusIndex) => {
                    const statusDetailsId = `${tribute.id}-status-${statusIndex}-details`;

                    const effectDescription =
                      details.effectSummaries.length > 0
                        ? ` Gameplay effects: ${details.effectSummaries.join(" ")}`
                        : "";

                    return (
                      <li key={status.id} data-status-id={status.definitionId}>
                        <details
                          className="sidebar-tribute__status-card"
                          data-status-tone={details.tone}
                        >
                          <summary
                            aria-label={
                              `${details.label}. ${details.kindLabel}. ` +
                              `${details.severityLabel}. ` +
                              `${details.lifecycleSummary} ` +
                              `${details.description}${effectDescription}`
                            }
                            aria-describedby={statusDetailsId}
                          >
                            <span className="sidebar-tribute__status-summary-main">
                              <strong>{details.label}</strong>
                              <span>{details.durationLabel}</span>
                            </span>

                            <span className="sidebar-tribute__status-classification">
                              {details.kindLabel}
                              {" · "}
                              {details.severityLabel}
                            </span>
                          </summary>

                          <div className="sidebar-tribute__status-details" id={statusDetailsId}>
                            <p>{details.description}</p>

                            <div className="sidebar-tribute__status-meta">
                              <span>{details.appliedRoundLabel}</span>

                              {details.sourceLabel ? <span>{details.sourceLabel}</span> : null}

                              <span>{details.lifecycleSummary}</span>
                            </div>

                            {details.effectSummaries.length > 0 ? (
                              <div className="sidebar-tribute__status-effects">
                                <span>Gameplay effects</span>

                                {details.effectSummaries.map((summary) => (
                                  <span key={summary}>{summary}</span>
                                ))}
                              </div>
                            ) : null}

                            {details.fatalCauseLabel && details.fatalConsequence ? (
                              <div className="sidebar-tribute__status-fatality">
                                <span>Fatal outcome: {details.fatalCauseLabel}</span>
                                <span>{details.fatalConsequence}</span>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
