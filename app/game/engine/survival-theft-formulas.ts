import { getEffectiveStats } from "~/game/engine/effective-stats";
import { getAwarenessScore, getCombatScore } from "~/game/engine/stat-formulas";
import { clampStatCheckDifficulty } from "~/game/events/event-resolution-helpers";
import type { ParticipantSelectionContext } from "~/game/events/event-schema";
import { isMeaningfullyStrongerTheftTarget } from "~/game/engine/theft-formulas";
import { isEligibleForDeprivationStatusEvent } from "~/game/survival/survival-history";
import type { SurvivalNeed } from "~/game/survival/survival-schema";
import type { GameTribute, RoundReference } from "~/game/types/game-state";
import type { TributeStatValue } from "~/game/types/tribute";

const MINIMUM_RESOURCE_THEFT_WEIGHT = 0.1;

function getMatchingStatusId(need: SurvivalNeed): "hungry" | "thirsty" {
  return need === "food" ? "hungry" : "thirsty";
}

function hasMatchingDeprivationStatus(tribute: GameTribute, need: SurvivalNeed): boolean {
  const statusId = getMatchingStatusId(need);

  return tribute.statuses.some((status) => status.definitionId === statusId);
}

function requireSelectedThief(context: ParticipantSelectionContext): GameTribute {
  const thief = context.participantsByRole.thief?.[0];

  if (!thief) {
    throw new Error("A resource-theft target requires the thief role to be selected first.");
  }

  return thief;
}

export function isEligibleSurvivalNeedTheftTarget(
  need: SurvivalNeed,
  target: GameTribute,
  context: ParticipantSelectionContext,
): boolean {
  const thief = requireSelectedThief(context);

  return (
    !hasMatchingDeprivationStatus(target, need) &&
    !isEligibleForDeprivationStatusEvent(context.round, target, need) &&
    isMeaningfullyStrongerTheftTarget(target, thief)
  );
}

export function getSurvivalNeedTheftThiefWeight(
  need: SurvivalNeed,
  thief: GameTribute,
  context: ParticipantSelectionContext,
): number {
  const { brains, luck } = getEffectiveStats(thief);

  const deprivationMotivation = hasMatchingDeprivationStatus(thief, need)
    ? 2.4
    : isEligibleForDeprivationStatusEvent(context.round, thief, need)
      ? 1.8
      : 0.75;

  const aptitudeFactor = 1 + brains * 0.25 + luck * 0.2;

  const combatAlternativeFactor = 1 / (1 + Math.max(0, getCombatScore(thief) - 2.5) * 0.2);

  return Math.max(
    MINIMUM_RESOURCE_THEFT_WEIGHT,
    aptitudeFactor * combatAlternativeFactor * deprivationMotivation,
  );
}

export function getSurvivalNeedTheftTargetWeight(
  target: GameTribute,
  context: ParticipantSelectionContext,
): number {
  const thief = requireSelectedThief(context);
  const combatScore = getCombatScore(target);
  const awarenessScore = getAwarenessScore(target, context.round);
  const strengthAdvantage = Math.max(0, combatScore - getCombatScore(thief));

  return Math.max(
    MINIMUM_RESOURCE_THEFT_WEIGHT,
    1 + combatScore * 0.25 + awarenessScore * 0.15 + strengthAdvantage * 0.35,
  );
}

export function getSurvivalNeedTheftDifficulty(
  target: GameTribute,
  round: RoundReference,
): TributeStatValue {
  return clampStatCheckDifficulty(
    1 + getAwarenessScore(target, round) * 0.5 + getCombatScore(target) * 0.25,
  );
}
