import { formatRoundLabel } from "~/game/engine/rounds";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { GameTribute, StatusEffect, TributeDeath } from "~/game/types/game-state";

interface TributeSidebarProps {
  tributes: readonly GameTribute[];
}

type StatusUrgency = "critical" | "warning" | "stable";

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getStatusUrgency(remainingRounds: number): StatusUrgency {
  if (remainingRounds <= 1) {
    return "critical";
  }

  if (remainingRounds === 2) {
    return "warning";
  }

  return "stable";
}

function compareStatusesByUrgency(firstStatus: StatusEffect, secondStatus: StatusEffect): number {
  return (
    firstStatus.remainingRounds - secondStatus.remainingRounds ||
    secondStatus.severity - firstStatus.severity ||
    firstStatus.definitionId.localeCompare(secondStatus.definitionId)
  );
}

function formatRoundCount(roundCount: number): string {
  return `${roundCount} ${roundCount === 1 ? "round" : "rounds"}`;
}

function formatFatalCountdown(remainingRounds: number): string {
  if (remainingRounds <= 1) {
    return "Fatal at the end of the next " + "round if untreated.";
  }

  return `Fatal in ${remainingRounds} rounds ` + "if untreated.";
}

function formatNameList(names: readonly string[]): string {
  if (names.length === 0) {
    return "";
  }

  if (names.length === 1) {
    return names[0];
  }

  return `${names.slice(0, -1).join(", ")} ` + `and ${names[names.length - 1]}`;
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

          const statuses = [...tribute.statuses].sort(compareStatusesByUrgency);

          const primaryStatus = statuses[0] ?? null;

          const primaryDefinition = primaryStatus
            ? getStatusDefinition(primaryStatus.definitionId)
            : null;

          const statusUrgency = primaryStatus
            ? getStatusUrgency(primaryStatus.remainingRounds)
            : null;

          const additionalStatusCount = Math.max(0, statuses.length - 1);

          const killerNames = death ? getKillerNames(death, sortedTributes) : [];

          const deathTooltipId = `${tribute.id}-death-tooltip`;

          const statusTooltipId = `${tribute.id}-status-tooltip`;

          return (
            <article
              className={["sidebar-tribute", tribute.isAlive ? "" : "sidebar-tribute--dead"]
                .filter(Boolean)
                .join(" ")}
              key={tribute.id}
              aria-label={`${tribute.snapshot.name}, District ${tribute.district}, ${
                tribute.isAlive
                  ? "alive"
                  : `eliminated ${death ? formatRoundLabel(death.round) : ""}`
              }`}
            >
              <div className="sidebar-tribute__portrait">
                <div className="sidebar-tribute__portrait-media">
                  {tribute.snapshot.portraitUrl ? (
                    <img
                      src={tribute.snapshot.portraitUrl}
                      alt=""
                      style={{
                        objectPosition: `${
                          tribute.snapshot
                            .portraitPosition?.x ?? 50
                        }% ${
                          tribute.snapshot
                            .portraitPosition?.y ?? 50
                        }%`,
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

                {tribute.isAlive && primaryStatus && primaryDefinition && statusUrgency ? (
                  <div className="sidebar-tribute__indicator sidebar-tribute__indicator--bottom">
                    <button
                      className={[
                        "sidebar-tribute__bar",
                        "sidebar-tribute__status",
                        `sidebar-tribute__status--${statusUrgency}`,
                      ].join(" ")}
                      type="button"
                      aria-label={`${primaryDefinition.label}. ${formatFatalCountdown(
                        primaryStatus.remainingRounds,
                      )}`}
                      aria-describedby={statusTooltipId}
                    >
                      <strong>{primaryDefinition.label}</strong>

                      <span>
                        {formatRoundCount(primaryStatus.remainingRounds)}

                        {additionalStatusCount > 0 ? ` · +${additionalStatusCount}` : ""}
                      </span>
                    </button>

                    <div
                      className="sidebar-tribute__tooltip sidebar-tribute__tooltip--statuses"
                      id={statusTooltipId}
                      role="tooltip"
                    >
                      <ul>
                        {statuses.map((status) => {
                          const definition = getStatusDefinition(status.definitionId);

                          return (
                            <li key={status.id}>
                              <strong>{definition.label}</strong>

                              <p>{definition.description}</p>

                              <span>Received during {formatRoundLabel(status.appliedRound)}.</span>

                              <span>{formatFatalCountdown(status.remainingRounds)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="sidebar-tribute__identity">
                <strong>{tribute.snapshot.name}</strong>

                <span>District {tribute.district}</span>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
