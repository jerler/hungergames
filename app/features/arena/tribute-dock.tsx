// Generated tribute dock: compact roster, fallen reserve, and relationships.
import { Fragment, type CSSProperties, useEffect, useRef, useState } from "react";

import { getActiveStatuses } from "~/game/statuses/status-selectors";
import { createStatusPresentation } from "~/game/statuses/status-presentation";
import type { GameTribute, Truce } from "~/game/types/game-state";

import { StatusIcon } from "./status-icon";

interface TributeDockProps {
  tributes: readonly GameTribute[];
  truces: readonly Truce[];
}

interface TributePortraitProps {
  tribute: GameTribute;
  tributeNameById: ReadonlyMap<string, string>;
  fallen?: boolean;
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function compareTributes(first: GameTribute, second: GameTribute): number {
  return first.district - second.district || first.districtPosition - second.districtPosition;
}

function compareFallenTributes(first: GameTribute, second: GameTribute): number {
  const firstDay = first.death?.round.day ?? Number.MAX_SAFE_INTEGER;
  const secondDay = second.death?.round.day ?? Number.MAX_SAFE_INTEGER;

  return (
    firstDay - secondDay ||
    (first.death?.round.period === "day" ? 0 : 1) -
      (second.death?.round.period === "day" ? 0 : 1) ||
    compareTributes(first, second)
  );
}

function ChainIcon() {
  return (
    <svg
      className="tribute-dock__relationship-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.5 14.5 14.5 9.5" />
      <path
        d="M7.2 17.8 5.6 19.4a3.5 3.5 0 0 1-5-5l3.6-3.6a3.5 3.5 0 0 1 5 0"
        transform="translate(3 -3)"
      />
      <path
        d="m16.8 6.2 1.6-1.6a3.5 3.5 0 1 1 5 5l-3.6 3.6a3.5 3.5 0 0 1-5 0"
        transform="translate(-3 3)"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      className="tribute-dock__relationship-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 21C7.3 17.5 3 14.2 3 9.2A4.7 4.7 0 0 1 7.8 4.5c1.9 0 3.4 1 4.2 2.3a5 5 0 0 1 4.2-2.3A4.7 4.7 0 0 1 21 9.2c0 5-4.3 8.3-9 11.8Z" />
    </svg>
  );
}

function TributePortrait({ tribute, tributeNameById, fallen = false }: TributePortraitProps) {
  const statusPresentations = fallen
    ? []
    : getActiveStatuses(tribute).map((status) => ({
        status,
        details: createStatusPresentation(status, {
          sourceTributeName: status.sourceTributeId
            ? tributeNameById.get(status.sourceTributeId)
            : null,
        }),
      }));

  const accessibleLabel = fallen
    ? `${tribute.snapshot.name}. Eliminated${tribute.death ? `: ${tribute.death.causeLabel}` : ""}.`
    : `${tribute.snapshot.name}, District ${tribute.district}, alive.`;

  return (
    <li
      className={["tribute-dock__tribute", fallen ? "tribute-dock__tribute--fallen" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <div className="tribute-dock__portrait">
        {tribute.snapshot.portraitUrl ? (
          <img
            src={tribute.snapshot.portraitUrl}
            alt=""
            style={{
              objectPosition: `${tribute.snapshot.portraitPosition?.x ?? 50}% ${tribute.snapshot.portraitPosition?.y ?? 50}%`,
            }}
          />
        ) : (
          <span aria-hidden="true">{getInitials(tribute.snapshot.name)}</span>
        )}

        {statusPresentations.length > 0 ? (
          <ul
            className="tribute-dock__statuses"
            aria-label={`${tribute.snapshot.name} active statuses`}
          >
            {statusPresentations.map(({ status, details }) => (
              <li
                className="tribute-dock__status"
                data-status-tone={details.tone}
                key={status.id}
                aria-label={`${details.label}. ${details.severityLabel}. ${details.durationLabel}.`}
                title={`${details.label} · ${details.severityLabel} · ${details.durationLabel}`}
              >
                <StatusIcon statusId={status.definitionId} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <span className="tribute-dock__name">{tribute.snapshot.name}</span>
    </li>
  );
}

export function TributeDock({ tributes, truces }: TributeDockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedHeight, setExpandedHeight] = useState<number | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const autoCollapseThresholdRef = useRef<number | null>(null);
  const manualOverrideRef = useRef<"expanded" | "collapsed" | null>(null);
  const wasPastCollapseThresholdRef = useRef(false);

  const sortedTributes = [...tributes].sort(compareTributes);
  const livingTributes = sortedTributes.filter((tribute) => tribute.isAlive);
  const fallenTributes = sortedTributes
    .filter((tribute) => !tribute.isAlive)
    .sort(compareFallenTributes);

  const tributeById = new Map(sortedTributes.map((tribute) => [tribute.id, tribute]));
  const tributeNameById = new Map(
    sortedTributes.map((tribute) => [tribute.id, tribute.snapshot.name]),
  );

  const visibleRelationships = truces
    .map((truce) => ({
      truce,
      tributes: truce.tributeIds
        .map((tributeId) => tributeById.get(tributeId))
        .filter((tribute): tribute is GameTribute => Boolean(tribute?.isAlive))
        .sort(compareTributes),
    }))
    .filter(({ tributes: relatedTributes }) => relatedTributes.length >= 2);

  const relationshipByTributeId = new Map<string, (typeof visibleRelationships)[number]>();

  for (const relationship of visibleRelationships) {
    for (const tribute of relationship.tributes) {
      if (!relationshipByTributeId.has(tribute.id)) {
        relationshipByTributeId.set(tribute.id, relationship);
      }
    }
  }

  const renderedLivingTributeIds = new Set<string>();

  const livingRosterGroups: Array<{
    relationship: (typeof visibleRelationships)[number] | null;
    tributes: readonly GameTribute[];
  }> = [];

  for (const tribute of livingTributes) {
    if (renderedLivingTributeIds.has(tribute.id)) {
      continue;
    }

    const relationship = relationshipByTributeId.get(tribute.id) ?? null;

    if (!relationship) {
      renderedLivingTributeIds.add(tribute.id);
      livingRosterGroups.push({
        relationship: null,
        tributes: [tribute],
      });
      continue;
    }

    const groupedTributes = relationship.tributes.filter(
      (relatedTribute) => !renderedLivingTributeIds.has(relatedTribute.id),
    );

    if (groupedTributes.length < 2) {
      renderedLivingTributeIds.add(tribute.id);
      livingRosterGroups.push({
        relationship: null,
        tributes: [tribute],
      });
      continue;
    }

    for (const groupedTribute of groupedTributes) {
      renderedLivingTributeIds.add(groupedTribute.id);
    }

    livingRosterGroups.push({
      relationship,
      tributes: groupedTributes,
    });
  }

  const livingProfileSize =
    livingTributes.length <= 5 ? "largest" : livingTributes.length <= 10 ? "large" : "default";

  const fallenColumnCount = Math.max(1, fallenTributes.length);

  const dockStyle = {
    "--fallen-columns": fallenColumnCount,
  } as CSSProperties;

  const spacerStyle =
    expandedHeight === null
      ? undefined
      : ({
          height: `${expandedHeight}px`,
        } satisfies CSSProperties);

  useEffect(() => {
    const dock = dockRef.current;

    if (!dock || !isExpanded || typeof window === "undefined") {
      return;
    }

    const measureExpandedDock = () => {
      const measuredHeight = Math.ceil(dock.getBoundingClientRect().height);

      if (measuredHeight <= 0) {
        return;
      }

      setExpandedHeight((currentHeight) =>
        currentHeight === measuredHeight ? currentHeight : measuredHeight,
      );
    };

    measureExpandedDock();

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureExpandedDock);

    resizeObserver?.observe(dock);
    window.addEventListener("resize", measureExpandedDock);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureExpandedDock);
    };
  }, [fallenTributes.length, isExpanded, livingTributes.length, visibleRelationships.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || typeof window === "undefined") {
      return;
    }

    autoCollapseThresholdRef.current = sentinel.getBoundingClientRect().top + window.scrollY;

    const updateDockForScrollPosition = () => {
      const collapseThreshold = autoCollapseThresholdRef.current;

      if (collapseThreshold === null) {
        return;
      }

      const isPastCollapseThreshold = window.scrollY > collapseThreshold + 24;

      if (!isPastCollapseThreshold) {
        if (wasPastCollapseThresholdRef.current) {
          manualOverrideRef.current = null;
        }

        wasPastCollapseThresholdRef.current = false;

        setIsExpanded(manualOverrideRef.current === "collapsed" ? false : true);

        return;
      }

      wasPastCollapseThresholdRef.current = true;

      if (manualOverrideRef.current === null) {
        setIsExpanded(false);
      }
    };

    updateDockForScrollPosition();

    window.addEventListener("scroll", updateDockForScrollPosition, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", updateDockForScrollPosition);
    };
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="tribute-dock__sentinel" aria-hidden="true" />

      <div className="tribute-dock__spacer" style={spacerStyle} aria-hidden="true" />

      <aside
        ref={dockRef}
        className="tribute-dock"
        data-expanded={isExpanded}
        data-has-fallen={fallenTributes.length > 0}
        data-living-profile-size={livingProfileSize}
        style={dockStyle}
        aria-labelledby="tribute-dock-title"
      >
        <div className="tribute-dock__panel">
          <div
            className="tribute-dock__content"
            data-has-fallen={fallenTributes.length > 0}
            id="tribute-dock-content"
          >
            <div className="tribute-dock__main">
              <header className="tribute-dock__header">
                <div className="tribute-dock__heading">
                  <p className="eyebrow">The tributes</p>
                  <h2 id="tribute-dock-title">{livingTributes.length} remaining</h2>
                </div>

                <div className="tribute-dock__counts" aria-label="Arena roster summary">
                  {fallenTributes.length > 0 ? <span>{fallenTributes.length} fallen</span> : null}

                  {visibleRelationships.length > 0 ? (
                    <span>{visibleRelationships.length} relationships</span>
                  ) : null}
                </div>
              </header>

              <section
                className="tribute-dock__living"
                aria-label="Living tributes and active relationships"
              >
                <ol className="tribute-dock__living-list">
                  {livingRosterGroups.map(({ relationship, tributes: groupedTributes }) => {
                    const names = groupedTributes.map((tribute) => tribute.snapshot.name);

                    const relationshipLabel =
                      relationship?.truce.kind === "romantic"
                        ? `Romantic relationship: ${names.join(", ")}`
                        : `Truce: ${names.join(", ")}`;

                    return groupedTributes.map((tribute, tributeIndex) => (
                      <Fragment key={`${relationship?.truce.id ?? "solo"}:${tribute.id}`}>
                        {relationship && tributeIndex > 0 ? (
                          <li
                            className="tribute-dock__relationship-connector-item"
                            data-relationship-kind={relationship.truce.kind}
                            aria-label={relationshipLabel}
                            title={relationshipLabel}
                          >
                            {relationship.truce.kind === "romantic" ? <HeartIcon /> : <ChainIcon />}
                          </li>
                        ) : null}

                        <TributePortrait tribute={tribute} tributeNameById={tributeNameById} />
                      </Fragment>
                    ));
                  })}
                </ol>
              </section>
            </div>

            {fallenTributes.length > 0 ? (
              <section className="tribute-dock__fallen" aria-label="Fallen tributes">
                <div className="tribute-dock__fallen-heading">
                  <span aria-hidden="true">☠</span>
                  <strong>The fallen</strong>
                </div>

                <ol className="tribute-dock__fallen-list">
                  {fallenTributes.map((tribute) => (
                    <TributePortrait
                      tribute={tribute}
                      tributeNameById={tributeNameById}
                      fallen
                      key={tribute.id}
                    />
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        </div>

        <button
          className="tribute-dock__toggle tribute-dock__tab"
          type="button"
          aria-expanded={isExpanded}
          aria-controls="tribute-dock-content"
          onClick={() => {
            setIsExpanded((currentValue) => {
              const nextValue = !currentValue;

              manualOverrideRef.current = nextValue ? "expanded" : "collapsed";

              return nextValue;
            });
          }}
        >
          <span>{isExpanded ? "Collapse" : "Expand"}</span>

          <svg
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
        </button>
      </aside>
    </>
  );
}
