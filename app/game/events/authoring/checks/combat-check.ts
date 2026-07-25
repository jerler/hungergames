import type { EventItemSelection } from "~/game/events/event-schema";

import {
  getBaseCombatScore,
  getSelectedDirectAttackScore,
  getSurvivalScore,
} from "~/game/engine/stat-formulas";

import { getCheckedAttackDefenseBonus } from "~/game/items/defensive-equipment";

import type { RandomSource } from "~/game/engine/random";

import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";

export type WeaponAttackOutcome = "failure" | "success";

export interface WeaponAttackCheckContext {
  state: GameState;
  round: RoundReference;
  random: RandomSource;

  killer: GameTribute;
  victim: GameTribute;
  weapon: EventItemSelection;
}

export type WeaponAttackCheck = (context: WeaponAttackCheckContext) => WeaponAttackOutcome;

export type WeaponAttackModifier = (context: WeaponAttackCheckContext) => number;

export interface OrdinaryAttackCheckOptions {
  attackerAdvantage?: WeaponAttackModifier;
  victimDefense?: WeaponAttackModifier;
}

function getModifier(
  label: string,
  modifier: WeaponAttackModifier | undefined,
  context: WeaponAttackCheckContext,
): number {
  const value = modifier?.(context) ?? 0;

  if (!Number.isFinite(value)) {
    throw new Error(`Ordinary attack check received a non-finite ${label} modifier.`);
  }

  return value;
}

export function ordinaryAttackCheck({
  attackerAdvantage,
  victimDefense,
}: OrdinaryAttackCheckOptions = {}): WeaponAttackCheck {
  return (context) => {
    const { killer, victim, weapon, random } = context;

    const attackScore = Math.max(
      0.25,

      getSelectedDirectAttackScore(killer, weapon) +
        getModifier("attacker advantage", attackerAdvantage, context),
    );

    const defenseScore = Math.max(
      0.25,

      getSurvivalScore(victim) +
        getCheckedAttackDefenseBonus(victim) +
        getModifier("victim defense", victimDefense, context),
    );

    const successChance = attackScore / (attackScore + defenseScore);

    return random() < successChance ? "success" : "failure";
  };
}

/**
 * Exposed for tests and future tactical comparison logic.
 *
 * Ordinary checked attacks should normally call
 * getSelectedDirectAttackScore instead.
 */
export { getBaseCombatScore };
