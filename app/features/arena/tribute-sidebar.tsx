import { formatRoundLabel } from "~/game/engine/rounds";
import { getActiveStatuses } from "~/game/statuses/status-selectors";
import {
  createStatusPresentation,
  type StatusPresentationTone,
} from "~/game/statuses/status-presentation";
import { createRestPresentation } from "~/game/survival/rest-presentation";
import type { GameTribute, StatusEffect, TributeDeath } from "~/game/types/game-state";

import { StatusIcon } from "./status-icon";

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

function getStatusBadgeTone(
  status: StatusEffect,
  presentationTone: StatusPresentationTone,
  isFatal: boolean,
): StatusPresentationTone {
  if (isFatal || presentationTone === "beneficial") {
    return presentationTone;
  }

  if (status.severity >= 3) {
    return "critical";
  }

  if (status.severity === 2) {
    return "warning";
  }

  return "temporary";
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

                {tribute.isAlive && statusPresentations.length > 0 ? (
                  <ul
                    className="sidebar-tribute__status-icons"
                    aria-label={`${tribute.snapshot.name} active statuses`}
                  >
                    {statusPresentations.map(({ status, details }, statusIndex) => {
                      const statusTooltipId = `${tribute.id}-status-${statusIndex}-tooltip`;

                      const isFatal = Boolean(details.fatalCauseLabel && details.fatalConsequence);

                      const badgeTone = getStatusBadgeTone(status, details.tone, isFatal);

                      const isImminentFatal =
                        isFatal && status.remainingRounds !== null && status.remainingRounds <= 1;

                      return (
                        <li
                          className="sidebar-tribute__status-entry"
                          key={status.id}
                          data-status-id={status.definitionId}
                        >
                          <button
                            className="sidebar-tribute__status-badge"
                            type="button"
                            data-status-tone={badgeTone}
                            data-status-kind={
                              details.tone === "beneficial" ? "beneficial" : "harmful"
                            }
                            data-status-severity={status.severity}
                            data-imminent-fatal={isImminentFatal || undefined}
                            aria-label={
                              `${details.label}. ${details.kindLabel}. ` +
                              `${details.severityLabel}. ` +
                              `${details.durationLabel}. ` +
                              `${details.lifecycleSummary}`
                            }
                            aria-describedby={statusTooltipId}
                          >
                            <StatusIcon statusId={status.definitionId} />

                            <span className="sidebar-tribute__status-severity" aria-hidden="true">
                              {[1, 2, 3].map((severityLevel) => (
                                <span
                                  className={
                                    severityLevel <= status.severity
                                      ? "sidebar-tribute__status-severity-mark sidebar-tribute__status-severity-mark--active"
                                      : "sidebar-tribute__status-severity-mark"
                                  }
                                  key={severityLevel}
                                />
                              ))}
                            </span>
                          </button>

                          <div
                            className="sidebar-tribute__status-tooltip"
                            id={statusTooltipId}
                            role="tooltip"
                            data-status-tone={badgeTone}
                          >
                            <div className="sidebar-tribute__status-tooltip-header">
                              <strong>{details.label}</strong>
                              <span>{details.durationLabel}</span>
                            </div>

                            <span className="sidebar-tribute__status-tooltip-classification">
                              {details.kindLabel}
                              {" · "}
                              {details.severityLabel}
                            </span>

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
                        </li>
                      );
                    })}
                  </ul>
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
            </article>
          );
        })}
      </div>
    </aside>
  );
}
