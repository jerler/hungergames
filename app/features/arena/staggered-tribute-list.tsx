import type { CSSProperties, ReactNode } from "react";

import type { GameTribute } from "~/game/types/game-state";

export type TributeRevealTone = "alive" | "cornucopia" | "fallen";

interface StaggeredTributeListProps {
  tributes: readonly GameTribute[];
  ariaLabel: string;
  tone: TributeRevealTone;
  renderTribute: (tribute: GameTribute, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
  initialDelayMs?: number;
  staggerMs?: number;
}

function joinClassNames(...classNames: (string | undefined)[]): string {
  return classNames.filter(Boolean).join(" ");
}

export function StaggeredTributeList({
  tributes,
  ariaLabel,
  tone,
  renderTribute,
  className,
  itemClassName,
  initialDelayMs = 0,
  staggerMs = 110,
}: StaggeredTributeListProps) {
  return (
    <ul
      className={joinClassNames("staggered-tribute-list", className)}
      data-tribute-reveal-tone={tone}
      aria-label={ariaLabel}
    >
      {tributes.map((tribute, index) => {
        const revealDelay = `${initialDelayMs + index * staggerMs}ms`;
        const style = {
          animationDelay: revealDelay,
          "--tribute-reveal-delay": revealDelay,
        } as CSSProperties;

        return (
          <li
            className={joinClassNames("staggered-tribute-list__item", itemClassName)}
            data-reveal-index={index}
            data-tribute-reveal-tone={tone}
            key={tribute.id}
            style={style}
          >
            {renderTribute(tribute, index)}
          </li>
        );
      })}
    </ul>
  );
}
