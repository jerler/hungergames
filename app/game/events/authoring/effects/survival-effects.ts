import type { NightRestQuality, SurvivalNeed } from "~/game/survival/survival-schema";

import type {
  IncreaseSurvivalDeprivationEffect,
  RecordNightRestEffect,
  SatisfySurvivalNeedEffect,
} from "./effect-schema";

export function increaseSurvivalDeprivation(
  roleId: string,
  need: SurvivalNeed,
  rounds: number,
): IncreaseSurvivalDeprivationEffect {
  if (!Number.isInteger(rounds) || rounds <= 0) {
    throw new Error("Survival deprivation rounds must be a positive integer.");
  }

  return {
    type: "increase-survival-deprivation",
    roleId,
    need,
    rounds,
  };
}

export function recordNightRest(
  roleId: string,
  quality: Extract<NightRestQuality, "sheltered" | "unsheltered">,
): RecordNightRestEffect {
  return {
    type: "record-night-rest",
    roleId,
    quality,
  };
}

export function satisfySurvivalNeed(roleId: string, need: SurvivalNeed): SatisfySurvivalNeedEffect {
  return {
    type: "satisfy-survival-need",
    roleId,
    need,
  };
}
