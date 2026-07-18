import { useEffect } from "react";

import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";
import type { GameTribute } from "~/game/types/game-state";

interface VictoryFanfareProps {
  victor: GameTribute;
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

export function VictoryFanfare({ victor, onComplete, durationMs = 3000 }: VictoryFanfareProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

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

        <h1 id="victory-fanfare-title">We have a victor</h1>

        <div className="victory-fanfare__portrait">
          {victor.snapshot.portraitUrl ? (
            <img src={victor.snapshot.portraitUrl} alt="" />
          ) : (
            <span aria-hidden="true">{getInitials(victor.snapshot.name)}</span>
          )}
        </div>

        <strong className="victory-fanfare__name">{victor.snapshot.name}</strong>

        <span className="victory-fanfare__district">District {victor.district}</span>
      </div>
    </main>
  );
}
