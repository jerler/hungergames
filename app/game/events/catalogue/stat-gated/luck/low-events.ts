import {
  createFatalChanges,
  createItemUseChange,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameChange, GameTribute, InventoryItem } from "~/game/types/game-state";

import {
  getLowercaseItemLabel,
  hasStatus,
  isLowLuck,
  statSelectionProfile,
} from "../stat-gated-helpers";

function createSatisfyNeedChange(tribute: GameTribute, need: "food" | "water"): GameChange {
  return {
    type: "satisfy-survival-need",
    tributeId: tribute.id,
    need,
  };
}

function getOptionalSelectedItem(
  context: EventResolutionContext,
  roleId: string,
): InventoryItem | null {
  return context.itemsByRole?.[roleId]?.[0]?.item ?? null;
}

const CAMOUFAILURE: EventDefinition = {
  id: "low-luck-camoufailure",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.65,
  tags: ["fatal", "combat", "ambush", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowLuck,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
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
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} spends several hours covering ${pronouns.reflexive} in mud and leaves, meticulously crafting a disguise. ` +
        `Finally, ${pronouns.subject} hears ${target.snapshot.name} approaching and dives into the bushes, putting the disguise to the test. ` +
        `Unfortunately, ${actor.snapshot.name} chose the only patch of stinging nettles nearby and jumps back into the clearing, practically at ${target.snapshot.name}'s bloodthirsty feet.`,
      changes: [
        ...createFatalChanges(
          actor,
          "low-luck-camoufailure",
          "Killed after hiding in stinging nettles",
          `${actor.snapshot.name} leaps from a patch of stinging nettles and is killed by ${target.snapshot.name}.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const GROUNDED_HOG: EventDefinition = {
  id: "low-luck-grounded-hog",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.2,
  tags: ["hazard", "environment", "status"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowLuck,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");

    return {
      text: `${actor.snapshot.name} gets into a bloody fight with a groundhog over a hiding place.`,
      changes: [
        createStatusChange(eventId, actor, "injured", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const PERSONAL_RAIN_CLOUD: EventDefinition = {
  id: "low-luck-personal-rain-cloud",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.15,
  tags: ["hazard", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowLuck,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} waits out a sudden downpour beneath the only dense tree in sight. ` +
        `Once the rain stops, the branch above ${pronouns.object} releases all of its collected water at once, soaking ${actor.snapshot.name}.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const STUCK_IN_THE_MUD: EventDefinition = {
  id: "low-luck-stuck-in-the-mud",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.8,
  tags: ["hazard", "deprivation", "resource", "status"],
  selectionProfile: statSelectionProfile(5, ["status-requirement", "deprivation-requirement"]),
  recoveryProfile: {
    targets: [
      {
        kind: "survival-need",
        roleId: "actor",
        need: "water",
      },
    ],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isLowLuck(tribute) && hasStatus(tribute, "thirsty"),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "status",
            roleId: "actor",
            statusId: "thirsty",
            present: true,
          },
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} finally comes across some fresh water and, in ${pronouns.possessiveAdjective} relief, crawls toward the stream. ` +
        `Unfortunately, both hands become stuck in thick muck, leaving ${actor.snapshot.name} struggling for hours to break free while the water remains tantalizingly just out of reach.`,
      changes: [
        createSatisfyNeedChange(actor, "water"),
        createStatusChange(eventId, actor, "exhausted", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const WATER_LANDING: EventDefinition = {
  id: "low-luck-water-landing",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.8,
  tags: ["hazard", "deprivation", "resource", "status"],
  selectionProfile: statSelectionProfile(5, ["status-requirement", "deprivation-requirement"]),
  recoveryProfile: {
    targets: [
      {
        kind: "survival-need",
        roleId: "actor",
        need: "water",
      },
    ],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isLowLuck(tribute) && hasStatus(tribute, "thirsty"),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "status",
            roleId: "actor",
            statusId: "thirsty",
            present: true,
          },
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} kneels beside the river to drink when the bank collapses beneath ${pronouns.object}. ` +
        `${pronouns.Subject} falls face-first into the shallowest part of the river, chips a tooth on a rock, and emerges having swallowed mostly mud.`,
      changes: [
        createSatisfyNeedChange(actor, "water"),
        createStatusChange(eventId, actor, "injured", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const NATURE_CALLS: EventDefinition = {
  id: "low-luck-nature-calls",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.6,
  tags: ["fatal", "combat", "ambush", "weapon", "item"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowLuck,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      optionalItemTags: ["weapon"],
      optionalItemAccess: "owned",
      opposesRoleIds: ["actor"],
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);
    const weapon = getOptionalSelectedItem(context, "target");

    const ending = weapon
      ? `${target.snapshot.name} ends it swiftly by drawing ${targetPronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)}.`
      : `${target.snapshot.name} suplexes ${actor.snapshot.name} into the ground, breaking ${actor.snapshot.name}'s neck, pants still unzipped.`;

    return {
      text:
        `${actor.snapshot.name} steps behind a bush for a moment of privacy, unaware that ${target.snapshot.name} has chosen the same bush as a hiding place. ` +
        `The encounter is deeply uncomfortable for everyone until ${ending}`,
      changes: [
        ...(weapon ? [createItemUseChange(target, weapon, "nature-calls")] : []),
        ...createFatalChanges(
          actor,
          "low-luck-nature-calls",
          "Killed during an awkward encounter",
          `${actor.snapshot.name} is killed by ${target.snapshot.name} during an unfortunate search for privacy.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const BIRD_STRIKE: EventDefinition = {
  id: "low-luck-bird-strike",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.15,
  tags: ["hazard", "environment", "status"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowLuck,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} looks upward after hearing wings overhead, only to get a face full of bird poop, ` +
        `solidly blinding ${pronouns.object} for several uncomfortable minutes.`,
      changes: [
        createStatusChange(eventId, actor, "disoriented", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const STEP_ON_A_WASP_NEST: EventDefinition = {
  id: "low-luck-step-on-a-wasp-nest",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.6,
  tags: ["fatal", "combat", "ambush", "environment", "weapon", "item"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowLuck,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      optionalItemTags: ["weapon"],
      optionalItemAccess: "owned",
      opposesRoleIds: ["actor"],
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const weapon = getOptionalSelectedItem(context, "target");

    let ending: string;

    if (weapon?.definitionId === "bow") {
      ending =
        `${target.snapshot.name} lines up the shot and kills ${actor.snapshot.name} ` +
        `before ${actorPronouns.subject} and the swarm get too close.`;
    } else if (weapon) {
      ending =
        `${target.snapshot.name} waits for the swarming to die down before finishing the job ` +
        `with ${targetPronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)}.`;
    } else {
      ending =
        `${target.snapshot.name} waits for the swarming to die down before finishing the job ` +
        `with a swift twist of ${actor.snapshot.name}'s neck.`;
    }

    return {
      text:
        `${actor.snapshot.name} spots ${target.snapshot.name} in the distance and decides to creep up for a surprise attack. ` +
        `All is going well until ${actorPronouns.subject} steps on a wasp nest, sending ${actorPronouns.object} screaming and swatting at the insects. ` +
        ending,
      changes: [
        ...(weapon ? [createItemUseChange(target, weapon, "low-luck-wasp-nest")] : []),
        ...createFatalChanges(
          actor,
          "low-luck-step-on-a-wasp-nest",
          "Killed after disturbing a wasp nest",
          `${actor.snapshot.name} steps on a wasp nest and is killed by ${target.snapshot.name}.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const RABBIT_HOLE: EventDefinition = {
  id: "low-luck-rabbit-hole",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.6,
  tags: ["hazard", "deprivation", "resource", "environment", "status"],
  selectionProfile: statSelectionProfile(5, ["status-requirement", "deprivation-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isLowLuck(tribute) && hasStatus(tribute, "hungry"),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "status",
            roleId: "actor",
            statusId: "hungry",
            present: true,
          },
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} spots a rabbit and gives chase, already imagining dinner. ` +
        `${pronouns.PossessiveAdjective} foot drops into the rabbit's burrow, pitching ${actor.snapshot.name} forward and twisting ${pronouns.possessiveAdjective} ankle while the rabbit disappears into the forest.`,
      changes: [
        createStatusChange(eventId, actor, "injured", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const FORAGING_DIGNITY: EventDefinition = {
  id: "low-luck-foraging-dignity",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.5,
  tags: ["hazard", "deprivation", "resource", "environment"],
  selectionProfile: statSelectionProfile(5, ["status-requirement", "deprivation-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isLowLuck(tribute) && hasStatus(tribute, "hungry"),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "status",
            roleId: "actor",
            statusId: "hungry",
            present: true,
          },
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} excitedly reaches for a piece of fruit hanging from a low branch. ` +
        `Just before ${pronouns.subject} can grab it, the fruit falls, bounces off ${pronouns.possessiveAdjective} forehead, rolls down a hill, and disappears into the river.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const FORAGING_DIGNITY_AGAIN: EventDefinition = {
  id: "low-luck-foraging-dignity-again",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.5,
  tags: ["hazard", "deprivation", "resource", "environment"],
  selectionProfile: statSelectionProfile(5, ["status-requirement", "deprivation-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isLowLuck(tribute) && hasStatus(tribute, "hungry"),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "status",
            roleId: "actor",
            statusId: "hungry",
            present: true,
          },
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} attempts to catch fish with ${pronouns.possessiveAdjective} bare hands. ` +
        `Incredibly, ${pronouns.subject} manages to snag a salmon! That is, until the fish slaps ${pronouns.object} across the face, ` +
        `launches itself over ${pronouns.possessiveAdjective} shoulder, and flops safely back into the river.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const BERRY_UNFORTUNATE: EventDefinition = {
  id: "low-luck-berry-unfortunate",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.5,
  tags: ["hazard", "deprivation", "resource", "environment"],
  selectionProfile: statSelectionProfile(5, ["status-requirement", "deprivation-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isLowLuck(tribute) && hasStatus(tribute, "hungry"),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "status",
            roleId: "actor",
            statusId: "hungry",
            present: true,
          },
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} finds a bush covered in edible berries and begins gathering them into ${pronouns.possessiveAdjective} shirt. ` +
        `The fabric tears without warning, dropping every berry into a muddy puddle between ${pronouns.possessiveAdjective} feet.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const LAST_SIP: EventDefinition = {
  id: "low-luck-last-sip",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.5,
  tags: ["hazard", "deprivation", "resource", "environment"],
  selectionProfile: statSelectionProfile(5, ["status-requirement", "deprivation-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isLowLuck(tribute) && hasStatus(tribute, "thirsty"),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "status",
            roleId: "actor",
            statusId: "thirsty",
            present: true,
          },
          {
            kind: "stat",
            roleId: "actor",
            stat: "luck",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} finds rainwater gathered in a large concave leaf. ` +
        `Just before drinking, ${pronouns.subject} sneezes, hits the leaf, and watches the entire supply disappear into the dry soil.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

export const LOW_LUCK_EVENTS = [
  CAMOUFAILURE,
  GROUNDED_HOG,
  PERSONAL_RAIN_CLOUD,
  STUCK_IN_THE_MUD,
  WATER_LANDING,
  NATURE_CALLS,
  BIRD_STRIKE,
  STEP_ON_A_WASP_NEST,
  RABBIT_HOLE,
  FORAGING_DIGNITY,
  FORAGING_DIGNITY_AGAIN,
  BERRY_UNFORTUNATE,
  LAST_SIP,
] satisfies readonly EventDefinition[];
