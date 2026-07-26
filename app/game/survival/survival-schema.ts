import type { RoundReference } from "~/game/types/game-state";

export type SurvivalNeed = "food" | "water";
export type NightRestQuality = "comfortable" | "sheltered" | "unsheltered";

export interface TributeSurvivalState {
  /**
   * The most recent round in which this tribute successfully
   * obtained and consumed enough food to reset deprivation.
   *
   * Null means they have not eaten since entering the arena.
   */
  lastFoundFoodRound: RoundReference | null;

  /**
   * The most recent round in which this tribute successfully
   * obtained and consumed enough water to reset deprivation.
   *
   * Null means they have not drunk since entering the arena.
   */
  lastFoundWaterRound: RoundReference | null;

  lastNightRest: {
    round: RoundReference;
    quality: NightRestQuality;
  } | null;
}

export function createDefaultTributeSurvivalState(): TributeSurvivalState {
  return {
    lastFoundFoodRound: null,
    lastFoundWaterRound: null,
    lastNightRest: null,
  };
}
