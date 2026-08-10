import {
  createFatalChanges,
  createNightRestChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type ParticipantRoleDefinition,
} from "~/game/events/event-schema";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { canFormStandardTruce } from "~/game/truces/truce-lifecycle";
import {
  createTruceInstance,
  getActiveTruceForTribute,
  getTruceFormationPopulationMultiplier,
  STANDARD_TRUCE_EXPIRY_ROUND,
} from "~/game/truces/truce-engine";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameChange, GameState, GameTribute } from "~/game/types/game-state";

import {
  MELEE_WEAPON_IDS,
  TRUCE_EVENT_SIZES,
  chooseTextVariant,
  getActiveTruceOfSize,
  getLowercaseItemLabel,
  getParticipantShapeForSize,
  isHighBrawn,
  isLowBrains,
  isLowBrawn,
  isLowLuck,
  requireSelectedItem,
  statSelectionProfile,
  type TruceEventSize,
} from "../stat-gated-helpers";

const RANGED_WEAPON_IDS = [
  "slingshot",
  "bow",
  "longbow",
  "crossbow",
  "blowgun",
] as const satisfies readonly ItemDefinitionId[];

function createOpposingHighBrawnRoles(
  targetEligibility?: (tribute: GameTribute) => boolean,
): readonly ParticipantRoleDefinition[] {
  return [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
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
      isEligible: targetEligibility,
      opposesRoleIds: ["actor"],
    },
  ];
}

function createSatisfyNeedChange(tribute: GameTribute, need: "food" | "water"): GameChange {
  return {
    type: "satisfy-survival-need",
    tributeId: tribute.id,
    need,
  };
}

function createHighBrawnTruceMemberRoles(
  size: TruceEventSize,
): readonly ParticipantRoleDefinition[] {
  return [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isHighBrawn(tribute) && getActiveTruceOfSize(state, tribute.id, size) !== null,
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
    },
    {
      id: "members",
      count: size - 1,
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];

        if (!actor) {
          return false;
        }

        const truce = getActiveTruceOfSize(state, actor.id, size);

        return truce?.tributeIds.includes(tribute.id) ?? false;
      },
    },
  ];
}

function isSameTruceMember(
  tribute: GameTribute,
  actor: GameTribute | undefined,
  state: GameState,
): boolean {
  if (!actor) {
    return false;
  }

  const truce = getActiveTruceForTribute(state, actor.id);

  return truce?.tributeIds.includes(tribute.id) ?? false;
}

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
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
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
      isEligible: isLowBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "target",
            stat: "brawn",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
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

const UPROOTED: EventDefinition = {
  id: "high-brawn-uprooted",
  category: "survival",
  periods: ["day"],
  baseWeight: 2.2,
  tags: ["survival", "deprivation", "resource"],
  selectionProfile: statSelectionProfile(3, ["deprivation-requirement"]),
  recoveryProfile: {
    targets: [
      {
        kind: "survival-need",
        roleId: "actor",
        need: "food",
      },
    ],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");

    return {
      text:
        `${actor.snapshot.name} finds a patch of carrots and pulls the entire cluster from the ground at once, ` +
        `along with several feet of roots, an alarming amount of soil, and something that kind of looks like a drainage pipe.`,
      changes: [createSatisfyNeedChange(actor, "food"), ...createSurvivalChanges([actor])],
    };
  },
};

const PUMP_ACTION: EventDefinition = {
  id: "high-brawn-pump-action",
  category: "survival",
  periods: ["day"],
  baseWeight: 2.1,
  tags: ["survival", "deprivation", "resource"],
  selectionProfile: statSelectionProfile(3, ["deprivation-requirement"]),
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
      isEligible: (tribute) => tribute.snapshot.stats.brawn === 5,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "eq",
            threshold: 5,
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
        `${actor.snapshot.name} finds a rusty water pump that doesn't want to move. With a great heave, ` +
        `${pronouns.subject} wrenches the handle downward until clean water gushes out and the entire mechanism comes apart in ${pronouns.possessiveAdjective} hands.`,
      changes: [createSatisfyNeedChange(actor, "water"), ...createSurvivalChanges([actor])],
    };
  },
};

const PORTABLE_COVER: EventDefinition = {
  id: "high-brawn-portable-cover",
  category: "fatal",
  periods: ["day"],
  baseWeight: 1,
  tags: ["fatal", "combat", "weapon", "item", "environment"],
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
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
      requiredItemDefinitionIds: RANGED_WEAPON_IDS,
      itemAccess: "owned",
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${target.snapshot.name} fires at ${actor.snapshot.name}, who responds by lifting a fallen log and carrying it through the woods as a portable barricade. ` +
        `${target.snapshot.name} eventually runs out of ammunition before ${actor.snapshot.name} runs out of tree, ` +
        `tossing it on top of ${target.snapshot.name} with an impressive heave.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-brawn-portable-cover",
          "Crushed beneath a fallen log",
          `${target.snapshot.name} is crushed beneath a log thrown by ${actor.snapshot.name} after ${targetPronouns.subject} runs out of ammunition.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const BUILT_STRONG_ASSEMBLED_POORLY: EventDefinition = {
  id: "high-brawn-built-strong-assembled-poorly",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.5,
  tags: ["hazard", "weapon", "item"],
  selectionProfile: statSelectionProfile(4, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
      requiredItemDefinitionIds: MELEE_WEAPON_IDS,
      requiredItemRequireUsable: false,
      itemAccess: "owned",
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const weapon = requireSelectedItem(context, "actor");

    return {
      text:
        `${actor.snapshot.name} spends the afternoon practising swings with ${pronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)}. ` +
        `At one point, ${pronouns.subject} puts so much force behind the attack that the handle snaps cleanly in half. ` +
        `${actor.snapshot.name} stares at the pieces, trying not to feel impressed with ${pronouns.reflexive}.`,
      changes: [
        {
          type: "destroy-item",
          tributeId: actor.id,
          itemInstanceId: weapon.id,
          reason: context.eventId,
        },
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const ANYTHING_FOR_THE_GAINS: EventDefinition = {
  id: "high-brawn-anything-for-the-gains",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.6,
  tags: ["hazard", "status"],
  selectionProfile: statSelectionProfile(4),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isHighBrawn(tribute) && isLowBrains(tribute),
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
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
        `${actor.snapshot.name} wants to get a quick workout in before starting ${pronouns.possessiveAdjective} day. ` +
        `Without ${pronouns.possessiveAdjective} usual equipment, ${pronouns.subject} makes do by punching a tree, ` +
        `painfully cutting ${pronouns.possessiveAdjective} knuckles. But hey, anything for the gains.`,
      changes: [
        createStatusChange(eventId, actor, "injured", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const FIREWOOD: EventDefinition = {
  id: "high-brawn-firewood",
  category: "survival",
  periods: ["night"],
  baseWeight: 1.8,
  tags: ["survival", "environment"],
  selectionProfile: statSelectionProfile(3),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brawn === 5,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "eq",
            threshold: 5,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} goes looking for firewood and returns dragging an entire fallen tree. ` +
        `${pronouns.Subject} spends the evening breaking pieces off whenever the fire begins to fade.`,
      changes: [
        ...createNightRestChanges([actor], round, "sheltered"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const FORT_KICKASS: EventDefinition = {
  id: "high-brawn-fort-kickass",
  category: "survival",
  periods: ["night"],
  baseWeight: 1.8,
  tags: ["survival", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} constructs a shelter from heavy logs and stones that most tributes could not move individually. ` +
        `By nightfall, ${pronouns.subject} has created a fortress sturdy enough to withstand the weather, an ambush, and several minor siege weapons.`,
      changes: [
        ...createNightRestChanges([actor], round, "sheltered"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const PERSONAL_DRAWBRIDGE: EventDefinition = {
  id: "high-brawn-personal-drawbridge",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.4,
  tags: ["survival", "combat", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: createOpposingHighBrawnRoles(),
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);

    return {
      text:
        `${target.snapshot.name} chases ${actor.snapshot.name} through the woods towards the edge of a chasm, hoping to corner ${actorPronouns.object}. ` +
        `Instead, ${actorPronouns.subject} pushes a dead tree over to create a bridge in a feat of exceptional athleticism ` +
        `and crosses safely, escaping pursuit.`,
      changes: createSurvivalChanges([actor, target]),
    };
  },
};

function getTruceEventBaseWeight(baseWeight: number, size: TruceEventSize): number {
  return size === 3 ? baseWeight : baseWeight / size;
}

function createSleepWreckingBall(size: TruceEventSize): EventDefinition {
  return {
    id: `high-brawn-sleep-wrecking-ball-${size}`,
    category: "survival",
    periods: ["night"],
    baseWeight: getTruceEventBaseWeight(1.8, size),
    tags: ["survival", "status", "truce"],
    participantShape: getParticipantShapeForSize(size),
    selectionProfile: statSelectionProfile(4, ["truce-requirement"]),
    roles: createHighBrawnTruceMemberRoles(size),
    resolve({ eventId, round, participantsByRole }) {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const members = requireParticipants(participantsByRole, "members");
      const actorPronouns = getTributePronouns(actor);

      if (members.length !== size - 1) {
        throw new Error(`Sleep Wrecking Ball expected ${size - 1} truce mates.`);
      }

      return {
        text:
          `${actor.snapshot.name} rolls over in ${actorPronouns.possessiveAdjective} sleep and brings down half of the shared shelter. ` +
          `${actor.snapshot.name} sleeps peacefully while the wreckage gets repaired around ${actorPronouns.object}.`,
        changes: [
          ...createNightRestChanges([actor], round, "comfortable"),
          createStatusChange(eventId, actor, "well-rested", 1, round),
          ...createSurvivalChanges([actor, ...members]),
        ],
      };
    },
  };
}

function createPackMule(size: TruceEventSize): EventDefinition {
  return {
    id: `high-brawn-pack-mule-${size}`,
    category: "hazard",
    periods: ["day"],
    baseWeight: getTruceEventBaseWeight(1.7, size),
    tags: ["hazard", "status", "truce", "cooperative"],
    participantShape: getParticipantShapeForSize(size),
    selectionProfile: statSelectionProfile(4, ["truce-requirement"]),
    roles: createHighBrawnTruceMemberRoles(size),
    resolve({ eventId, round, participantsByRole }) {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const members = requireParticipants(participantsByRole, "members");
      const actorPronouns = getTributePronouns(actor);

      if (members.length !== size - 1) {
        throw new Error(`Pack Mule expected ${size - 1} truce mates.`);
      }

      return {
        text:
          `${actor.snapshot.name} becomes the de facto pack mule of ${actorPronouns.possessiveAdjective} group and is charged with carrying all of the supplies. ` +
          `By the time they begin walking, only ${actorPronouns.possessiveAdjective} legs are visible beneath the luggage.`,
        changes: [
          createStatusChange(eventId, actor, "exhausted", 1, round),
          ...members.map((member) => createStatusChange(eventId, member, "well-rested", 1, round)),
          ...createSurvivalChanges([actor, ...members]),
        ],
      };
    },
  };
}

const HUMAN_SHIELD: EventDefinition = {
  id: "high-brawn-human-shield",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.4,
  tags: ["hazard", "status", "truce", "cooperative"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4, ["truce-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isHighBrawn(tribute) && getActiveTruceForTribute(state, tribute.id) !== null,
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
    },
    {
      id: "target",
      count: 1,
      isEligible: (tribute, { state, participantsByRole }) =>
        isSameTruceMember(tribute, participantsByRole.actor?.[0], state),
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `When an attack comes from the trees, ${actor.snapshot.name} steps in front of ${target.snapshot.name} and absorbs the blow meant for ${targetPronouns.object}. ` +
        `${target.snapshot.name} survives unharmed while ${actor.snapshot.name} insists the injury is barely noticeable.`,
      changes: [
        createStatusChange(eventId, actor, "injured", 1, round),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

function createUnionDispute(size: TruceEventSize): EventDefinition {
  return {
    id: `high-brawn-union-dispute-${size}`,
    category: "hazard",
    periods: ["day"],
    baseWeight: getTruceEventBaseWeight(1.2, size),
    tags: ["hazard", "item", "truce"],
    participantShape: getParticipantShapeForSize(size),
    selectionProfile: statSelectionProfile(5, ["truce-requirement", "item-requirement"]),
    roles: createHighBrawnTruceMemberRoles(size),
    resolve({ state, unavailableItemInstanceIds, participantsByRole }) {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const members = requireParticipants(participantsByRole, "members");
      const truce = getActiveTruceOfSize(state, actor.id, size);
      const actorPronouns = getTributePronouns(actor);

      if (!truce || members.length !== size - 1) {
        throw new Error(`Union Dispute expected an active ${size}-person truce.`);
      }

      const transferChanges: GameChange[] = members.flatMap((member) =>
        member.inventory
          .filter((item) => !unavailableItemInstanceIds?.has(item.id))
          .map((item): GameChange => ({
            type: "transfer-item",
            itemInstanceId: item.id,
            fromTributeId: member.id,
            toTributeId: actor.id,
            reason: "theft",
          })),
      );

      return {
        text:
          `After being handed every backpack, weapon, camp supply, and snack to carry for the day, ${actor.snapshot.name} is fed up with ${actorPronouns.possessiveAdjective} role as pack mule. ` +
          `${actorPronouns.Subject} heads off into the woods alone, taking all of the inventory along.`,
        changes: [
          ...transferChanges,
          {
            type: "break-truce",
            truceId: truce.id,
            reason: "betrayal",
          },
          ...createSurvivalChanges([actor, ...members]),
        ],
      };
    },
  };
}

function createRestructuringTheTruce(size: TruceEventSize): EventDefinition {
  return {
    id: `high-brawn-restructuring-the-truce-${size}`,
    category: "fatal",
    periods: ["day", "night"],
    baseWeight: getTruceEventBaseWeight(1.1, size),
    tags: ["fatal", "combat", "truce"],
    participantShape: getParticipantShapeForSize(size),
    selectionProfile: statSelectionProfile(4, ["truce-requirement"]),
    roles: createHighBrawnTruceMemberRoles(size),
    resolve({ random, participantsByRole }) {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const members = requireParticipants(participantsByRole, "members");
      const victim = members[Math.min(members.length - 1, Math.floor(random() * members.length))];

      if (!victim || members.length !== size - 1) {
        throw new Error(`Restructuring the Truce expected ${size - 1} truce mates.`);
      }

      const actorPronouns = getTributePronouns(actor);
      const victimPronouns = getTributePronouns(victim);
      const text =
        size === 2
          ? `${actor.snapshot.name} decides ${victim.snapshot.name} has become more trouble than ${victimPronouns.subject} ${victimPronouns.bePresent} worth. ` +
            `${actorPronouns.Subject} grabs ${victim.snapshot.name} by the head and ends the truce with one sharp twist.`
          : `${actor.snapshot.name} decides the truce has too many members and announces a restructuring. ` +
            `Before anyone can ask what that means, ${actorPronouns.subject} grabs ${victim.snapshot.name} and snaps ${victimPronouns.possessiveAdjective} neck in front of the others.`;

      return {
        text,
        changes: [
          ...createFatalChanges(
            victim,
            "high-brawn-truce-restructuring",
            "Killed during a truce restructuring",
            `${victim.snapshot.name} is killed by ${actor.snapshot.name} during a violent truce restructuring.`,
            actor,
          ),
          ...createSurvivalChanges([actor, ...members.filter((member) => member.id !== victim.id)]),
        ],
      };
    },
  };
}

const ROCK_PAPER_SPINE: EventDefinition = {
  id: "high-brawn-rock-paper-spine",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.9,
  tags: ["fatal", "combat", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: createOpposingHighBrawnRoles(),
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${target.snapshot.name} hides behind a boulder, confident that ${actor.snapshot.name} cannot reach ${targetPronouns.object}. ` +
        `${actor.snapshot.name} lifts the boulder instead and drops it on top of ${target.snapshot.name}. ` +
        `Paper may beat rock, but rock definitely beats spine.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-brawn-rock-paper-spine",
          "Crushed beneath a boulder",
          `${target.snapshot.name} is crushed beneath a boulder lifted by ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const PERSONAL_SPACE: EventDefinition = {
  id: "high-brawn-personal-space",
  category: "fatal",
  periods: ["day", "night"],
  baseWeight: 0.9,
  tags: ["fatal", "combat", "ambush"],
  selectionProfile: statSelectionProfile(2),
  roles: createOpposingHighBrawnRoles(),
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${target.snapshot.name} sneaks up behind ${actor.snapshot.name} and tries to strangle ${actorPronouns.object}. ` +
        `${actor.snapshot.name} reaches backward, grabs ${target.snapshot.name}, and throws ${targetPronouns.object} over ${actorPronouns.possessiveAdjective} shoulder ` +
        `onto the ground with enough force to break ${targetPronouns.possessiveAdjective} neck.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-brawn-personal-space",
          "Killed during a failed ambush",
          `${target.snapshot.name} is thrown to ${targetPronouns.possessiveAdjective} death by ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const WHAT_GOES_UP_MUST_COME_DOWN: EventDefinition = {
  id: "high-brawn-what-goes-up-must-come-down",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.5,
  tags: ["fatal", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
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
        `${actor.snapshot.name} spots another tribute hiding in a tree. Instead of climbing after them, ${pronouns.subject} grabs a large rock and hurls it upwards. ` +
        `Forgetting that what goes up must come down, ${actor.snapshot.name} is bludgeoned in the head by ${pronouns.possessiveAdjective} own rock.`,
      changes: createFatalChanges(
        actor,
        "high-brawn-falling-rock",
        "Killed by a falling rock",
        `${actor.snapshot.name} is killed when ${pronouns.possessiveAdjective} own thrown rock falls back down.`,
      ),
    };
  },
};

const TITANS: EventDefinition = {
  id: "high-brawn-titans",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.75,
  tags: ["fatal", "combat"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brawn === 5,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "eq",
            threshold: 5,
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
      isEligible: (tribute) => tribute.snapshot.stats.brawn === 5,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "target",
            stat: "brawn",
            comparison: "eq",
            threshold: 5,
            valueSource: "base",
          },
        ],
      },
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const actorWins = random() < 0.5;
    const winner = actorWins ? actor : target;
    const loser = actorWins ? target : actor;
    const winnerPronouns = actorWins ? actorPronouns : targetPronouns;

    return {
      text:
        `${actor.snapshot.name} spots ${target.snapshot.name} charging forward. As an invitation, ${actor.snapshot.name} throws down ${actorPronouns.possessiveAdjective} backpack and raises ${actorPronouns.possessiveAdjective} fists. ` +
        `${target.snapshot.name} accepts, raising ${targetPronouns.possessiveAdjective} own. What follows is a battle of the titans - muscles rippling, blood and sweat spraying - ` +
        `until ${winner.snapshot.name} delivers the fatal punch and emerges victorious on ${winnerPronouns.possessiveAdjective} feet.`,
      changes: [
        ...createFatalChanges(
          loser,
          "high-brawn-titans",
          "Killed in a battle of the titans",
          `${loser.snapshot.name} is beaten to death by ${winner.snapshot.name} in a battle of extraordinary strength.`,
          winner,
        ),
        ...createSurvivalChanges([winner]),
      ],
    };
  },
};

const GENTLE_GIANT: EventDefinition = {
  id: "high-brawn-gentle-giant",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.8,
  tags: ["survival", "truce", "cooperative"],
  selectionProfile: statSelectionProfile(4, ["truce-requirement", "custom-eligibility"]),
  isEligible: ({ state, livingTributes }) =>
    canFormStandardTruce(2, livingTributes.length) &&
    livingTributes.some(
      (tribute) => isHighBrawn(tribute) && !getActiveTruceForTribute(state, tribute.id),
    ) &&
    livingTributes.some(
      (tribute) => isLowBrawn(tribute) && !getActiveTruceForTribute(state, tribute.id),
    ),
  getWeightMultiplier: ({ state, round }) => getTruceFormationPopulationMultiplier(state, round),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isHighBrawn(tribute) && !getActiveTruceForTribute(state, tribute.id),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
    },
    {
      id: "target",
      count: 1,
      isEligible: (tribute, { state }) =>
        isLowBrawn(tribute) && !getActiveTruceForTribute(state, tribute.id),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "stat",
            roleId: "target",
            stat: "brawn",
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
    const target = requireSingleParticipant(participantsByRole, "target");

    return {
      text:
        `${actor.snapshot.name} finds ${target.snapshot.name} struggling to move a fallen branch off the path. ` +
        `After watching for several increasingly painful seconds, ${actor.snapshot.name} lifts the branch aside and decides ${target.snapshot.name} probably shouldn't be left alone in the arena.`,
      changes: [
        {
          type: "form-truce",
          truce: createTruceInstance(
            eventId,
            [actor.id, target.id],
            round,
            STANDARD_TRUCE_EXPIRY_ROUND,
          ),
        },
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const BEAR_HUG: EventDefinition = {
  id: "high-brawn-bear-hug",
  category: "fatal",
  periods: ["day", "night"],
  baseWeight: 0.8,
  tags: ["fatal", "combat", "truce"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4, ["truce-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isHighBrawn(tribute) && getActiveTruceForTribute(state, tribute.id) !== null,
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
    },
    {
      id: "target",
      count: 1,
      isEligible: (tribute, { state, participantsByRole }) =>
        isSameTruceMember(tribute, participantsByRole.actor?.[0], state),
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${actor.snapshot.name} locks ${target.snapshot.name} inside a warm bear hug. ${target.snapshot.name} tries to protest but can only muster a squeak ` +
        `before ${targetPronouns.possessiveAdjective} ribs crack and ${actor.snapshot.name} finally releases ${targetPronouns.possessiveAdjective} lifeless body, devastated.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-brawn-bear-hug",
          "Crushed in a bear hug",
          `${target.snapshot.name} is accidentally crushed to death in ${actor.snapshot.name}'s bear hug.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const SKIPPING_STONES: EventDefinition = {
  id: "high-brawn-skipping-stones",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.9,
  tags: ["fatal", "combat", "environment"],
  selectionProfile: statSelectionProfile(3),
  roles: createOpposingHighBrawnRoles(isLowLuck),
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${target.snapshot.name} watches ${actor.snapshot.name} stop for a drink and hides in the bushes on the other side of the river, waiting for an opening. ` +
        `${actor.snapshot.name} picks up a flat stone and tries to skip it across the water. The stone rockets from ${actorPronouns.possessiveAdjective} hand, ` +
        `strikes ${target.snapshot.name} in the temple, and drops ${targetPronouns.object} into the river, dead.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-brawn-skipping-stones",
          "Killed by a skipping stone",
          `${target.snapshot.name} is struck in the temple by a stone thrown by ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const STRONG_SWIMMER: EventDefinition = {
  id: "high-brawn-strong-swimmer",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.4,
  tags: ["survival", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
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
        `${actor.snapshot.name} is swept into a fast-moving river but grabs an exposed root and hauls ${pronouns.reflexive} back onto shore. ` +
        `${actor.snapshot.name} lies there soaking wet, furious that the river had the audacity to try ${pronouns.object}.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const HEAVY_SLEEPER: EventDefinition = {
  id: "high-brawn-heavy-sleeper",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.8,
  tags: ["fatal", "combat", "ambush", "weapon"],
  selectionProfile: statSelectionProfile(3),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
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
      isEligible: (tribute) => tribute.snapshot.stats.brawn <= 3,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "target",
            stat: "brawn",
            comparison: "lte",
            threshold: 3,
            valueSource: "base",
          },
        ],
      },
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
    const weapon = context.itemsByRole?.target?.[0]?.item;
    const raisedWeapon = weapon
      ? `${targetPronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)}`
      : "a sharp rock";

    return {
      text:
        `${target.snapshot.name} creeps into ${actor.snapshot.name}'s camp and raises ${raisedWeapon} over ${actorPronouns.possessiveAdjective} sleeping body. ` +
        `Without waking, ${actor.snapshot.name} rolls over, traps ${target.snapshot.name} beneath one arm, and slowly suffocates ${targetPronouns.object} against the ground.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-brawn-heavy-sleeper",
          "Suffocated during a failed ambush",
          `${target.snapshot.name} is suffocated by ${actor.snapshot.name} during a failed nighttime ambush.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const THE_BIGGER_THEY_ARE: EventDefinition = {
  id: "high-brawn-the-bigger-they-are",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.5,
  tags: ["fatal", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
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
        `${actor.snapshot.name} attempts to leap across a ravine, confident that ${pronouns.possessiveAdjective} legs can handle the distance. ` +
        `${pronouns.possessiveAdjective} confidence lasts until ${actor.snapshot.name} clips the opposite ledge and plummets into the canyon.`,
      changes: createFatalChanges(
        actor,
        "high-brawn-ravine-leap",
        "Fell into a ravine",
        `${actor.snapshot.name} falls into a ravine after an overconfident leap.`,
      ),
    };
  },
};

const STRUCTURAL_MISUNDERSTANDING: EventDefinition = {
  id: "high-brawn-structural-misunderstanding",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.5,
  tags: ["fatal", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
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
        `${actor.snapshot.name} finds shelter beneath an enormous slab of loose stone. When the wind begins to shift it, ` +
        `${pronouns.subject} tries to hold the slab in place rather than move. The shelter collapses, crushing ${actor.snapshot.name} beneath it.`,
      changes: createFatalChanges(
        actor,
        "high-brawn-shelter-collapse",
        "Crushed by a collapsing shelter",
        `${actor.snapshot.name} is crushed beneath a stone shelter collapse.`,
      ),
    };
  },
};

const SLEEP_WRECKING_BALL_EVENTS = TRUCE_EVENT_SIZES.map(createSleepWreckingBall);
const PACK_MULE_EVENTS = TRUCE_EVENT_SIZES.map(createPackMule);
const UNION_DISPUTE_EVENTS = TRUCE_EVENT_SIZES.map(createUnionDispute);
const RESTRUCTURING_THE_TRUCE_EVENTS = TRUCE_EVENT_SIZES.map(createRestructuringTheTruce);

export const HIGH_BRAWN_EVENTS = [
  SACK_OF_POTATOES,
  UPROOTED,
  PUMP_ACTION,
  PORTABLE_COVER,
  BUILT_STRONG_ASSEMBLED_POORLY,
  ANYTHING_FOR_THE_GAINS,
  FIREWOOD,
  FORT_KICKASS,
  PERSONAL_DRAWBRIDGE,
  ...SLEEP_WRECKING_BALL_EVENTS,
  ...PACK_MULE_EVENTS,
  HUMAN_SHIELD,
  ...UNION_DISPUTE_EVENTS,
  ...RESTRUCTURING_THE_TRUCE_EVENTS,
  ROCK_PAPER_SPINE,
  PERSONAL_SPACE,
  WHAT_GOES_UP_MUST_COME_DOWN,
  TITANS,
  GENTLE_GIANT,
  BEAR_HUG,
  SKIPPING_STONES,
  STRONG_SWIMMER,
  HEAVY_SLEEPER,
  THE_BIGGER_THEY_ARE,
  STRUCTURAL_MISUNDERSTANDING,
] satisfies readonly EventDefinition[];
