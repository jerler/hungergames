import { type CSSProperties, useEffect } from "react";

import type { GameTribute } from "~/game/types/game-state";
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";

interface VictoryFanfareProps {
  victors: readonly GameTribute[];
  tributeCount: number;
  onComplete: () => void;
  durationMs?: number;
}

const CEREMONY_RAYS = Array.from({ length: 12 }, (_, index) => index);

const CEREMONY_SPARKS = Array.from({ length: 28 }, (_, index) => ({
  left: `${(index * 37 + 11) % 100}%`,
  delay: `${2.1 + (index % 7) * 0.18}s`,
  duration: `${2.6 + (index % 5) * 0.35}s`,
  size: `${3 + (index % 4)}px`,
}));

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function VictoryFanfare({
  victors,
  tributeCount,
  onComplete,
  durationMs = 6400,
}: VictoryFanfareProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const isJointVictory = victors.length === 2;
  const victorNames = victors.map((victor) => victor.snapshot.name).join(" and ");
  const districtNames = victors.map((victor) => `District ${victor.district}`).join(" • ");

  const ceremonyStyle = {
    "--victory-duration": `${durationMs}ms`,
  } as CSSProperties;

  useEffect(() => {
    const timeoutId = window.setTimeout(onComplete, prefersReducedMotion ? 600 : durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [durationMs, onComplete, prefersReducedMotion]);

  return (
    <main className="victory-fanfare" style={ceremonyStyle} aria-labelledby="victory-fanfare-title">
      <div className="victory-fanfare__atmosphere" aria-hidden="true">
        <div className="victory-fanfare__rays">
          {CEREMONY_RAYS.map((rayIndex) => (
            <span
              className="victory-fanfare__ray"
              key={rayIndex}
              style={{ "--ray-index": rayIndex } as CSSProperties}
            />
          ))}
        </div>

        <div className="victory-fanfare__sparks">
          {CEREMONY_SPARKS.map((spark, index) => (
            <span
              className="victory-fanfare__spark"
              key={index}
              style={{
                left: spark.left,
                width: spark.size,
                height: spark.size,
                animationDelay: spark.delay,
                animationDuration: spark.duration,
              }}
            />
          ))}
        </div>
      </div>

      <button className="victory-fanfare__skip" type="button" onClick={onComplete}>
        Skip ceremony
      </button>

      <section className="victory-fanfare__content">
        <div className="victory-fanfare__broadcast-mark">
          <span className="victory-fanfare__seal" aria-hidden="true">
            <img src="/images/capitol-emblem.webp" alt="" />
          </span>

          <span>Capitol Victory Broadcast</span>
        </div>

        <p className="victory-fanfare__eyebrow">The final cannon has sounded</p>

        <h1 id="victory-fanfare-title">
          {isJointVictory ? "The Games have victors" : "The Games have a victor"}
        </h1>

        <p className="victory-fanfare__tribute-count">
          {isJointVictory
            ? `From ${tributeCount} tributes, two defied the arena.`
            : `From ${tributeCount} tributes, one remains.`}
        </p>

        <div className="victory-fanfare__portrait-stage">
          <div
            className={
              isJointVictory
                ? "victory-fanfare__portraits victory-fanfare__portraits--joint"
                : "victory-fanfare__portraits"
            }
          >
            {victors.map((victor) => (
              <div className="victory-fanfare__portrait-shell" key={victor.id}>
                <div className="victory-fanfare__portrait">
                  {victor.snapshot.portraitUrl ? (
                    <img src={victor.snapshot.portraitUrl} alt="" />
                  ) : (
                    <span aria-hidden="true">{getInitials(victor.snapshot.name)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <span className="victory-fanfare__badge">{isJointVictory ? "Victors" : "Victor"}</span>
        </div>

        <strong className="victory-fanfare__name">{victorNames}</strong>

        <span className="victory-fanfare__district">{districtNames}</span>

        <p className="victory-fanfare__proclamation">
          {isJointVictory
            ? "The Capitol demanded one survivor. The arena answered with two."
            : `Long may ${victorNames} be remembered across Panem.`}
        </p>

        <div className="victory-fanfare__timer" aria-hidden="true">
          <span />
        </div>
      </section>
    </main>
  );
}
