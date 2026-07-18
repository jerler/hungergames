import { formatRoundLabel, getNextRound, getRoundSequence } from "~/game/engine/rounds";
import type { GameState, GameTribute, ResolvedEvent } from "~/game/types/game-state";

export function selectLivingTributes(state: GameState): GameTribute[] {
  return state.tributes.filter((tribute) => tribute.isAlive);
}

export function selectDeadTributes(state: GameState): GameTribute[] {
  return state.tributes.filter((tribute) => !tribute.isAlive);
}

export function selectVictor(state: GameState): GameTribute | null {
  if (!state.victorTributeId) {
    return null;
  }

  return state.tributes.find((tribute) => tribute.id === state.victorTributeId) ?? null;
}

export function selectRevealedRoundEvents(state: GameState): ResolvedEvent[] {
  return state.roundEvents.slice(0, state.revealedEventCount);
}

export function selectHiddenEventCount(state: GameState): number {
  return Math.max(0, state.roundEvents.length - state.revealedEventCount);
}

export function selectNextRoundLabel(state: GameState): string {
  return formatRoundLabel(getNextRound(state.currentRound));
}

export interface DeathRoundStatistic {
  roundLabel: string;
  roundSequence: number;
  deaths: number;
}

export function selectDeathsByRound(state: GameState): DeathRoundStatistic[] {
  const deathsByRound = new Map<string, DeathRoundStatistic>();

  for (const tribute of selectDeadTributes(state)) {
    if (!tribute.death) {
      continue;
    }

    const roundLabel = formatRoundLabel(tribute.death.round);

    const existingStatistic = deathsByRound.get(roundLabel);

    if (existingStatistic) {
      existingStatistic.deaths += 1;
      continue;
    }

    deathsByRound.set(roundLabel, {
      roundLabel,
      roundSequence: getRoundSequence(tribute.death.round),
      deaths: 1,
    });
  }

  return [...deathsByRound.values()].sort(
    (firstStatistic, secondStatistic) =>
      firstStatistic.roundSequence - secondStatistic.roundSequence,
  );
}

export function selectKillLeaders(state: GameState): GameTribute[] {
  const highestKillCount = Math.max(...state.tributes.map((tribute) => tribute.statistics.kills));

  if (highestKillCount === 0) {
    return [];
  }

  return state.tributes.filter((tribute) => tribute.statistics.kills === highestKillCount);
}

export function selectCompletedRoundCount(state: GameState): number {
  return state.currentRound ? getRoundSequence(state.currentRound) : 0;
}
