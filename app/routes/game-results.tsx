import { Link, useNavigate, useParams } from "react-router";

import { GameStatistics } from "~/features/results/game-statistics";
import { useGameSession } from "~/state/game-session-context";

export function meta() {
  return [
    {
      title: "Final Statistics | Hunger Games Simulator",
    },
  ];
}

export default function GameResultsPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const { activeGame, resetGame } = useGameSession();

  if (!activeGame || activeGame.id !== gameId) {
    return (
      <main className="page-shell">
        <section className="content-card">
          <p className="eyebrow">Final statistics</p>

          <h1 className="page-title">No completed Game found</h1>

          <p className="page-description">
            Completed Games are not persisted between browser sessions yet.
          </p>

          <Link to="/create">Create new Games</Link>
        </section>
      </main>
    );
  }

  if (activeGame.phase !== "statistics" && activeGame.phase !== "victory") {
    return (
      <main className="page-shell">
        <section className="content-card">
          <p className="eyebrow">Final statistics</p>

          <h1 className="page-title">The Games are still underway</h1>

          <Link to={`/games/${activeGame.id}/play`}>Return to the arena</Link>
        </section>
      </main>
    );
  }

  const createAnotherGame = () => {
    resetGame();
    void navigate("/create");
  };

  return (
    <main className="results-page">
      <div className="results-page__content">
        <GameStatistics game={activeGame} />

        <footer className="results-actions">
          <button className="arena-primary-button" type="button" onClick={createAnotherGame}>
            Create another Game
          </button>

          <Link className="arena-secondary-link" to="/">
            Return home
          </Link>
        </footer>
      </div>
    </main>
  );
}
