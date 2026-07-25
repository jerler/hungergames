import type { GameState, GameTribute } from "~/game/types/game-state";

interface VictorySummaryProps {
  game: GameState;
  victors: readonly GameTribute[];
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

export function VictorySummary({ game, victors, onViewStatistics }: VictorySummaryProps) {
  const isJointVictory = victors.length === 2;
  const victorNames = victors.map((victor) => victor.snapshot.name).join(" and ");

  return (
    <main className="victory-summary">
      <section className="victory-summary__content">
        <div className="victory-summary__official-mark">
          <span aria-hidden="true">
            <img src="/images/capitol-emblem.webp" alt="" />
          </span>

          <span>Official Capitol Record</span>
        </div>

        <p className="eyebrow">The Games have ended</p>

        <h1>
          {isJointVictory
            ? "Two names enter the history of Panem."
            : `${victorNames} enters the history of Panem.`}
        </h1>

        <p className="victory-summary__introduction">
          {isJointVictory
            ? `The Capitol demanded one survivor. ${victorNames} forced it to accept two.`
            : `Out of ${game.tributes.length} tributes, ${victorNames} alone leaves the arena alive.`}
        </p>

        <div
          className={
            isJointVictory
              ? "victory-summary__cards victory-summary__cards--joint"
              : "victory-summary__cards"
          }
        >
          {victors.map((victor) => (
            <article
              className="victory-summary__card"
              key={victor.id}
              aria-label={`${victor.snapshot.name}, District ${victor.district} victor`}
            >
              <div className="victory-summary__visual">
                <span className="victory-summary__medallion">Victor</span>

                <div className="victory-summary__portrait">
                  {victor.snapshot.portraitUrl ? (
                    <img src={victor.snapshot.portraitUrl} alt="" />
                  ) : (
                    <span aria-hidden="true">{getInitials(victor.snapshot.name)}</span>
                  )}
                </div>

                <span className="victory-summary__district">District {victor.district}</span>
              </div>

              <div className="victory-summary__identity">
                <p>Victor of the Hunger Games</p>

                <h2>{victor.snapshot.name}</h2>

                <dl className="victory-summary__attributes">
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

                <div className="victory-summary__record-heading">Arena record</div>

                <dl className="victory-summary__record">
                  <div>
                    <dt>Kills</dt>
                    <dd>{victor.statistics.kills}</dd>
                  </div>

                  <div>
                    <dt>Events survived</dt>
                    <dd>{victor.statistics.eventsSurvived}</dd>
                  </div>

                  <div>
                    <dt>Gifts received</dt>
                    <dd>{victor.statistics.giftsReceived}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>

        <p className="victory-summary__copy">
          {isJointVictory
            ? "Their names will be spoken together whenever Panem remembers the arena."
            : `${victorNames} survived every alliance, every hazard, and every fight to come out on top.`}
        </p>

        <button className="victory-summary__button" type="button" onClick={onViewStatistics}>
          View final statistics
          <span aria-hidden="true">→</span>
        </button>
      </section>
    </main>
  );
}
