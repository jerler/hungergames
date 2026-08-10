import {
  createFatalChanges,
  createItemUseChange,
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
import { canFormStandardTruce } from "~/game/truces/truce-lifecycle";
import {
  createTruceInstance,
  getActiveTruceForTribute,
  getTruceFormationPopulationMultiplier,
  STANDARD_TRUCE_EXPIRY_ROUND,
} from "~/game/truces/truce-engine";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameTribute } from "~/game/types/game-state";

import {
  MELEE_WEAPON_IDS,
  TRUCE_EVENT_SIZES,
  chooseTextVariant,
  createFatalWithoutLoot,
  getActiveTruceOfSize,
  getLowercaseItemLabel,
  getParticipantShapeForSize,
  hasStatus,
  isHighBrawn,
  isLowBrawn,
  requireSelectedItem,
  statSelectionProfile,
  type TruceEventSize,
} from "../stat-gated-helpers";

function createOpposingLowBrawnRoles(
  targetEligibility?: (tribute: GameTribute) => boolean,
): readonly ParticipantRoleDefinition[] {
  return [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
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
      isEligible: targetEligibility,
      opposesRoleIds: ["actor"],
    },
  ];
}

const ROCK_AND_A_HARD_PLACE: EventDefinition = {
  id: "low-brawn-rock-and-a-hard-place",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.8,
  tags: ["fatal", "combat"],
  selectionProfile: statSelectionProfile(2),
  roles: createOpposingLowBrawnRoles(),
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const pronouns = getTributePronouns(actor);
    const text =
      `${actor.snapshot.name} is being chased through the woods by ${target.snapshot.name} and tries to climb a tree to escape, ` +
      `only to remember ${pronouns.possessiveAdjective} muscles are as strong as wet noodles. ` +
      `${actor.snapshot.name} is killed without dignity, not even two inches off the ground.`;

    return {
      text,
      changes: [
        ...createFatalChanges(
          actor,
          "low-brawn-tree-climb",
          "Killed during a failed escape",
          `${actor.snapshot.name} is killed by ${target.snapshot.name} after failing to climb a tree.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const DRAGGING_THE_LOOT: EventDefinition = {
  id: "low-brawn-dragging-the-loot",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.4,
  tags: ["survival", "item"],
  selectionProfile: statSelectionProfile(4, ["item-requirement"]),
  roles: createOpposingLowBrawnRoles(
    (tribute) => tribute.snapshot.stats.brawn >= 3 && tribute.inventory.length > 0,
  ),
  resolve({ random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const text = chooseTextVariant(random, [
      `${actor.snapshot.name} stalks ${target.snapshot.name} through the woods, careful not to make a sound. ` +
        `After several minutes, ${target.snapshot.name} sets ${targetPronouns.possessiveAdjective} backpack down and climbs a tree, leaving the supplies unattended. ` +
        `${actor.snapshot.name} tries to snatch the bag and run, only to find it far too heavy to carry. ` +
        `${actorPronouns.Subject} ${actorPronouns.bePresent} suddenly very aware of the strength difference and abandons the mission.`,
      `${actor.snapshot.name} comes across ${target.snapshot.name}'s backpack at the base of a tree, stuffed with supplies, but cannot lift it. ` +
        `${actor.snapshot.name} swears that if ${actorPronouns.subject} makes it out alive, ${actorPronouns.subject} will finally get that gym membership.`,
    ]);

    return {
      text,
      changes: createSurvivalChanges([actor, target]),
    };
  },
};

const STICK_SHELTER: EventDefinition = {
  id: "low-brawn-stick-shelter",
  category: "survival",
  periods: ["night"],
  baseWeight: 2,
  tags: ["survival", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const text = chooseTextVariant(random, [
      `${actor.snapshot.name} tries to construct a lean-to from fallen branches but finds they are all too heavy. ` +
        `Dejectedly, ${pronouns.subject} constructs a much flimsier version out of several much smaller twigs.`,
      `${actor.snapshot.name} tries to construct a shelter for the night, but ${pronouns.possessiveAdjective} weak, non-existent muscles ` +
        `finally convince ${pronouns.object} to crawl inside a hollowed-out log instead.`,
    ]);

    return {
      text,
      changes: [
        ...createNightRestChanges([actor], round, "sheltered"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const HOLD_ON: EventDefinition = {
  id: "low-brawn-hold-on",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.55,
  tags: ["fatal", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
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
    const text =
      `${actor.snapshot.name} crosses a ravine over a rickety bridge that snaps halfway across. ` +
      `${actor.snapshot.name} grabs hold of the rope, but ${pronouns.possessiveAdjective} non-existent muscles give up almost immediately, ` +
      `sending ${pronouns.object} plummeting to ${pronouns.possessiveAdjective} death.`;

    return {
      text,
      changes: createFatalChanges(
        actor,
        "low-brawn-ravine-fall",
        "Fell into a ravine",
        `${actor.snapshot.name} falls to ${pronouns.possessiveAdjective} death when ${pronouns.subject} cannot hold onto a broken bridge.`,
      ),
    };
  },
};

const EXCALIBUR: EventDefinition = {
  id: "low-brawn-excalibur",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.6,
  tags: ["survival", "weapon", "item"],
  selectionProfile: statSelectionProfile(4, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "lte",
            threshold: 2,
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
        `${actor.snapshot.name} swings ${pronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)} in a wide arc, ` +
        `practising ${pronouns.possessiveAdjective} attack and accidentally lodging it deep in a tree. ` +
        `${actor.snapshot.name} spends several hours trying to pull it back out again.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const TURTLING: EventDefinition = {
  id: "low-brawn-turtling",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.7,
  tags: ["survival", "item"],
  selectionProfile: statSelectionProfile(3, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isLowBrawn(tribute) && tribute.inventory.length >= 3,
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
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
        `${actor.snapshot.name} throws ${pronouns.possessiveAdjective} backpack over ${pronouns.possessiveAdjective} shoulder, ` +
        `only to be knocked backwards by the weight. ${actor.snapshot.name} is stuck turtling on the ground for several undignified minutes, ` +
        `wondering why ${pronouns.subject} took all this stuff to begin with.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const CHILDPROOFED_MEDKIT_BRAWN: EventDefinition = {
  id: "low-brawn-childproofed-medkit",
  category: "hazard",
  periods: ["day", "night"],
  baseWeight: 10,
  tags: ["hazard", "item"],
  selectionProfile: statSelectionProfile(4, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
      requiredItemDefinitionIds: ["med-kit"],
      itemAccess: "owned",
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const medKit = requireSelectedItem(context, "actor");

    return {
      text:
        `After slicing ${pronouns.possessiveAdjective} arm deeply on a rogue branch, ` +
        `${actor.snapshot.name} spends ten humiliating minutes fighting to open the medkit's packaging ` +
        `before finally reaching the supplies inside, muscles crying from the effort.`,
      changes: [
        createItemUseChange(actor, medKit, context.eventId),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

function createLetsBeHonestEvent(period: "day" | "night"): EventDefinition {
  return {
    id: `low-brawn-lets-be-honest-${period}`,
    category: "survival",
    periods: [period],
    baseWeight: 1.4,
    tags: ["survival", "weapon", "item"],
    selectionProfile: statSelectionProfile(4, ["item-requirement"]),
    roles: [
      {
        id: "actor",
        count: 1,
        isEligible: isLowBrawn,
        auditEligibility: {
          coverage: "complete",
          prerequisites: [
            {
              kind: "stat",
              roleId: "actor",
              stat: "brawn",
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
        opposesRoleIds: ["actor"],
        requiredItemDefinitionIds: MELEE_WEAPON_IDS,
        requiredItemRequireUsable: false,
        itemAccess: "owned",
      },
    ],
    resolve(context) {
      const actor = requireSingleParticipant(context.participantsByRole, "actor");
      const target = requireSingleParticipant(context.participantsByRole, "target");
      const actorPronouns = getTributePronouns(actor);
      const targetPronouns = getTributePronouns(target);
      const weapon = requireSelectedItem(context, "target");
      const setup =
        period === "day"
          ? `${actor.snapshot.name} comes across ${target.snapshot.name} in the woods with ${targetPronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)} resting against a tree.`
          : `${actor.snapshot.name} comes across ${target.snapshot.name} sleeping in the woods with ${targetPronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)} resting against a tree.`;
      const ending =
        period === "day"
          ? `${actorPronouns.Subject} does some quick mental math and decides there is no way ${actorPronouns.subject} could use it against ${target.snapshot.name} without being overpowered, then backs away slowly.`
          : `${actorPronouns.Subject} does some quick mental math and decides there is no way ${actorPronouns.subject} could use it against ${target.snapshot.name} without injuring ${actorPronouns.reflexive}, then disappears into the shadows.`;

      return {
        text: `${setup} ${ending}`,
        changes: createSurvivalChanges([actor, target]),
      };
    },
  };
}

const WEAPONIZED_HELPLESSNESS: EventDefinition = {
  id: "low-brawn-weaponized-helplessness",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.5,
  tags: ["survival", "combat", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: createOpposingLowBrawnRoles(),
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${actor.snapshot.name} is chased by ${target.snapshot.name} through the woods. In a feat of exceptionally poor athletic prowess, ` +
        `${actorPronouns.subject} tries to jump over a root, trips, and flies into a thorn bush. ` +
        `${target.snapshot.name} watches ${actorPronouns.object} struggle pathetically before ${targetPronouns.subject} becomes too embarrassed to continue and leaves.`,
      changes: createSurvivalChanges([actor, target]),
    };
  },
};

const FAILED_INTIMIDATION: EventDefinition = {
  id: "low-brawn-failed-intimidation",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.6,
  tags: ["survival", "weapon", "item"],
  selectionProfile: statSelectionProfile(5, ["item-requirement", "custom-eligibility"]),
  isEligible: ({ round }) => round.day === 2 || round.day === 3,
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
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
      opposesRoleIds: ["actor"],
      requiredItemDefinitionIds: MELEE_WEAPON_IDS,
      requiredItemRequireUsable: false,
      itemAccess: "owned",
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const weapon = requireSelectedItem(context, "target");

    return {
      text:
        `${actor.snapshot.name} finds ${target.snapshot.name} by the river getting water and grabs ${target.snapshot.name}'s ${getLowercaseItemLabel(weapon)}, ` +
        `holding it clumsily while trying to look threatening. ${target.snapshot.name} approaches, takes the weapon away before ${actor.snapshot.name} ` +
        `can hurt ${actorPronouns.reflexive}, and goes back to gathering water.`,
      changes: createSurvivalChanges([actor, target]),
    };
  },
};

const LOOKING_OUT_FOR_THE_LITTLE_GUY: EventDefinition = {
  id: "low-brawn-looking-out-for-the-little-guy",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.8,
  tags: ["survival", "truce", "cooperative"],
  selectionProfile: statSelectionProfile(4, ["truce-requirement", "custom-eligibility"]),
  isEligible: ({ state, livingTributes }) =>
    canFormStandardTruce(2, livingTributes.length) &&
    livingTributes.some(
      (tribute) => isLowBrawn(tribute) && !getActiveTruceForTribute(state, tribute.id),
    ) &&
    livingTributes.some(
      (tribute) => isHighBrawn(tribute) && !getActiveTruceForTribute(state, tribute.id),
    ),
  getWeightMultiplier: ({ state, round }) => getTruceFormationPopulationMultiplier(state, round),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isLowBrawn(tribute) && !getActiveTruceForTribute(state, tribute.id),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
    },
    {
      id: "target",
      count: 1,
      isEligible: (tribute, { state }) =>
        isHighBrawn(tribute) && !getActiveTruceForTribute(state, tribute.id),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "stat",
            roleId: "target",
            stat: "brawn",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const text = chooseTextVariant(random, [
      `${actor.snapshot.name} gets cornered by ${target.snapshot.name} and begins punching as hard as ${actorPronouns.subject} can. ` +
        `${target.snapshot.name} is overwhelmed by pity at the soft little taps and decides to protect ${actor.snapshot.name} as best as ${targetPronouns.subject} can.`,
      `${target.snapshot.name} becomes convinced that ${actor.snapshot.name} will perish immediately without supervision and refuses to let ${actorPronouns.object} out of ${targetPronouns.possessiveAdjective} sight.`,
    ]);

    return {
      text,
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

function createTruceMemberRoles(size: TruceEventSize): readonly ParticipantRoleDefinition[] {
  return [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isLowBrawn(tribute) && getActiveTruceOfSize(state, tribute.id, size) !== null,
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
            comparison: "lte",
            threshold: 2,
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

function createRoyalTreatmentFatal(size: TruceEventSize): EventDefinition {
  return {
    id: `low-brawn-royal-treatment-fatal-${size}`,
    category: "fatal",
    periods: ["day"],
    baseWeight: 1.2 / size,
    tags: ["fatal", "combat", "truce"],
    participantShape: getParticipantShapeForSize(size),
    selectionProfile: statSelectionProfile(4, ["truce-requirement"]),
    isEligible: ({ state, livingTributes }) =>
      livingTributes.some(
        (tribute) => isLowBrawn(tribute) && getActiveTruceOfSize(state, tribute.id, size) !== null,
      ),
    roles: createTruceMemberRoles(size),
    resolve({ random, participantsByRole }) {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const members = requireParticipants(participantsByRole, "members");

      if (members.length !== size - 1) {
        throw new Error(`Royal Treatment expected ${size - 1} truce mates.`);
      }

      const killer = members[Math.min(members.length - 1, Math.floor(random() * members.length))];

      if (!killer) {
        throw new Error("Royal Treatment could not choose a killer.");
      }

      const actorPronouns = getTributePronouns(actor);
      const killerPronouns = getTributePronouns(killer);
      const text =
        size === 2
          ? `${actor.snapshot.name} has trouble keeping up with ${killer.snapshot.name} as they march through the arena. ` +
            `${killer.snapshot.name} decides ${killerPronouns.subject} ${killerPronouns.bePresent} tired of ${actorPronouns.object} holding ${killerPronouns.object} back ` +
            `and officially ends the truce with a quick twist of ${actor.snapshot.name}'s neck.`
          : `${actor.snapshot.name} has trouble keeping up as the truce marches through the arena looking for tributes. ` +
            `The group decides they are tired of ${actorPronouns.object} holding them back and removes ${actorPronouns.object} from the group with a twist of the neck.`;

      /*
       * The existing death aftermath creates the visible truce
       * dissolution event. Do not emit a duplicate break-truce change.
       */
      return {
        text,
        changes: [
          ...createFatalChanges(
            actor,
            "low-brawn-royal-treatment",
            "Killed by a truce member",
            `${actor.snapshot.name} is killed by ${killer.snapshot.name} for slowing down the truce.`,
            killer,
          ),
          ...createSurvivalChanges(members),
        ],
      };
    },
  };
}

function createRoyalTreatmentFriendly(size: TruceEventSize): EventDefinition {
  return {
    id: `low-brawn-royal-treatment-friendly-${size}`,
    category: "survival",
    periods: ["day"],
    baseWeight: 2 / size,
    tags: ["survival", "status", "truce", "cooperative"],
    participantShape: getParticipantShapeForSize(size),
    selectionProfile: statSelectionProfile(4, ["truce-requirement"]),
    recoveryProfile: {
      targets: [
        {
          kind: "status",
          roleId: "actor",
          statusIds: ["exhausted"],
        },
      ],
    },
    isEligible: ({ state, livingTributes }) =>
      livingTributes.some(
        (tribute) => isLowBrawn(tribute) && getActiveTruceOfSize(state, tribute.id, size) !== null,
      ),
    roles: createTruceMemberRoles(size),
    resolve({ eventId, round, participantsByRole }) {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const members = requireParticipants(participantsByRole, "members");

      if (members.length !== size - 1) {
        throw new Error(`Friendly Royal Treatment expected ${size - 1} truce mates.`);
      }

      const actorPronouns = getTributePronouns(actor);
      const mate = members[0];
      const text =
        size === 2 && mate
          ? `${actor.snapshot.name} has trouble keeping up with ${mate.snapshot.name} as they march through the arena. ` +
            `${mate.snapshot.name} gives ${actor.snapshot.name} a piggyback ride to prevent accidentally leaving ${actorPronouns.object} behind.`
          : `${actor.snapshot.name} has trouble keeping up as the truce marches through the arena. ` +
            `Much to ${actorPronouns.possessiveAdjective} humiliation, the group takes turns carrying ${actorPronouns.object} so nobody gets slowed down.`;

      return {
        text,
        changes: [
          createStatusChange(eventId, actor, "well-rested", 1, round),
          ...createSurvivalChanges([actor, ...members]),
        ],
      };
    },
  };
}

const BRIDGE_OVER_TROUBLED_WATER: EventDefinition = {
  id: "low-brawn-bridge-over-troubled-water",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.75,
  tags: ["fatal", "combat", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: createOpposingLowBrawnRoles(),
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const text =
      `${actor.snapshot.name} is chased by ${target.snapshot.name} over a rickety bridge high above a canyon. ` +
      `Knowing ${actorPronouns.subject} will never win through strength alone, ${actorPronouns.subject} kicks out the bridge supports just in time, ` +
      `sending ${target.snapshot.name} plummeting to ${targetPronouns.possessiveAdjective} death.`;

    return {
      text,
      changes: [
        ...createFatalWithoutLoot(
          target,
          actor,
          "low-brawn-bridge-sabotage",
          "Fell from a sabotaged bridge",
          `${target.snapshot.name} is sent falling from a bridge sabotaged by ${actor.snapshot.name}.`,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const STUCK_IN_THE_MUCK: EventDefinition = {
  id: "low-brawn-stuck-in-the-muck",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.55,
  tags: ["fatal", "environment", "deprivation"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrawn,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
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
    const text =
      `${actor.snapshot.name} tries to collect water from the river but quickly becomes stuck in the mud. ` +
      `${pronouns.Subject} tries ${pronouns.possessiveAdjective} hardest to pull free, but ${pronouns.possessiveAdjective} muscles are like soft-boiled eggs. ` +
      `By nightfall, ${pronouns.subject} loses the strength to keep trying and slips beneath the surface.`;

    return {
      text,
      changes: createFatalChanges(
        actor,
        "low-brawn-mud-drowning",
        "Drowned in mud",
        `${actor.snapshot.name} becomes trapped in riverbank mud and drowns.`,
      ),
    };
  },
};

const FORAGING_WHILE_WEAK: EventDefinition = {
  id: "low-brawn-foraging-while-weak",
  category: "survival",
  periods: ["day"],
  baseWeight: 2,
  tags: ["survival", "status", "deprivation"],
  selectionProfile: statSelectionProfile(4, ["status-requirement", "deprivation-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isLowBrawn(tribute) && hasStatus(tribute, "hungry"),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brawn",
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
        `${actor.snapshot.name}'s limited strength is depleted further by hunger. ` +
        `${pronouns.Subject} spends the day searching for food and finally finds a patch of carrots, ` +
        `but no matter how hard ${pronouns.subject} heaves, ${pronouns.subject} cannot pull a single carrot from the ground.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const ROYAL_TREATMENT_FATAL_EVENTS = TRUCE_EVENT_SIZES.map(createRoyalTreatmentFatal);

const ROYAL_TREATMENT_FRIENDLY_EVENTS = TRUCE_EVENT_SIZES.map(createRoyalTreatmentFriendly);

export const LOW_BRAWN_EVENTS = [
  ROCK_AND_A_HARD_PLACE,
  DRAGGING_THE_LOOT,
  STICK_SHELTER,
  HOLD_ON,
  EXCALIBUR,
  TURTLING,
  CHILDPROOFED_MEDKIT_BRAWN,
  createLetsBeHonestEvent("day"),
  createLetsBeHonestEvent("night"),
  WEAPONIZED_HELPLESSNESS,
  FAILED_INTIMIDATION,
  LOOKING_OUT_FOR_THE_LITTLE_GUY,
  ...ROYAL_TREATMENT_FATAL_EVENTS,
  ...ROYAL_TREATMENT_FRIENDLY_EVENTS,
  BRIDGE_OVER_TROUBLED_WATER,
  STUCK_IN_THE_MUCK,
  FORAGING_WHILE_WEAK,
] satisfies readonly EventDefinition[];
