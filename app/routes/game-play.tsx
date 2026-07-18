import { useCallback, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";

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
  selectVictor,
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

  const [hasCompletedVictoryFanfare, setHasCompletedVictoryFanfare] = useState(false);

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

  const victor = selectVictor(activeGame);

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

  if (activeGame.phase === "victory" && victor && !hasCompletedVictoryFanfare) {
    return <VictoryFanfare victor={victor} onComplete={completeVictoryFanfare} />;
  }

  if (activeGame.phase === "victory" && victor) {
    return <VictorySummary game={activeGame} victor={victor} onViewStatistics={openStatistics} />;
  }

  const revealedEvents = selectRevealedRoundEvents(activeGame);

  const hiddenEventCount = selectHiddenEventCount(activeGame);

  return (
    <div className="arena-page">
      <header className="arena-header">
        <Link className="arena-header__brand" to="/">
          <span aria-hidden="true">
            <img
              className="app-brand__emblem-image"
              src="/images/capitol-emblem.webp"
              alt=""
            />
          </span>
          <span>Hunger Games Simulator</span>
        </Link>

        <div className="arena-header__status">
          {activeGame.currentRound ? (
            <strong>{formatRoundLabel(activeGame.currentRound)}</strong>
          ) : (
            <strong>Opening ceremony</strong>
          )}

          <span>{livingTributes.length} tributes remain</span>
        </div>
      </header>

      <div className="arena-layout">
        <main className="arena-main">
          {activeGame.phase === "opening" ? (
            <section className="arena-opening">
              <p className="eyebrow">The Reaping is complete</p>

              <h1>The arena is ready.</h1>

              <p>
                {activeGame.tributes.length} tributes from {activeGame.config.districtCount}{" "}
                districts are waiting for the signal.
              </p>

              <button className="arena-primary-button" type="button" onClick={beginRound}>
                Begin Day 1<span aria-hidden="true">→</span>
              </button>
            </section>
          ) : null}

          {activeGame.currentRound &&
          (activeGame.phase === "round-events" || activeGame.phase === "round-complete") ? (
            <>
              <RoundEventFeed
                events={revealedEvents}
                round={activeGame.currentRound}
                totalEventCount={activeGame.roundEvents.length}
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
              </footer>
            </>
          ) : null}
        </main>

        <div className="arena-rail">
          <TributeSidebar tributes={activeGame.tributes} />

          <InventorySummary tributes={activeGame.tributes} />
        </div>
      </div>
    </div>
  );
}
