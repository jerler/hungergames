import type { StatCheckDifficulty } from "~/game/events/event-outcomes";

import type { AuthoredStatCheck } from "./check-schema";

function createStatCheck(
  stat: AuthoredStatCheck["stat"],
  difficulty: StatCheckDifficulty,
  luckAdjusted: boolean,
): AuthoredStatCheck {
  return {
    stat,
    difficulty,
    luckAdjusted,
  };
}

export function brains(difficulty: StatCheckDifficulty): AuthoredStatCheck {
  return createStatCheck("brains", difficulty, true);
}

export function brawn(difficulty: StatCheckDifficulty): AuthoredStatCheck {
  return createStatCheck("brawn", difficulty, true);
}

/**
 * Luck checks use the tribute's raw Luck score.
 *
 * Brains and Brawn checks receive the existing Luck-based
 * difficulty adjustment. Applying that adjustment to Luck itself
 * would count the same stat twice and change the behaviour of
 * existing Luck-based events.
 */
export function luck(difficulty: StatCheckDifficulty): AuthoredStatCheck {
  return createStatCheck("luck", difficulty, false);
}
