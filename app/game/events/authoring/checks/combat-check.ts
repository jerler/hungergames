import type { RandomSource } from "~/game/engine/random";
import { getCombatScore, getSurvivalScore } from "~/game/engine/stat-formulas";
import type { EventItemSelection } from "~/game/events/event-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
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
  /**
   * Extension point for positional, tactical, or status-based
   * attacker advantages.
   */
  attackerAdvantage?: WeaponAttackModifier;

  /**
   * Extension point for future active defense mechanics.
   *
   * Personal survival equipment is already represented in
   * getSurvivalScore(). This hook is currently inactive unless
   * explicitly supplied by an event.
   */
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

    /*
     * A borrowed weapon is not present in the acting tribute's
     * inventory and therefore is not included in getCombatScore().
     */
    const sharedWeaponBonus =
      weapon.owner.id === killer.id
        ? 0
        : (getItemDefinition(weapon.item.definitionId).combatBonus ?? 0);

    const attackScore = Math.max(
      0.25,
      getCombatScore(killer) +
        sharedWeaponBonus +
        getModifier("attacker advantage", attackerAdvantage, context),
    );

    const defenseScore = Math.max(
      0.25,
      getSurvivalScore(victim) + getModifier("victim defense", victimDefense, context),
    );

    const successChance = attackScore / (attackScore + defenseScore);

    return random() < successChance ? "success" : "failure";
  };
}
