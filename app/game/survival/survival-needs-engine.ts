import { applyAutomaticResolutionEvents } from "~/game/engine/apply-automatic-resolution-events";
import { chooseSimultaneousFatalitySurvivor } from "~/game/engine/simultaneous-fatality";
import { createFatalNeedResolutionEvent } from "~/game/events/catalogue/survival/need-resolution-events";
import { createStatusEffectInstance, upsertStatusEffect } from "~/game/statuses/status-engine";
import { getConflictingStatusIds } from "~/game/statuses/status-conflicts";
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

  /*
   * No need stage should currently be active.
   *
   * Preserve the original tribute object when nothing
   * needs to change.
   */
  if (!expectedStage) {
    if (existingNeedStatuses.length === 0) {
      return tribute;
    }

    return {
      ...tribute,

      statuses: tribute.statuses.filter((status) => !isNeedStatus(status, needStatusIds)),
    };
  }

  const existingExpectedStatus = existingNeedStatuses.find(
    (status) => status.definitionId === expectedStage.statusId,
  );

  const conflictingStatusIds = new Set(getConflictingStatusIds(expectedStage.statusId));

  const hasConflictingStatus = tribute.statuses.some((status) =>
    conflictingStatusIds.has(status.definitionId),
  );

  /*
   * Preserve the original tribute object when it already
   * has exactly the correct need stage and no conflict.
   *
   * The conflict check is important. Without it, a tribute
   * with both hungry and well-fed would incorrectly return
   * unchanged.
   */
  if (
    existingNeedStatuses.length === 1 &&
    existingExpectedStatus !== undefined &&
    !hasConflictingStatus
  ) {
    return tribute;
  }

  /*
   * Remove every existing stage for this need before
   * inserting the counter-appropriate stage.
   *
   * This handles invalid combinations such as:
   *
   * thirsty + dehydrated
   * hungry + starving
   */
  const statusesWithoutNeedStages = tribute.statuses.filter(
    (status) => !isNeedStatus(status, needStatusIds),
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

    /*
     * upsertStatusEffect also removes statuses that
     * conflict with the need stage.
     *
     * Therefore hungry or starving automatically removes
     * well-fed.
     */
    statuses: upsertStatusEffect(statusesWithoutNeedStages, expectedStatus),
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
 * Advances persistent food and water deprivation after a
 * completed night, synchronizes visible need stages, and
 * resolves fatal thresholds as visible events.
 *
 * The legacy counter field names still say "rounds", but
 * each increment now represents one complete arena day.
 */
export function advanceSurvivalNeedsAfterRound(state: GameState): GameState {
  const completedRound = state.currentRound;

  /*
   * Food and water pressure advances once per completed day.
   *
   * Daytime completion is only the midpoint of that cycle;
   * the counters advance after the corresponding night ends.
   */
  if (!completedRound || completedRound.period !== "night") {
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
