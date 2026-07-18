import { Link, useParams } from "react-router";

import type { GameTribute } from "~/game/types/game-state";
import { useGameSession } from "~/state/game-session-context";

export function meta() {
  return [
    {
      title: "The Games | Hunger Games Simulator",
    },
  ];
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

function TributePreview({ tribute }: { tribute: GameTribute }) {
  return (
    <article className="game-ready-tribute">
      <div className="game-ready-tribute__portrait">
        {tribute.snapshot.portraitUrl ? (
          <img src={tribute.snapshot.portraitUrl} alt="" />
        ) : (
          <span aria-hidden="true">{getInitials(tribute.snapshot.name)}</span>
        )}
      </div>

      <div>
        <span>District {tribute.district}</span>

        <strong>{tribute.snapshot.name}</strong>
      </div>
    </article>
  );
}

export default function GamePlayPage() {
  const { gameId } = useParams();
  const { activeGame } = useGameSession();

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

  return (
    <main className="game-ready-page">
      <section className="game-ready-content">
        <header className="game-ready-header">
          <p className="eyebrow">The Reaping is complete</p>

          <h1>The arena is ready.</h1>

          <p>
            {activeGame.tributes.length} tributes from {activeGame.config.districtCount} districts
            are prepared to enter the Games.
          </p>
        </header>

        <div className="game-ready-grid">
          {activeGame.tributes.map((tribute) => (
            <TributePreview key={tribute.id} tribute={tribute} />
          ))}
        </div>

        <footer className="game-ready-footer">
          <p>
            Phase 3 will introduce the opening ceremony, Day and Night rounds, events, deaths, and
            the victor.
          </p>
        </footer>
      </section>
    </main>
  );
}
