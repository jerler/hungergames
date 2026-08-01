import {
  createFatalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";

import { isLowBrawn, isLowBrains, isLowLuck, statSelectionProfile } from "./stat-gated-helpers";

const CRINGE: EventDefinition = {
  id: "mixed-stat-cringe",
  category: "hazard",
  periods: ["day", "night"],
  baseWeight: 1.5,
  tags: ["hazard", "status"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isLowBrawn(tribute) || isLowLuck(tribute),
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");

    return {
      text:
        `${actor.snapshot.name} loses a fistfight with a squirrel. Don't ask me to describe it; ` +
        `I really can't. Just know everyone left feeling pretty bad about what happened.`,
      changes: [
        createStatusChange(eventId, actor, "injured", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const WEAK_PEOPLE_NEED_FATALITIES_TOO: EventDefinition = {
  id: "mixed-stat-weak-people-need-fatalities-too",
  category: "fatal",
  periods: ["day", "night"],
  baseWeight: 0.8,
  tags: ["fatal", "combat", "environment"],
  selectionProfile: statSelectionProfile(3),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isLowBrawn(tribute) && isLowBrains(tribute),
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const text =
      `${actor.snapshot.name} spots ${target.snapshot.name} resting beneath a tree. Knowing ${actorPronouns.subject} would not stand a chance in hand-to-hand combat, ` +
      `${actorPronouns.subject} quietly climbs the tree instead. Once high enough, ${actorPronouns.subject} leaps off and cannonballs onto ${target.snapshot.name}, ` +
      `breaking ${targetPronouns.possessiveAdjective} neck with a satisfying crunch.`;

    return {
      text,
      changes: [
        ...createFatalChanges(
          target,
          "mixed-stat-cannonball-kill",
          "Crushed in a surprise attack",
          `${target.snapshot.name} is crushed by ${actor.snapshot.name}'s surprise attack.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const KOWABUNGA: EventDefinition = {
  id: "mixed-stat-kowabunga",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.55,
  tags: ["fatal", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isLowBrawn(tribute) || isLowLuck(tribute),
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const text =
      `${actor.snapshot.name} tries to collect water from the river but is quickly swept away. ` +
      `The current carries ${pronouns.object} through the arena before rocketing ${pronouns.object} over a waterfall to ${pronouns.possessiveAdjective} demise.`;

    return {
      text,
      changes: createFatalChanges(
        actor,
        "mixed-stat-waterfall",
        "Swept over a waterfall",
        `${actor.snapshot.name} is swept through the arena and killed by a waterfall.`,
      ),
    };
  },
};

export const MIXED_STAT_GATED_EVENTS = [
  CRINGE,
  WEAK_PEOPLE_NEED_FATALITIES_TOO,
  KOWABUNGA,
] satisfies readonly EventDefinition[];
