import { areTributesInSameTruce, getActiveTruceForTribute } from "~/game/truces/truce-engine";
import type { GameState, GameTribute } from "~/game/types/game-state";

export type TruceGroupSize = 2 | 3 | 4 | 5 | 6;

export const TRUCE_GROUP_SIZE_WEIGHTS = [
  {
    size: 2,
    weight: 60,
  },
  {
    size: 3,
    weight: 25,
  },
  {
    size: 4,
    weight: 10,
  },
  {
    size: 5,
    weight: 4,
  },
  {
    size: 6,
    weight: 1,
  },
] satisfies readonly {
  size: TruceGroupSize;
  weight: number;
}[];

export function getDistrictAffinityWeight(
  firstTribute: GameTribute,
  secondTribute: GameTribute,
): number {
  const distance = Math.abs(firstTribute.district - secondTribute.district);

  switch (distance) {
    case 0:
      return 3;

    case 1:
      return 2;

    case 2:
      return 1.35;

    case 3:
      return 0.9;

    case 4:
      return 0.6;

    default:
      return 0.3;
  }
}

export function getAverageDistrictAffinityWeight(
  candidate: GameTribute,
  currentMembers: readonly GameTribute[],
): number {
  if (currentMembers.length === 0) {
    return 1;
  }

  const totalAffinity = currentMembers.reduce(
    (total, member) => total + getDistrictAffinityWeight(candidate, member),
    0,
  );

  return totalAffinity / currentMembers.length;
}

export function getCooperativeTruceWeight(
  state: GameState,
  candidate: GameTribute,
  selectedParticipants: readonly GameTribute[],
): number {
  /*
   * Slightly favour choosing a tribute
   * who already has partners available.
   */
  if (selectedParticipants.length === 0) {
    return getActiveTruceForTribute(state, candidate.id) ? 1.5 : 1;
  }

  const isPartner = selectedParticipants.some((selectedTribute) =>
    areTributesInSameTruce(state, candidate.id, selectedTribute.id),
  );

  return isPartner ? 5 : 1;
}
