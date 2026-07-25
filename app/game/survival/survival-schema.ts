import type { RoundReference } from "~/game/types/game-state";

export type SurvivalNeed = "food" | "water";
export type NightRestQuality = "comfortable" | "sheltered" | "unsheltered";

export interface TributeSurvivalState {
  /**
   * Legacy field names retained for save compatibility.
   *
   * Each counter advances once after a night round completes,
   * so one increment now represents one full arena day.
   */
  roundsWithoutFood: number;
  roundsWithoutWater: number;
  lastNightRest: {
    round: RoundReference;
    quality: NightRestQuality;
  } | null;
}

export function createDefaultTributeSurvivalState(): TributeSurvivalState {
  return {
    roundsWithoutFood: 0,
    roundsWithoutWater: 0,
    lastNightRest: null,
  };
}
