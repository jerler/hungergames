import {
  selectCompletedRoundCount,
  selectDeathsByRound,
  selectKillLeaders,
  selectVictors,
} from "~/game/selectors/game-selectors";
import type { GameState } from "~/game/types/game-state";

interface GameStatisticsProps {
  game: GameState;
}

export function GameStatistics({ game }: GameStatisticsProps) {
  const victors = selectVictors(game);

  const deathsByRound = selectDeathsByRound(game);

  const killLeaders = selectKillLeaders(game);

  const completedRounds = selectCompletedRoundCount(game);

  const isJointVictory = game.victoryOutcome?.kind === "joint";

  const victorNames = victors.map((victor) => victor.snapshot.name).join(" and ");

  const totalDeaths = game.tributes.filter((tribute) => !tribute.isAlive).length;

  const totalKills = game.tributes.reduce((total, tribute) => total + tribute.statistics.kills, 0);

  const arenaDeaths = game.tributes.filter(
    (tribute) => tribute.death && tribute.death.killerTributeIds.length === 0,
  ).length;

  return (
    <section className="statistics">
      <header className="statistics__header">
        <p className="eyebrow">Official arena record</p>

        <h1>Final statistics</h1>

        <p>
          {isJointVictory
            ? `${victorNames} were declared joint victors after defying the Capitol together.`
            : victors[0]
              ? `${victors[0].snapshot.name} emerged victorious from District ${victors[0].district}.`
              : "The Games have concluded."}
        </p>
      </header>

      <div className="statistics__scorecards">
        <article>
          <span>Outcome</span>

          <strong>{isJointVictory ? "Joint victory" : "Sole victor"}</strong>
        </article>

        <article>
          <span>Tributes</span>

          <strong>{game.tributes.length}</strong>
        </article>

        <article>
          <span>Rounds</span>

          <strong>{completedRounds}</strong>
        </article>

        <article>
          <span>Events</span>

          <strong>{game.eventHistory.length}</strong>
        </article>

        <article>
          <span>Deaths</span>

          <strong>{totalDeaths}</strong>
        </article>

        <article>
          <span>Tribute kills</span>

          <strong>{totalKills}</strong>
        </article>

        <article>
          <span>Arena deaths</span>

          <strong>{arenaDeaths}</strong>
        </article>
      </div>

      <div className="statistics__details">
        <section className="statistics-panel" aria-labelledby="death-timeline-title">
          <h2 id="death-timeline-title">Deaths by round</h2>

          <ol className="death-timeline">
            {deathsByRound.map((statistic) => (
              <li key={statistic.roundLabel}>
                <span>{statistic.roundLabel}</span>

                <strong>{statistic.deaths}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="statistics-panel" aria-labelledby="kill-leaders-title">
          <h2 id="kill-leaders-title">Deadliest tributes</h2>

          {killLeaders.length > 0 ? (
            <ul className="kill-leaders">
              {killLeaders.map((tribute) => (
                <li key={tribute.id}>
                  <div>
                    <strong>{tribute.snapshot.name}</strong>

                    <span>District {tribute.district}</span>
                  </div>

                  <span>
                    {tribute.statistics.kills} {tribute.statistics.kills === 1 ? "kill" : "kills"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="statistics-panel__empty">
              No tribute was directly responsible for another tribute’s death.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
