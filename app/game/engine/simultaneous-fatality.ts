import { getEffectiveLuck } from "~/game/engine/effective-stats";
import type { GameTribute } from "~/game/types/game-state";

/**
 * Preserves one living tribute when every remaining tribute
 * would otherwise die during the same automatic resolution.
 *
 * Effective Luck breaks the tie, followed by tribute ID for
 * stable deterministic ordering.
 */
export function chooseSimultaneousFatalitySurvivor(
  fatalCandidates: readonly GameTribute[],
  livingTributes: readonly GameTribute[],
): string | null {
  if (fatalCandidates.length === 0 || fatalCandidates.length !== livingTributes.length) {
    return null;
  }

  return (
    [...fatalCandidates].sort(
      (firstTribute, secondTribute) =>
        getEffectiveLuck(secondTribute) - getEffectiveLuck(firstTribute) ||
        firstTribute.id.localeCompare(secondTribute.id),
    )[0]?.id ?? null
  );
}
