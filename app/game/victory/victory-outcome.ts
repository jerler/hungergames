import type { GameTribute, JointVictoryOutcome, SoleVictoryOutcome } from "~/game/types/game-state";

export function createSoleVictoryOutcome(victor: GameTribute): SoleVictoryOutcome {
  return {
    kind: "sole",

    victorTributeIds: [victor.id],

    sourceEventId: null,
  };
}

export function createJointVictoryOutcome(
  firstVictorId: string,
  secondVictorId: string,
  sourceEventId: string,
): JointVictoryOutcome {
  return {
    kind: "joint",

    victorTributeIds: [firstVictorId, secondVictorId],

    sourceEventId,

    reason: "poisonous-berries",
  };
}
