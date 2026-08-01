import { createFatalChanges, createSurvivalChanges } from "~/game/events/event-change-builders";
import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";

import {
  chooseTextVariant,
  isHighBrawn,
  isLowBrawn,
  statSelectionProfile,
} from "../stat-gated-helpers";

const SACK_OF_POTATOES: EventDefinition = {
  id: "high-brawn-sack-of-potatoes",
  category: "fatal",
  periods: ["day"],
  baseWeight: 1.1,
  tags: ["fatal", "combat"],
  selectionProfile: statSelectionProfile(3),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      isEligible: isLowBrawn,
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const text = chooseTextVariant(random, [
      `${actor.snapshot.name} chases ${target.snapshot.name} through the woods, scoops ${targetPronouns.object} up like a sack of potatoes, ` +
        `throws ${targetPronouns.object} over ${actorPronouns.possessiveAdjective} shoulder, and eventually chucks ${target.snapshot.name} over a cliff.`,
      `${actor.snapshot.name} scoops up ${target.snapshot.name} with ease and whips ${targetPronouns.object} into a tree trunk with a deadly crack.`,
      `${actor.snapshot.name} grabs ${target.snapshot.name} by the ankles, spins ${targetPronouns.object} around, and releases ${targetPronouns.object} into the air. ` +
        `${target.snapshot.name} flies several metres and lands with a deadly crack.`,
      `${actor.snapshot.name} scoops up ${target.snapshot.name} with ease, breaks both of ${targetPronouns.possessiveAdjective} arms, ` +
        `and suplexes ${targetPronouns.object} into the ground, snapping ${targetPronouns.possessiveAdjective} neck.`,
    ]);

    return {
      text,
      changes: [
        ...createFatalChanges(
          target,
          "high-brawn-sack-of-potatoes",
          "Killed by overwhelming strength",
          `${target.snapshot.name} is killed by ${actor.snapshot.name}'s overwhelming strength.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

export const HIGH_BRAWN_EVENTS = [SACK_OF_POTATOES] satisfies readonly EventDefinition[];
