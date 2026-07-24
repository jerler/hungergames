import { applyAutomaticResolutionEvents } from "~/game/engine/apply-automatic-resolution-events";
import { chooseSimultaneousFatalitySurvivor } from "~/game/engine/simultaneous-fatality";
import { createFatalNeedResolutionEvent } from "~/game/events/catalogue/survival/need-resolution-events";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { GameState, GameTribute, RoundReference, StatusEffect } from "~/game/types/game-state";

import type { SurvivalNeed } from "./survival-schema";
import {
  getSurvivalNeedProgression,
  getSurvivalNeedStage,
  isSurvivalNeedFatal,
  type SurvivalNeedStatusId,
} from "./survival-thresholds";

const SURVIVAL_NEEDS = ["water", "food"] as const satisfies readonly SurvivalNeed[];

function createNeedStatusSourceId(
  tributeId: string,
  need: SurvivalNeed,
  statusId: SurvivalNeedStatusId,
  round: RoundReference,
): string {
  return ["system", "need-progression", round.period, round.day, tributeId, need, statusId].join(
    ":",
  );
}

function getNeedStatusIds(need: SurvivalNeed): ReadonlySet<SurvivalNeedStatusId> {
  return new Set(getSurvivalNeedProgression(need).stages.map((stage) => stage.statusId));
}

function isNeedStatus(
  status: StatusEffect,
  needStatusIds: ReadonlySet<SurvivalNeedStatusId>,
): boolean {
  return needStatusIds.has(status.definitionId as SurvivalNeedStatusId);
}

function getRoundsWithoutNeed(tribute: GameTribute, need: SurvivalNeed): number {
  const progression = getSurvivalNeedProgression(need);

  return tribute.survival[progression.counterKey];
}

function synchronizeSingleSurvivalNeed(
  tribute: GameTribute,
  need: SurvivalNeed,
  round: RoundReference,
): GameTribute {
  const roundsWithoutNeed = getRoundsWithoutNeed(tribute, need);

  const expectedStage = getSurvivalNeedStage(need, roundsWithoutNeed);

  const needStatusIds = getNeedStatusIds(need);

  const existingNeedStatuses = tribute.statuses.filter((status) =>
    isNeedStatus(status, needStatusIds),
  );

  if (
    expectedStage &&
    existingNeedStatuses.length === 1 &&
    existingNeedStatuses[0]?.definitionId === expectedStage.statusId
  ) {
    return tribute;
  }

  if (!expectedStage && existingNeedStatuses.length === 0) {
    return tribute;
  }

  const unrelatedStatuses = tribute.statuses.filter(
    (status) => !isNeedStatus(status, needStatusIds),
  );

  if (!expectedStage) {
    return {
      ...tribute,
      statuses: unrelatedStatuses,
    };
  }

  const existingExpectedStatus = existingNeedStatuses.find(
    (status) => status.definitionId === expectedStage.statusId,
  );

  const expectedStatus =
    existingExpectedStatus ??
    createStatusEffectInstance(
      createNeedStatusSourceId(tribute.id, need, expectedStage.statusId, round),

      tribute.id,
      expectedStage.statusId,
      expectedStage.severity,
      round,
    );

  return {
    ...tribute,

    statuses: [...unrelatedStatuses, expectedStatus],
  };
}

export function synchronizeSurvivalNeedStatuses(
  tribute: GameTribute,
  round: RoundReference,
): GameTribute {
  return SURVIVAL_NEEDS.reduce(
    (currentTribute, need) => synchronizeSingleSurvivalNeed(currentTribute, need, round),
    tribute,
  );
}

function advanceLivingTributeNeeds(tribute: GameTribute, round: RoundReference): GameTribute {
  const tributeWithAdvancedCounters: GameTribute = {
    ...tribute,

    survival: {
      ...tribute.survival,

      roundsWithoutFood: tribute.survival.roundsWithoutFood + 1,

      roundsWithoutWater: tribute.survival.roundsWithoutWater + 1,
    },
  };

  return synchronizeSurvivalNeedStatuses(tributeWithAdvancedCounters, round);
}

/**
 * Water takes priority when both deprivation counters
 * become fatal during the same completed round.
 *
 * The tribute still receives only one death event.
 */
function getFatalSurvivalNeed(tribute: GameTribute): SurvivalNeed | null {
  for (const need of SURVIVAL_NEEDS) {
    if (isSurvivalNeedFatal(need, getRoundsWithoutNeed(tribute, need))) {
      return need;
    }
  }

  return null;
}

function spareTributeFromFatalNeeds(tribute: GameTribute, round: RoundReference): GameTribute {
  const waterProgression = getSurvivalNeedProgression("water");

  const foodProgression = getSurvivalNeedProgression("food");

  const sparedTribute: GameTribute = {
    ...tribute,

    survival: {
      ...tribute.survival,

      /*
       * This mirrors fatal-status survivor handling:
       * the tribute remains in critical condition but
       * no longer occupies a fatal unresolved state.
       */
      roundsWithoutWater: Math.min(
        tribute.survival.roundsWithoutWater,

        waterProgression.fatalAtRounds - 1,
      ),

      roundsWithoutFood: Math.min(
        tribute.survival.roundsWithoutFood,

        foodProgression.fatalAtRounds - 1,
      ),
    },
  };

  return synchronizeSurvivalNeedStatuses(sparedTribute, round);
}

/**
 * Advances persistent food and water deprivation after
 * the completed round, synchronizes visible need stages,
 * and resolves fatal thresholds as visible events.
 */
export function advanceSurvivalNeedsAfterRound(state: GameState): GameState {
  const completedRound = state.currentRound;

  if (!completedRound) {
    return state;
  }

  const tributesWithAdvancedNeeds = state.tributes.map((tribute) =>
    tribute.isAlive ? advanceLivingTributeNeeds(tribute, completedRound) : tribute,
  );

  const livingTributes = tributesWithAdvancedNeeds.filter((tribute) => tribute.isAlive);

  const fatalCandidates = livingTributes.filter(
    (tribute) => getFatalSurvivalNeed(tribute) !== null,
  );

  const sparedTributeId = chooseSimultaneousFatalitySurvivor(fatalCandidates, livingTributes);

  const stateWithAdvancedNeeds: GameState = {
    ...state,

    tributes: tributesWithAdvancedNeeds.map((tribute) =>
      tribute.id === sparedTributeId
        ? spareTributeFromFatalNeeds(tribute, completedRound)
        : tribute,
    ),
  };

  const fatalEvents = fatalCandidates
    .filter((tribute) => tribute.id !== sparedTributeId)
    .map((tribute) => {
      const fatalNeed = getFatalSurvivalNeed(tribute);

      if (!fatalNeed) {
        throw new Error(`Fatal survival need could not be resolved for tribute "${tribute.id}".`);
      }

      return createFatalNeedResolutionEvent(tribute, fatalNeed, completedRound);
    });

  return applyAutomaticResolutionEvents(stateWithAdvancedNeeds, fatalEvents);
}
