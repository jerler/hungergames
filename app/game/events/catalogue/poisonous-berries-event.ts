import {
  requireParticipants,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { getActiveTruceForTribute } from "~/game/truces/truce-engine";
import type { GameChange, GameState, GameTribute } from "~/game/types/game-state";
import { createJointVictoryOutcome } from "~/game/victory/victory-outcome";

function createSurvivalChanges(tributes: readonly GameTribute[]): GameChange[] {
  return tributes.map((tribute) => ({
    type: "increment-statistic",

    tributeId: tribute.id,

    statistic: "eventsSurvived",

    amount: 1,
  }));
}

export function isPoisonousBerriesFinaleEligible(state: GameState): boolean {
  const livingTributes = state.tributes.filter((tribute) => tribute.isAlive);

  if (livingTributes.length !== 2) {
    return false;
  }

  const [firstTribute, secondTribute] = livingTributes;

  const truce = getActiveTruceForTribute(state, firstTribute.id);

  return (
    truce?.kind === "romantic" &&
    truce.tributeIds.length === 2 &&
    truce.tributeIds.includes(secondTribute.id)
  );
}

export const POISONOUS_BERRIES_JOINT_VICTORY_EVENT: EventDefinition = {
  id: "poisonous-berries-joint-victory",

  category: "survival",

  tags: ["survival", "truce", "cooperative", "romantic", "victory"],

  periods: ["day", "night"],

  /*
   * The sequencer forces this event when
   * eligible, so its ordinary weight is
   * not used to determine the finale.
   */
  baseWeight: 1,

  roles: [
    {
      id: "partners",

      count: 2,

      isEligible: (tribute, { state }) => {
        if (!isPoisonousBerriesFinaleEligible(state)) {
          return false;
        }

        return Boolean(getActiveTruceForTribute(state, tribute.id)?.kind === "romantic");
      },
    },
  ],

  isEligible: ({ state }) => isPoisonousBerriesFinaleEligible(state),

  resolve({ state, eventId, participantsByRole }): EventResolution {
    const partners = requireParticipants(participantsByRole, "partners");

    if (partners.length !== 2) {
      throw new Error("The poisonous-berries finale requires exactly two partners.");
    }

    const [firstPartner, secondPartner] = partners;

    const truce = getActiveTruceForTribute(state, firstPartner.id);

    if (truce?.kind !== "romantic" || !truce.tributeIds.includes(secondPartner.id)) {
      throw new Error("The poisonous-berries finale requires an active romantic pair.");
    }

    const text =
      `${firstPartner.snapshot.name} and ` +
      `${secondPartner.snapshot.name} refuse to turn on one another. ` +
      "They raise poisonous berries to their lips, threatening to leave " +
      "the Capitol without a victor. At the final moment, the Games are stopped " +
      "and both are declared victorious.";

    return {
      text,

      changes: [
        {
          type: "declare-victory",

          outcome: createJointVictoryOutcome(firstPartner.id, secondPartner.id, eventId),
        },

        ...createSurvivalChanges(partners),
      ],
    };
  },
};
