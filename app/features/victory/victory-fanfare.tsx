import { useEffect } from "react";

import type { GameTribute } from "~/game/types/game-state";
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";

interface VictoryFanfareProps {
  victors: readonly GameTribute[];
  onComplete: () => void;
  durationMs?: number;
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

export function VictoryFanfare({ victors, onComplete, durationMs = 3000 }: VictoryFanfareProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const isJointVictory = victors.length === 2;

  const victorNames = victors.map((victor) => victor.snapshot.name).join(" and ");

  useEffect(() => {
    const timeoutId = window.setTimeout(onComplete, prefersReducedMotion ? 300 : durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [durationMs, onComplete, prefersReducedMotion]);

  return (
    <main className="victory-fanfare" aria-labelledby="victory-fanfare-title">
      <button className="victory-fanfare__skip" type="button" onClick={onComplete}>
        Skip reveal
      </button>

      <div className="victory-fanfare__content">
        <p className="victory-fanfare__eyebrow">Ladies and gentlemen</p>

        <h1 id="victory-fanfare-title">
          {isJointVictory ? "We have victors" : "We have a victor"}
        </h1>

        <div
          className={
            isJointVictory
              ? "victory-fanfare__portraits victory-fanfare__portraits--joint"
              : "victory-fanfare__portraits"
          }
        >
          {victors.map((victor) => (
            <div className="victory-fanfare__portrait" key={victor.id}>
              {victor.snapshot.portraitUrl ? (
                <img src={victor.snapshot.portraitUrl} alt="" />
              ) : (
                <span aria-hidden="true">{getInitials(victor.snapshot.name)}</span>
              )}
            </div>
          ))}
        </div>

        <strong className="victory-fanfare__name">{victorNames}</strong>

        <span className="victory-fanfare__district">
          {victors.map((victor) => `District ${victor.district}`).join(" • ")}
        </span>
      </div>
    </main>
  );
}
