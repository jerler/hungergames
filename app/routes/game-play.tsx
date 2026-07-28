import { useCallback, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";

import { BloodbathStrategyReveal } from "~/features/arena/bloodbath-strategy-reveal";
import { unlockCannonAudio } from "~/features/arena/cannon-audio";
import { DayOneOpening } from "~/features/arena/day-one-opening";
import { InventorySummary } from "~/features/arena/inventory-summary";
import { NightSummary } from "~/features/arena/night-summary";
import { RoundEventFeed } from "~/features/arena/round-event-feed";
import { TributeDock } from "~/features/arena/tribute-dock";
import { VictoryFanfare } from "~/features/victory/victory-fanfare";
import { VictorySummary } from "~/features/victory/victory-summary";
import { formatRoundLabel } from "~/game/engine/rounds";
import {
  selectHiddenEventCount,
  selectLivingTributes,
  selectNextRoundLabel,
  selectRevealedRoundEvents,
  selectRoundTributesByFeedGroup,
  selectVictors,
} from "~/game/selectors/game-selectors";
import { useGameSession } from "~/state/game-session-context";

export function meta() {
  return [
    {
      title: "The Games | Hunger Games Simulator",
    },
  ];
}

export default function GamePlayPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const { activeGame, dispatch } = useGameSession();

  const [hasAcknowledgedFinalEvent, setHasAcknowledgedFinalEvent] = useState(false);
  const [hasCompletedVictoryFanfare, setHasCompletedVictoryFanfare] = useState(false);
  const [acknowledgedBloodbathStrategyGameId, setAcknowledgedBloodbathStrategyGameId] = useState<
    string | null
  >(null);
  const [openedNightSummaryKey, setOpenedNightSummaryKey] = useState<string | null>(null);

  const acknowledgeFinalEvent = useCallback(() => {
    setHasAcknowledgedFinalEvent(true);
  }, []);

  const completeVictoryFanfare = useCallback(() => {
    setHasCompletedVictoryFanfare(true);
  }, []);

  if (!activeGame || activeGame.id !== gameId) {
    return (
      <main className="page-shell">
        <section className="content-card">
          <p className="eyebrow">The Games</p>

          <h1 className="page-title">No active Game found</h1>

          <p className="page-description">
            Active Games are currently stored in memory and cannot yet survive a browser refresh.
          </p>

          <Link to="/create">Create new Games</Link>
        </section>
      </main>
    );
  }

  if (activeGame.phase === "statistics") {
    return <Navigate replace to={`/games/${activeGame.id}/results`} />;
  }

  const livingTributes = selectLivingTributes(activeGame);
  const victors = selectVictors(activeGame);

  const beginRound = () => {
    dispatch({
      type: "round/began",
      now: new Date().toISOString(),
    });
  };

  const revealNextEvent = () => {
    unlockCannonAudio();

    dispatch({
      type: "event/revealed",
      now: new Date().toISOString(),
    });
  };

  const revealAllEvents = () => {
    unlockCannonAudio();

    dispatch({
      type: "round/revealed",
      now: new Date().toISOString(),
    });
  };

  const openStatistics = () => {
    dispatch({
      type: "statistics/opened",
      now: new Date().toISOString(),
    });

    void navigate(`/games/${activeGame.id}/results`);
  };

  if (
    activeGame.phase === "victory" &&
    victors.length > 0 &&
    hasAcknowledgedFinalEvent &&
    !hasCompletedVictoryFanfare
  ) {
    return (
      <VictoryFanfare
        victors={victors}
        tributeCount={activeGame.tributes.length}
        onComplete={completeVictoryFanfare}
      />
    );
  }

  if (activeGame.phase === "victory" && victors.length > 0 && hasAcknowledgedFinalEvent) {
    return <VictorySummary game={activeGame} victors={victors} onViewStatistics={openStatistics} />;
  }

  const revealedEvents = selectRevealedRoundEvents(activeGame);
  const hiddenEventCount = selectHiddenEventCount(activeGame);
  const isDayOneBloodbath =
    activeGame.currentRound?.day === 1 && activeGame.currentRound.period === "day";

  const shouldShowBloodbathStrategyReveal =
    activeGame.phase === "round-events" &&
    isDayOneBloodbath &&
    acknowledgedBloodbathStrategyGameId !== activeGame.id;

  const cornucopiaTributes = selectRoundTributesByFeedGroup(activeGame, "bloodbath-cornucopia");

  const acknowledgeBloodbathStrategy = () => {
    setAcknowledgedBloodbathStrategyGameId(activeGame.id);
  };

  const totalPrimaryEventCount = activeGame.roundEvents.filter(
    (event) => event.kind === "primary",
  ).length;

  const currentNightSummaryKey =
    activeGame.currentRound?.period === "night"
      ? `${activeGame.id}:night:${activeGame.currentRound.day}`
      : null;

  const isCompletedNight =
    activeGame.currentRound?.period === "night" &&
    (activeGame.phase === "round-complete" || activeGame.phase === "victory");

  const shouldShowNightSummary =
    isCompletedNight &&
    currentNightSummaryKey !== null &&
    openedNightSummaryKey === currentNightSummaryKey &&
    !hasAcknowledgedFinalEvent;

  const openNightSummary = () => {
    if (currentNightSummaryKey === null) {
      return;
    }

    unlockCannonAudio();
    setOpenedNightSummaryKey(currentNightSummaryKey);
  };

  return (
    <div className="arena-page">
      <header className="arena-header">
        <Link className="arena-header__brand" to="/">
          <span aria-hidden="true">
            <img className="app-brand__emblem-image" src="/images/capitol-emblem.webp" alt="" />
          </span>
          <span>Hunger Games Simulator</span>
        </Link>

        <div className="arena-header__status">
          {activeGame.currentRound ? (
            <strong>{formatRoundLabel(activeGame.currentRound)}</strong>
          ) : (
            <strong>Day 1 · Awaiting cannon</strong>
          )}

          <span>{livingTributes.length} tributes remain</span>
        </div>
      </header>

      <div className="arena-content-shell">
        <TributeDock tributes={activeGame.tributes} truces={activeGame.truces} />

        <div className="arena-layout">
          <main className="arena-main">
            {activeGame.phase === "opening" ? (
              <DayOneOpening tributeCount={activeGame.tributes.length} onFireCannon={beginRound} />
            ) : null}

            {shouldShowBloodbathStrategyReveal ? (
              <BloodbathStrategyReveal
                cornucopiaTributes={cornucopiaTributes}
                totalTributeCount={activeGame.tributes.length}
                onContinue={acknowledgeBloodbathStrategy}
              />
            ) : null}

            {shouldShowNightSummary && activeGame.currentRound ? (
              <NightSummary
                day={activeGame.currentRound.day}
                tributes={activeGame.tributes}
                continueLabel={
                  activeGame.phase === "victory"
                    ? "Reveal the victor"
                    : `Continue to ${selectNextRoundLabel(activeGame)}`
                }
                onContinue={activeGame.phase === "victory" ? acknowledgeFinalEvent : beginRound}
              />
            ) : null}

            {activeGame.currentRound &&
            !shouldShowBloodbathStrategyReveal &&
            !shouldShowNightSummary &&
            (activeGame.phase === "round-events" ||
              activeGame.phase === "round-complete" ||
              activeGame.phase === "victory") ? (
              <div className="event-feed-stack">
                <div className="event-feed-frame">
                  <RoundEventFeed
                    events={revealedEvents}
                    tributes={activeGame.tributes}
                    round={activeGame.currentRound}
                    totalPrimaryEventCount={totalPrimaryEventCount}
                  />

                  <footer className="event-feed-frame__controls">
                    {activeGame.phase === "round-events" && hiddenEventCount > 0 ? (
                      <>
                        <button
                          className="event-feed-frame__primary-action"
                          type="button"
                          onClick={revealNextEvent}
                        >
                          Reveal next event
                        </button>
                      </>
                    ) : null}

                    {activeGame.phase === "round-complete" ? (
                      activeGame.currentRound.period === "night" ? (
                        <button
                          className="arena-primary-button"
                          type="button"
                          onClick={openNightSummary}
                        >
                          View night summary
                          <span aria-hidden="true">→</span>
                        </button>
                      ) : (
                        <button className="arena-primary-button" type="button" onClick={beginRound}>
                          Continue to {selectNextRoundLabel(activeGame)}
                          <span aria-hidden="true">→</span>
                        </button>
                      )
                    ) : null}

                    {activeGame.phase === "victory" && !hasAcknowledgedFinalEvent ? (
                      activeGame.currentRound.period === "night" ? (
                        <button
                          className="arena-primary-button"
                          type="button"
                          onClick={openNightSummary}
                        >
                          View night summary
                          <span aria-hidden="true">→</span>
                        </button>
                      ) : (
                        <button
                          className="arena-primary-button"
                          type="button"
                          onClick={acknowledgeFinalEvent}
                        >
                          Reveal the victor
                          <span aria-hidden="true">→</span>
                        </button>
                      )
                    ) : null}
                  </footer>
                </div>

                {activeGame.phase === "round-events" && hiddenEventCount > 0 ? (
                  <div className="arena-reveal-all">
                    <button
                      className="arena-secondary-button"
                      type="button"
                      onClick={revealAllEvents}
                    >
                      Reveal all events
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </main>

          <div className="arena-rail">
            <InventorySummary tributes={activeGame.tributes} />
          </div>
        </div>
      </div>
    </div>
  );
}
