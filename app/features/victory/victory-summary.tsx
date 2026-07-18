import type { GameState, GameTribute } from "~/game/types/game-state";

interface VictorySummaryProps {
  game: GameState;
  victor: GameTribute;
  onViewStatistics: () => void;
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

export function VictorySummary({ game, victor, onViewStatistics }: VictorySummaryProps) {
  return (
    <main className="victory-summary">
      <section className="victory-summary__content">
        <p className="eyebrow">The Games have ended</p>

        <h1>The victor is...</h1>

        <div className="victory-summary__card">
          <div className="victory-summary__portrait">
            {victor.snapshot.portraitUrl ? (
              <img src={victor.snapshot.portraitUrl} alt="" />
            ) : (
              <span aria-hidden="true">{getInitials(victor.snapshot.name)}</span>
            )}
          </div>

          <div className="victory-summary__identity">
            <span>District {victor.district}</span>

            <strong>{victor.snapshot.name}</strong>

            <dl>
              <div>
                <dt>Brains</dt>
                <dd>{victor.snapshot.stats.brains}/5</dd>
              </div>

              <div>
                <dt>Brawn</dt>
                <dd>{victor.snapshot.stats.brawn}/5</dd>
              </div>

              <div>
                <dt>Luck</dt>
                <dd>{victor.snapshot.stats.luck}/5</dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="victory-summary__copy">
          {victor.snapshot.name} is the sole survivor of a field of {game.tributes.length} tributes.
        </p>

        <button className="victory-summary__button" type="button" onClick={onViewStatistics}>
          View final statistics
          <span aria-hidden="true">→</span>
        </button>
      </section>
    </main>
  );
}
