import type { NightRestQuality, SurvivalNeed } from "~/game/survival/survival-schema";

import type { RecordNightRestEffect, SatisfySurvivalNeedEffect } from "./effect-schema";

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
