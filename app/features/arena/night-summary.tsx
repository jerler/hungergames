import { useEffect, useMemo } from "react";

import { createStatusPresentation } from "~/game/statuses/status-presentation";
import { getActiveStatuses } from "~/game/statuses/status-selectors";
import type { GameTribute } from "~/game/types/game-state";
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";

import { playCannonSound } from "./cannon-audio";
import { EventTributeAvatar } from "./event-tribute-avatar";
import { StaggeredTributeList } from "./staggered-tribute-list";
import { StatusIcon } from "./status-icon";

interface NightSummaryProps {
  day: number;
  tributes: readonly GameTribute[];
  continueLabel: string;
  onContinue: () => void;
  soundEnabled?: boolean;
  deathRevealDelayMs?: number;
  deathRevealStaggerMs?: number;
  aliveRevealStaggerMs?: number;
}

function compareTributesByDistrict(firstTribute: GameTribute, secondTribute: GameTribute): number {
  return (
    firstTribute.district - secondTribute.district ||
    firstTribute.districtPosition - secondTribute.districtPosition ||
    firstTribute.snapshot.name.localeCompare(secondTribute.snapshot.name)
  );
}

function compareFallenTributes(firstTribute: GameTribute, secondTribute: GameTribute): number {
  const firstPeriod = firstTribute.death?.round.period === "night" ? 1 : 0;
  const secondPeriod = secondTribute.death?.round.period === "night" ? 1 : 0;

  return firstPeriod - secondPeriod || compareTributesByDistrict(firstTribute, secondTribute);
}

function TributeStatusSummary({ tribute }: { tribute: GameTribute }) {
  const statuses = getActiveStatuses(tribute);

  if (statuses.length === 0) {
    return <span className="night-summary__status-empty">No active statuses</span>;
  }

  return (
    <ul className="night-summary__statuses" aria-label={`${tribute.snapshot.name} active statuses`}>
      {statuses.map((status) => {
        const presentation = createStatusPresentation(status);
        const accessibleLabel = `${presentation.label}, ${presentation.severityLabel}. ${presentation.lifecycleSummary}`;

        return (
          <li
            className="night-summary__status"
            data-status-tone={presentation.tone}
            key={status.id}
            title={`${presentation.description} ${presentation.lifecycleSummary}`}
            aria-label={accessibleLabel}
          >
            <span className="night-summary__status-icon">
              <StatusIcon statusId={status.definitionId} />
            </span>

            <span>{presentation.label}</span>

            {status.severity > 1 ? (
              <span className="night-summary__status-severity" aria-hidden="true">
                {status.severity}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function NightSummary({
  day,
  tributes,
  continueLabel,
  onContinue,
  soundEnabled = true,
  deathRevealDelayMs = 260,
  deathRevealStaggerMs = 560,
  aliveRevealStaggerMs = 95,
}: NightSummaryProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const fallenTributes = useMemo(
    () =>
      tributes.filter((tribute) => tribute.death?.round.day === day).sort(compareFallenTributes),
    [day, tributes],
  );

  const livingTributes = useMemo(
    () => tributes.filter((tribute) => tribute.isAlive).sort(compareTributesByDistrict),
    [tributes],
  );

  useEffect(() => {
    if (!soundEnabled || prefersReducedMotion || fallenTributes.length === 0) {
      return;
    }

    const timeoutIds = Array.from({ length: fallenTributes.length }, (_, index) =>
      window.setTimeout(playCannonSound, deathRevealDelayMs + index * deathRevealStaggerMs),
    );

    return () => {
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    deathRevealDelayMs,
    deathRevealStaggerMs,
    fallenTributes.length,
    prefersReducedMotion,
    soundEnabled,
  ]);

  const aliveRevealDelayMs =
    fallenTributes.length === 0
      ? 160
      : deathRevealDelayMs + (fallenTributes.length - 1) * deathRevealStaggerMs + 620;

  const fallenCountLabel =
    fallenTributes.length === 1 ? "1 cannon sounded" : `${fallenTributes.length} cannons sounded`;

  return (
    <section className="night-summary" aria-labelledby="night-summary-title">
      <div className="night-summary__atmosphere" aria-hidden="true" />

      <header className="night-summary__header">
        <p className="eyebrow">Capitol night broadcast</p>

        <h1 id="night-summary-title">The Fallen and the Remaining</h1>

        <p>
          Day {day} closes with {fallenTributes.length} fallen and {livingTributes.length} still
          alive.
        </p>
      </header>

      <div className="night-summary__sections">
        <section className="night-summary__section night-summary__section--fallen">
          <header className="night-summary__section-header">
            <div>
              <p className="eyebrow">The fallen</p>
              <h2>Lost during Day {day}</h2>
            </div>

            <span>{fallenCountLabel}</span>
          </header>

          {fallenTributes.length > 0 ? (
            <StaggeredTributeList
              tributes={fallenTributes}
              ariaLabel={`Tributes who died during Day ${day}`}
              tone="fallen"
              className="night-summary__fallen-list"
              itemClassName="night-summary__fallen-item"
              initialDelayMs={deathRevealDelayMs}
              staggerMs={deathRevealStaggerMs}
              renderTribute={(tribute) => (
                <article
                  className="night-summary__fallen-card"
                  aria-label={`${tribute.snapshot.name}, District ${tribute.district}`}
                >
                  <EventTributeAvatar
                    tribute={tribute}
                    fallbackName={tribute.snapshot.name}
                    size="primary"
                    muted
                  />
                </article>
              )}
            />
          ) : (
            <p className="night-summary__no-fallen">No cannon sounded today.</p>
          )}
        </section>

        <section className="night-summary__section night-summary__section--living">
          <header className="night-summary__section-header">
            <div>
              <p className="eyebrow">Still in the arena</p>
              <h2>{livingTributes.length} tributes remain</h2>
            </div>
          </header>

          <StaggeredTributeList
            tributes={livingTributes}
            ariaLabel={`Tributes alive after Night ${day}`}
            tone="alive"
            className="night-summary__living-list"
            itemClassName="night-summary__living-item"
            initialDelayMs={aliveRevealDelayMs}
            staggerMs={aliveRevealStaggerMs}
            renderTribute={(tribute) => (
              <article className="night-summary__living-card">
                <EventTributeAvatar
                  tribute={tribute}
                  fallbackName={tribute.snapshot.name}
                  size="primary"
                />

                <div className="night-summary__living-copy">
                  <div className="night-summary__identity">
                    <strong>{tribute.snapshot.name}</strong>
                    <span>District {tribute.district}</span>
                  </div>

                  <TributeStatusSummary tribute={tribute} />
                </div>
              </article>
            )}
          />
        </section>
      </div>

      <footer className="night-summary__footer">
        <button className="arena-primary-button" type="button" onClick={onContinue}>
          {continueLabel}
          <span aria-hidden="true">→</span>
        </button>
      </footer>
    </section>
  );
}
