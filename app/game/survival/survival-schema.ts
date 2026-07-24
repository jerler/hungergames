import type { RoundReference } from "~/game/types/game-state";

export type SurvivalNeed = "food" | "water";
export type NightRestQuality = "comfortable" | "sheltered" | "unsheltered";

export interface TributeSurvivalState {
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
