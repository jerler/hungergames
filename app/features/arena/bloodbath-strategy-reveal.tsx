import { useEffect, useState } from "react";

import { EventTributeAvatar } from "~/features/arena/event-tribute-avatar";
import { StaggeredTributeList } from "~/features/arena/staggered-tribute-list";
import type { GameTribute } from "~/game/types/game-state";
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";

interface BloodbathStrategyRevealProps {
  cornucopiaTributes: readonly GameTribute[];
  totalTributeCount: number;
  onContinue: () => void;
  revealDelayMs?: number;
}

export function BloodbathStrategyReveal({
  cornucopiaTributes,
  totalTributeCount,
  onContinue,
  revealDelayMs = 650,
}: BloodbathStrategyRevealProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const [hasRevealDelayElapsed, setHasRevealDelayElapsed] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHasRevealDelayElapsed(true);
    }, revealDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [prefersReducedMotion, revealDelayMs]);

  const hasRevealedTributes = prefersReducedMotion || hasRevealDelayElapsed;

  const fleeingTributeCount = Math.max(0, totalTributeCount - cornucopiaTributes.length);

  const fleeingSummary =
    fleeingTributeCount === 1
      ? "The remaining tribute ran for the trees."
      : `The remaining ${fleeingTributeCount} tributes ran for the trees.`;

  return (
    <section
      className="bloodbath-strategy-reveal"
      aria-labelledby="bloodbath-strategy-reveal-title"
    >
      <div className="bloodbath-strategy-reveal__content">
        <p className="eyebrow">The cannon fires</p>

        <h1 id="bloodbath-strategy-reveal-title">Ran for the Cornucopia...</h1>

        {hasRevealedTributes ? (
          <div className="bloodbath-strategy-reveal__result">
            <StaggeredTributeList
              tributes={cornucopiaTributes}
              ariaLabel="Tributes who ran for the Cornucopia"
              tone="cornucopia"
              className="bloodbath-strategy-reveal__tributes"
              itemClassName="bloodbath-strategy-reveal__tribute"
              initialDelayMs={80}
              staggerMs={110}
              renderTribute={(tribute) => (
                <>
                  <EventTributeAvatar
                    tribute={tribute}
                    fallbackName={tribute.snapshot.name}
                    size="primary"
                  />

                  <strong>{tribute.snapshot.name}</strong>

                  <span>District {tribute.district}</span>
                </>
              )}
            />

            <p className="bloodbath-strategy-reveal__fleeing-summary">{fleeingSummary}</p>

            <button className="arena-primary-button" type="button" onClick={onContinue}>
              Continue to the Bloodbath
              <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
