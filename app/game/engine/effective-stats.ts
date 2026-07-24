import type { GameTribute } from "~/game/types/game-state";
import type { TributeStats, TributeStatValue } from "~/game/types/tribute";

function getLuckySeverity(tribute: GameTribute): number {
  return tribute.statuses.find((status) => status.definitionId === "lucky")?.severity ?? 0;
}

export function getEffectiveLuck(tribute: GameTribute): TributeStatValue {
  return Math.min(5, tribute.snapshot.stats.luck + getLuckySeverity(tribute)) as TributeStatValue;
}

export function getEffectiveStats(tribute: GameTribute): TributeStats {
  return {
    ...tribute.snapshot.stats,
    luck: getEffectiveLuck(tribute),
  };
}
