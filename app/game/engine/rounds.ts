import type { RoundReference } from "~/game/types/game-state";

export function getNextRound(currentRound: RoundReference | null): RoundReference {
  if (!currentRound) {
    return {
      day: 1,
      period: "day",
    };
  }

  if (currentRound.period === "day") {
    return {
      day: currentRound.day,
      period: "night",
    };
  }

  return {
    day: currentRound.day + 1,
    period: "day",
  };
}

export function getRoundSequence(round: RoundReference): number {
  return round.period === "day" ? round.day * 2 - 1 : round.day * 2;
}

export function formatRoundLabel(round: RoundReference): string {
  const period = round.period === "day" ? "Day" : "Night";

  return `${period} ${round.day}`;
}

export function createRoundSeed(gameSeed: string, round: RoundReference): string {
  return `${gameSeed}:${getRoundSequence(round)}`;
}
