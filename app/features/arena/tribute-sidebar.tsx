import { formatRoundLabel } from "~/game/engine/rounds";
import type { GameTribute } from "~/game/types/game-state";

interface TributeSidebarProps {
  tributes: readonly GameTribute[];
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

export function TributeSidebar({ tributes }: TributeSidebarProps) {
  const sortedTributes = [...tributes].sort(
    (firstTribute, secondTribute) =>
      firstTribute.district - secondTribute.district ||
      firstTribute.districtPosition - secondTribute.districtPosition,
  );

  const livingCount = sortedTributes.filter((tribute) => tribute.isAlive).length;

  return (
    <aside className="tribute-sidebar" aria-labelledby="tribute-sidebar-title">
      <header className="tribute-sidebar__header">
        <div>
          <p className="eyebrow">The tributes</p>

          <h2 id="tribute-sidebar-title">{livingCount} remaining</h2>
        </div>

        <span>{sortedTributes.length} entered</span>
      </header>

      <div className="tribute-sidebar__grid">
        {sortedTributes.map((tribute) => {
          const death = tribute.death;

          return (
            <article
              className={["sidebar-tribute", tribute.isAlive ? "" : "sidebar-tribute--dead"]
                .filter(Boolean)
                .join(" ")}
              key={tribute.id}
              aria-label={`${tribute.snapshot.name}, District ${tribute.district}, ${
                tribute.isAlive
                  ? "alive"
                  : `eliminated ${death ? formatRoundLabel(death.round) : ""}`
              }`}
            >
              <div className="sidebar-tribute__portrait">
                {tribute.snapshot.portraitUrl ? (
                  <img src={tribute.snapshot.portraitUrl} alt="" />
                ) : (
                  <span aria-hidden="true">{getInitials(tribute.snapshot.name)}</span>
                )}

                {death ? (
                  <div className="sidebar-tribute__death">
                    <strong>{formatRoundLabel(death.round)}</strong>

                    <span>{death.causeLabel}</span>
                  </div>
                ) : null}
              </div>

              <div className="sidebar-tribute__identity">
                <strong>{tribute.snapshot.name}</strong>

                <span>District {tribute.district}</span>
              </div>

              {tribute.isAlive && tribute.statuses.length > 0 ? (
                <ul className="sidebar-tribute__statuses">
                  {tribute.statuses.map((status) => (
                    <li key={status.id}>{status.type}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
