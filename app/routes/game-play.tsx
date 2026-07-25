import { useCallback, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { ActiveTruceSummary } from "~/features/arena/active-truce-summary";
import { RoundEventFeed } from "~/features/arena/round-event-feed";
import { TributeSidebar } from "~/features/arena/tribute-sidebar";
import { VictoryFanfare } from "~/features/victory/victory-fanfare";
import { VictorySummary } from "~/features/victory/victory-summary";
import { InventorySummary } from "~/features/arena/inventory-summary";
import { formatRoundLabel } from "~/game/engine/rounds";
import {
  selectHiddenEventCount,
  selectLivingTributes,
  selectNextRoundLabel,
  selectRevealedRoundEvents,
  selectVictors,
} from "~/game/selectors/game-selectors";
import { useGameSession } from "~/state/game-session-context";
import { DayOneOpening } from "~/features/arena/day-one-opening";

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
    dispatch({
      type: "event/revealed",
      now: new Date().toISOString(),
    });
  };

  const revealAllEvents = () => {
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
    return <VictoryFanfare victors={victors} onComplete={completeVictoryFanfare} />;
  }

  if (activeGame.phase === "victory" && victors.length > 0 && hasAcknowledgedFinalEvent) {
    return <VictorySummary game={activeGame} victors={victors} onViewStatistics={openStatistics} />;
  }

  const revealedEvents = selectRevealedRoundEvents(activeGame);

  const hiddenEventCount = selectHiddenEventCount(activeGame);
  const totalPrimaryEventCount = activeGame.roundEvents.filter(
    (event) => event.kind === "primary",
  ).length;

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

      <div className="arena-layout">
        <main className="arena-main">
          {activeGame.phase === "opening" ? (
            <DayOneOpening tributeCount={activeGame.tributes.length} onFireCannon={beginRound} />
          ) : null}

          {activeGame.currentRound &&
          (activeGame.phase === "round-events" ||
            activeGame.phase === "round-complete" ||
            activeGame.phase === "victory") ? (
            <>
              <RoundEventFeed
                events={revealedEvents}
                round={activeGame.currentRound}
                totalPrimaryEventCount={totalPrimaryEventCount}
                tributes={activeGame.tributes}
              />

              <footer className="arena-controls">
                {activeGame.phase === "round-events" && hiddenEventCount > 0 ? (
                  <>
                    <button
                      className="arena-primary-button"
                      type="button"
                      onClick={revealNextEvent}
                    >
                      Reveal next event
                    </button>

                    <button
                      className="arena-secondary-button"
                      type="button"
                      onClick={revealAllEvents}
                    >
                      Reveal all events
                    </button>
                  </>
                ) : null}

                {activeGame.phase === "round-complete" ? (
                  <button className="arena-primary-button" type="button" onClick={beginRound}>
                    Continue to {selectNextRoundLabel(activeGame)}
                    <span aria-hidden="true">→</span>
                  </button>
                ) : null}
                {activeGame.phase === "victory" && !hasAcknowledgedFinalEvent ? (
                  <button
                    className="arena-primary-button"
                    type="button"
                    onClick={acknowledgeFinalEvent}
                  >
                    Reveal the victor
                    <span aria-hidden="true">→</span>
                  </button>
                ) : null}
              </footer>
            </>
          ) : null}
        </main>

        <div className="arena-rail">
          <TributeSidebar tributes={activeGame.tributes} />

          <ActiveTruceSummary truces={activeGame.truces} tributes={activeGame.tributes} />

          <InventorySummary tributes={activeGame.tributes} />
        </div>
      </div>
    </div>
  );
}
