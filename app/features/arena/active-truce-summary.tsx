import { formatRoundLabel } from "~/game/engine/rounds";
import type { GameTribute, Truce } from "~/game/types/game-state";

interface ActiveTruceSummaryProps {
  truces: readonly Truce[];
  tributes: readonly GameTribute[];
}

function formatNameList(names: readonly string[]): string {
  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ` + names[names.length - 1];
}

export function ActiveTruceSummary({ truces, tributes }: ActiveTruceSummaryProps) {
  if (truces.length === 0) {
    return null;
  }

  return (
    <section className="truce-summary" aria-labelledby="active-truces-title">
      <header className="truce-summary__header">
        <p className="eyebrow">Relationships</p>

        <h2 id="active-truces-title">Active truces</h2>
      </header>

      <ul className="truce-summary__list">
        {truces.map((truce) => {
          const names = truce.tributeIds
            .map((tributeId) => tributes.find((tribute) => tribute.id === tributeId)?.snapshot.name)
            .filter((name): name is string => Boolean(name));

          const truceLabel = truce.kind === "romantic" ? "Romantic truce" : "Temporary truce";

          const expiryLabel = truce.expiresAfterRound
            ? `through ${formatRoundLabel(truce.expiresAfterRound)}`
            : "no planned end";

          return (
            <li key={truce.id}>
              <strong>{formatNameList(names)}</strong>

              <span>
                {truceLabel} · {expiryLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
