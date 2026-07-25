import type { StatusEffectId } from "~/game/statuses/status-schema";

import type { SurvivalNeed } from "./survival-schema";

export type SurvivalNeedCounterKey = "roundsWithoutFood" | "roundsWithoutWater";

export type SurvivalNeedStatusId = Extract<
  StatusEffectId,
  "thirsty" | "dehydrated" | "hungry" | "starving"
>;

export interface SurvivalNeedStageDefinition {
  minimumRounds: number;
  statusId: SurvivalNeedStatusId;
  severity: 1 | 2 | 3;
}

export interface SurvivalNeedProgressionDefinition {
  need: SurvivalNeed;
  counterKey: SurvivalNeedCounterKey;

  /**
   * Counter values represent completed days despite the
   * legacy "roundsWithout..." persistence field names.
   */

  stages: readonly SurvivalNeedStageDefinition[];

  fatalAtRounds: number;
}

export const SURVIVAL_NEED_PROGRESSIONS = {
  water: {
    need: "water",
    counterKey: "roundsWithoutWater",

    stages: [
      {
        minimumRounds: 2,
        statusId: "thirsty",
        severity: 1,
      },
      {
        minimumRounds: 4,
        statusId: "dehydrated",
        severity: 1,
      },
    ],

    fatalAtRounds: 6,
  },

  food: {
    need: "food",
    counterKey: "roundsWithoutFood",

    stages: [
      {
        minimumRounds: 4,
        statusId: "hungry",
        severity: 1,
      },
      {
        minimumRounds: 6,
        statusId: "starving",
        severity: 1,
      },
    ],

    fatalAtRounds: 8,
  },
} as const satisfies Record<SurvivalNeed, SurvivalNeedProgressionDefinition>;

export function getSurvivalNeedProgression(need: SurvivalNeed): SurvivalNeedProgressionDefinition {
  return SURVIVAL_NEED_PROGRESSIONS[need];
}

export function getSurvivalNeedStage(
  need: SurvivalNeed,
  roundsWithoutNeed: number,
): SurvivalNeedStageDefinition | null {
  if (!Number.isInteger(roundsWithoutNeed) || roundsWithoutNeed < 0) {
    throw new Error(`Survival need counter for "${need}" must be a non-negative integer.`);
  }

  const progression = getSurvivalNeedProgression(need);

  for (let index = progression.stages.length - 1; index >= 0; index -= 1) {
    const stage = progression.stages[index];

    if (stage && roundsWithoutNeed >= stage.minimumRounds) {
      return stage;
    }
  }

  return null;
}

export function isSurvivalNeedFatal(need: SurvivalNeed, roundsWithoutNeed: number): boolean {
  if (!Number.isInteger(roundsWithoutNeed) || roundsWithoutNeed < 0) {
    throw new Error(`Survival need counter for "${need}" must be a non-negative integer.`);
  }

  return roundsWithoutNeed >= getSurvivalNeedProgression(need).fatalAtRounds;
}
