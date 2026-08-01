import { createSurvivalChanges } from "~/game/events/event-change-builders";
import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";

import { hasStatus, isHighBrains, statSelectionProfile } from "../stat-gated-helpers";

const SICK_BUT_SMART: EventDefinition = {
  id: "high-brains-sick-but-smart",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.8,
  tags: ["survival", "status", "combat"],
  selectionProfile: statSelectionProfile(4, ["status-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isHighBrains(tribute) && hasStatus(tribute, "poisoned"),
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} is cornered by ${target.snapshot.name}, who lunges and pins ${actorPronouns.object} to the ground. ` +
        `Thinking quickly, ${actor.snapshot.name} begins coughing directly into ${target.snapshot.name}'s face. ` +
        `Given ${actor.snapshot.name}'s poison-pale complexion, ${target.snapshot.name} jumps up and runs, unwilling to discover whether it is contagious.`,
      changes: createSurvivalChanges([actor, target]),
    };
  },
};

export const HIGH_BRAINS_EVENTS = [SICK_BUT_SMART] satisfies readonly EventDefinition[];
