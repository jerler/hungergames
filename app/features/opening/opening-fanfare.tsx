import { useEffect } from "react";

import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";

interface OpeningFanfareProps {
  onComplete: () => void;
  durationMs?: number;
}

export function OpeningFanfare({ onComplete, durationMs = 2600 }: OpeningFanfareProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const timeoutId = window.setTimeout(onComplete, prefersReducedMotion ? 300 : durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [durationMs, onComplete, prefersReducedMotion]);

  return (
    <main className="opening-fanfare" aria-labelledby="opening-fanfare-title">
      <button className="opening-fanfare__skip" type="button" onClick={onComplete}>
        Skip opening
      </button>

      <div className="opening-fanfare__content">
        <div className="opening-fanfare__seal" aria-hidden="true">
          <img
            className="opening-fanfare__seal-image"
            src="/images/capitol-emblem.webp"
            alt=""
          />
        </div>

        <p className="opening-fanfare__eyebrow">Citizens, welcome</p>

        <h1 className="opening-fanfare__title" id="opening-fanfare-title">
          The Annual Hunger Games
        </h1>

        <p className="opening-fanfare__subtitle">Your arena awaits.</p>
      </div>
    </main>
  );
}
