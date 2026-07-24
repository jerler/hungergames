import type { GameTribute } from "~/game/types/game-state";

function getHiddenSeverity(tribute: GameTribute): number {
  return tribute.statuses.find((status) => status.definitionId === "hidden")?.severity ?? 0;
}

/**
 * Reduces the likelihood that a tribute is selected
 * for an ordinary hostile target role.
 *
 * Hidden 1: two-thirds ordinary weight
 * Hidden 2: one-third ordinary weight
 * Hidden 3: excluded from hostile selection
 */
export function getHostileTargetingWeightMultiplier(tribute: GameTribute): number {
  return Math.max(0, 1 - getHiddenSeverity(tribute) / 3);
}
