import type { RoundReference, Vendetta, VendettaKind } from "~/game/types/game-state";

export const ROMANTIC_VENDETTA_CHANCE = 0.75;
export const STANDARD_VENDETTA_CHANCE = 0.5;

export function createVendettaInstance(
  eventId: string,
  hunterTributeId: string,
  targetTributeId: string,
  kind: VendettaKind,
  round: RoundReference,
): Vendetta {
  if (hunterTributeId === targetTributeId) {
    throw new Error("A tribute cannot form a vendetta against themself.");
  }

  return {
    id: [eventId, "vendetta", hunterTributeId, targetTributeId].join(":"),

    hunterTributeId,
    targetTributeId,
    kind,

    sourceEventId: eventId,

    createdRound: {
      ...round,
    },
  };
}
