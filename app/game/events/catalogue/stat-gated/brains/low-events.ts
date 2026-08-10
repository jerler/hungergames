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
import { ITEM_CATALOGUE } from "~/game/items/item-catalogue";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { getActiveTruceForTribute } from "~/game/truces/truce-engine";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameChange, GameState, GameTribute } from "~/game/types/game-state";

import {
  MELEE_WEAPON_IDS,
  TRUCE_EVENT_SIZES,
  chooseTextVariant,
  getActiveTruceOfSize,
  getParticipantShapeForSize,
  getLowercaseItemLabel,
  hasStatus,
  isLowBrains,
  requireSelectedItem,
  statSelectionProfile,
  type TruceEventSize,
} from "../stat-gated-helpers";

const ALL_ITEM_IDS: readonly ItemDefinitionId[] = ITEM_CATALOGUE.map((definition) => definition.id);

const BOW_IDS = ["bow", "longbow"] as const satisfies readonly ItemDefinitionId[];

const RANGED_WEAPON_IDS = [
  "slingshot",
  "bow",
  "longbow",
  "crossbow",
  "blowgun",
] as const satisfies readonly ItemDefinitionId[];

function createSatisfyNeedChange(tribute: GameTribute, need: "food" | "water"): GameChange {
  return {
    type: "satisfy-survival-need",
    tributeId: tribute.id,
    need,
  };
}

function createTransferChange(
  itemInstanceId: string,
  fromTributeId: string,
  toTributeId: string,
  reason = "theft",
): GameChange {
  return {
    type: "transfer-item",
    itemInstanceId,
    fromTributeId,
    toTributeId,
    reason,
  };
}

function createDestroyChange(
  tribute: GameTribute,
  itemInstanceId: string,
  reason: string,
): GameChange {
  return {
    type: "destroy-item",
    tributeId: tribute.id,
    itemInstanceId,
    reason,
  };
}

function createLowBrainsTruceMemberRoles(
  size: TruceEventSize,
  opposesRoleIds: readonly string[] = [],
): readonly ParticipantRoleDefinition[] {
  return [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isLowBrains(tribute) && getActiveTruceOfSize(state, tribute.id, size) !== null,
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
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
      opposesRoleIds,
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
      opposesRoleIds,
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

function getHanselAndGretelShape(size: TruceEventSize): "trio" | "group-four-plus" {
  return size === 2 ? "trio" : "group-four-plus";
}

function getTruceEventBaseWeight(baseWeight: number, size: TruceEventSize): number {
  return size === 3 ? baseWeight : baseWeight / size;
}

const CHILDPROOFED_MEDKIT_BRAINS: EventDefinition = {
  id: "low-brains-childproofed-medkit",
  category: "hazard",
  periods: ["day", "night"],
  baseWeight: 10,
  tags: ["hazard", "item"],
  selectionProfile: statSelectionProfile(4, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
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
        `${actor.snapshot.name} spends ten humiliating minutes trying to figure out how to open ` +
        `the child-proof latch on the medkit's packaging before finally reaching the supplies inside.`,
      changes: [
        createItemUseChange(actor, medKit, context.eventId),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const HANSEL_AND_GRETEL_SOLO: EventDefinition = {
  id: "low-brains-hansel-and-gretel-solo",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.65,
  tags: ["fatal", "combat", "ambush"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
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

    return {
      text:
        `Worried about getting lost in the woods, ${actor.snapshot.name} lays down a trail of food so ${actorPronouns.subject} can retrace ${actorPronouns.possessiveAdjective} steps. ` +
        `Unfortunately, ${target.snapshot.name} follows the trail just as easily and kills ${actor.snapshot.name} from behind.`,
      changes: [
        ...createFatalChanges(
          actor,
          "low-brains-hansel-and-gretel",
          "Killed after leaving a trail",
          `${actor.snapshot.name} is tracked and killed by ${target.snapshot.name} after leaving a trail through the arena.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

function createHanselAndGretelTruce(size: TruceEventSize): EventDefinition {
  return {
    id: `low-brains-hansel-and-gretel-truce-${size}`,
    category: "fatal",
    periods: ["day"],
    baseWeight: getTruceEventBaseWeight(0.7, size),
    tags: ["fatal", "combat", "ambush", "truce"],
    participantShape: getHanselAndGretelShape(size),
    selectionProfile: statSelectionProfile(5, ["truce-requirement"]),
    roles: [
      ...createLowBrainsTruceMemberRoles(size, ["target"]),
      {
        id: "target",
        count: 1,
        targeting: "hostile",
        isEligible: (tribute, { state, participantsByRole }) =>
          !isSameTruceMember(tribute, participantsByRole.actor?.[0], state),
        opposesRoleIds: ["actor", "members"],
      },
    ],
    resolve({ participantsByRole }) {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const members = requireParticipants(participantsByRole, "members");
      const target = requireSingleParticipant(participantsByRole, "target");
      const actorPronouns = getTributePronouns(actor);

      if (members.length !== size - 1) {
        throw new Error(`Hansel and Gretel expected ${size - 1} truce mates.`);
      }

      const victims = [actor, ...members];
      const fatalChanges = victims.flatMap((victim) =>
        createFatalChanges(
          victim,
          "low-brains-hansel-and-gretel-truce",
          "Killed after following a truce's trail",
          `${victim.snapshot.name} is killed by ${target.snapshot.name} after the truce leaves an obvious trail through the arena.`,
          target,
        ),
      );

      return {
        text:
          `Worried about getting lost in the woods, ${actor.snapshot.name} lays down a trail of food behind the group so ${actorPronouns.subject} can retrace the group's steps. ` +
          `Unfortunately, ${target.snapshot.name} follows the trail just as easily and takes out the entire truce in a surprise attack.`,
        changes: [...fatalChanges, ...createSurvivalChanges([target])],
      };
    },
  };
}

const NATURES_SNACK_BOWL: EventDefinition = {
  id: "low-brains-natures-snack-bowl",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.8,
  tags: ["hazard", "status", "deprivation", "resource"],
  selectionProfile: statSelectionProfile(5, ["status-requirement", "deprivation-requirement"]),
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
      isEligible: (tribute) => isLowBrains(tribute) && hasStatus(tribute, "hungry"),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
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
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text: chooseTextVariant(random, [
        `${actor.snapshot.name} finds a bush covered in brightly coloured berries. Deciding that dangerous food probably would not look so delicious, ${actor.snapshot.name} eats several handfuls before continuing through the arena.`,
        `${actor.snapshot.name} finds a strange mushroom growing beneath a tree. ${pronouns.Subject} gives it one thoughtful sniff, decides that is sufficient research, and then eats the entire thing.`,
      ]),
      changes: [
        createStatusChange(eventId, actor, "poisoned", 1, round),
        createSatisfyNeedChange(actor, "food"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const PREMIUM_WATER: EventDefinition = {
  id: "low-brains-premium-water",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.8,
  tags: ["hazard", "status", "deprivation", "resource"],
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
      isEligible: (tribute) => isLowBrains(tribute) && hasStatus(tribute, "thirsty"),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
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
        `${actor.snapshot.name} finds a puddle covered in an oily rainbow sheen. Assuming the colours mean the water is rich in nutrients, ` +
        `${pronouns.subject} drinks until ${pronouns.possessiveAdjective} thirst is satisfied.`,
      changes: [
        createStatusChange(eventId, actor, "poisoned", 1, round),
        createSatisfyNeedChange(actor, "water"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const FREE_HONEY: EventDefinition = {
  id: "low-brains-free-honey",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.2,
  tags: ["hazard", "status", "resource"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
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

    return {
      text:
        `${actor.snapshot.name} discovers a beehive hanging from a low branch and reaches inside for the honey. ` +
        `Several hundred bees immediately make it clear why no one else had taken any.`,
      changes: [
        createStatusChange(eventId, actor, "injured", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const SNAKE_TAMER_FATAL: EventDefinition = {
  id: "low-brains-snake-tamer-fatal",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.45,
  tags: ["fatal", "environment"],
  selectionProfile: statSelectionProfile(3),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brains === 1,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "eq",
            threshold: 1,
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
        `${actor.snapshot.name} finds a snake curled up in the leaves and decides to befriend it, hoping to use its venom as a weapon against the other tributes. ` +
        `On the plus side, ${pronouns.subject} was right that the venom is a deadly weapon. Too bad ${pronouns.subject} will not be around to use it.`,
      changes: createFatalChanges(
        actor,
        "low-brains-snake-tamer",
        "Killed by a snakebite",
        `${actor.snapshot.name} is killed after trying to befriend a venomous snake.`,
      ),
    };
  },
};

const SNAKE_TAMER_NONFATAL: EventDefinition = {
  id: "low-brains-snake-tamer-nonfatal",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.1,
  tags: ["hazard", "status", "environment"],
  selectionProfile: statSelectionProfile(3),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brains === 1,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "eq",
            threshold: 1,
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
        `${actor.snapshot.name} finds a snake curled up in the leaves and decides to befriend it, hoping to use its venom as a weapon against the other tributes. ` +
        `On the plus side, ${pronouns.subject} was right that the venom is a deadly weapon. Now ${pronouns.subject} just needs to find an antidote.`,
      changes: [
        createStatusChange(eventId, actor, "poisoned", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const OBVIOUS_TRAP_NONFATAL: EventDefinition = {
  id: "low-brains-obvious-trap-nonfatal",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1,
  tags: ["hazard", "item", "ambush"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brains === 1,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "eq",
            threshold: 1,
            valueSource: "base",
          },
        ],
      },
      requiredItemDefinitionIds: ALL_ITEM_IDS,
      requiredItemRequireUsable: false,
      itemAccess: "owned",
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const item = requireSelectedItem(context, "actor");

    return {
      text:
        `${actor.snapshot.name} discovers a backpack sitting alone in the middle of the forest beneath what appears to be a large suspended net. ` +
        `After briefly wondering why anyone would leave a perfectly good net and backpack around, ${actorPronouns.subject} walks directly underneath and gets snatched up in the obvious trap. ` +
        `${target.snapshot.name} takes one of ${actor.snapshot.name}'s supplies but lets ${actorPronouns.object} go free out of pity for ${actorPronouns.possessiveAdjective} sheer stupidity.`,
      changes: [
        createTransferChange(item.id, actor.id, target.id),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const OBVIOUS_TRAP_FATAL: EventDefinition = {
  id: "low-brains-obvious-trap-fatal",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.55,
  tags: ["fatal", "combat", "ambush"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(3),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brains === 1,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "eq",
            threshold: 1,
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
  resolve({ random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);

    return {
      text: chooseTextVariant(random, [
        `${actor.snapshot.name} discovers a backpack sitting alone in the middle of the forest beneath what appears to be a large suspended net. ` +
          `After briefly wondering why anyone would leave a perfectly good net and backpack around, ${actorPronouns.subject} walks directly underneath and gets snatched up in the obvious trap. ` +
          `${target.snapshot.name} quickly finishes the job and resets ${targetPronouns.possessiveAdjective} trap.`,
        `${actor.snapshot.name} finds a handwritten sign reading FREE SUPPLIES with an arrow pointing into a dark pit. ` +
          `Impressed by the Capitol's generosity, ${actorPronouns.subject} follows the arrow and falls directly onto ${target.snapshot.name}'s sharpened stakes below.`,
      ]),
      changes: [
        ...createFatalChanges(
          actor,
          "low-brains-obvious-trap",
          "Killed in an obvious trap",
          `${actor.snapshot.name} is killed after walking into ${target.snapshot.name}'s obvious trap.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const TWO_BIRDS_ONE_WEAPON: EventDefinition = {
  id: "low-brains-two-birds-one-weapon",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.2,
  tags: ["hazard", "item", "weapon", "combat"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
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
      requiredItemDefinitionIds: MELEE_WEAPON_IDS,
      requiredItemRequireUsable: false,
      itemAccess: "owned",
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const weapon = requireSelectedItem(context, "actor");
    const weaponLabel = getLowercaseItemLabel(weapon);

    return {
      text:
        `${actor.snapshot.name} spots ${target.snapshot.name} in the distance and throws ${actorPronouns.possessiveAdjective} ${weaponLabel} at ${targetPronouns.object}, ` +
        `apparently forgetting that it was not designed to be thrown. The ${weaponLabel} lands harmlessly at ${target.snapshot.name}'s feet, ` +
        `where ${targetPronouns.subject} gratefully picks it up and runs away.`,
      changes: [
        createTransferChange(weapon.id, actor.id, target.id),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const FISHING_GENIUS: EventDefinition = {
  id: "low-brains-fishing-genius",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.5,
  tags: ["hazard", "status", "deprivation", "resource"],
  selectionProfile: statSelectionProfile(4, ["status-requirement", "deprivation-requirement"]),
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
      isEligible: (tribute) => isLowBrains(tribute) && hasStatus(tribute, "hungry"),
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
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
        `${actor.snapshot.name} tries to catch a fish by holding ${pronouns.possessiveAdjective} hand underwater with a small worm between ${pronouns.possessiveAdjective} fingers. ` +
        `Something eventually bites, but it is much larger and considerably less edible than expected.`,
      changes: [
        createStatusChange(eventId, actor, "injured", 1, round),
        createSatisfyNeedChange(actor, "water"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const WEAPON_MAINTENANCE: EventDefinition = {
  id: "low-brains-weapon-maintenance",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1,
  tags: ["hazard", "item", "weapon"],
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
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
      requiredItemDefinitionIds: MELEE_WEAPON_IDS,
      requiredItemRequireUsable: false,
      itemAccess: "owned",
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const weapon = requireSelectedItem(context, "actor");
    const weaponLabel = getLowercaseItemLabel(weapon);

    return {
      text:
        `${actor.snapshot.name} decides ${pronouns.possessiveAdjective} ${weaponLabel} would swing faster if the handle were thoroughly greased. ` +
        `On the next practice swing, it launches out of ${pronouns.possessiveAdjective} hands and disappears into the forest.`,
      changes: [
        createDestroyChange(actor, weapon.id, "low-brains-weapon-maintenance"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const NATURES_BLANKET: EventDefinition = {
  id: "low-brains-natures-blanket",
  category: "hazard",
  periods: ["night"],
  baseWeight: 1.3,
  tags: ["hazard", "status", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
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
        `${actor.snapshot.name} gathers an armful of soft-looking leaves and uses them as bedding for the night. ` +
        `By morning, ${pronouns.possessiveAdjective} entire body is covered in an angry, blistering rash.`,
      changes: [
        createStatusChange(eventId, actor, "injured", 1, round),
        ...createNightRestChanges([actor], round, "sheltered"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

function createWatchDuty(size: TruceEventSize): EventDefinition {
  return {
    id: `low-brains-watch-duty-${size}`,
    category: "survival",
    periods: ["night"],
    baseWeight: getTruceEventBaseWeight(1.4, size),
    tags: ["survival", "status", "truce"],
    participantShape: getParticipantShapeForSize(size),
    selectionProfile: statSelectionProfile(4, ["truce-requirement"]),
    roles: createLowBrainsTruceMemberRoles(size),
    resolve({ eventId, round, participantsByRole }) {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const members = requireParticipants(participantsByRole, "members");
      const pronouns = getTributePronouns(actor);

      if (members.length !== size - 1) {
        throw new Error(`Watch Duty expected ${size - 1} truce mates.`);
      }

      return {
        text:
          `${actor.snapshot.name} volunteers to take the first watch and spends several hours staring attentively at the campfire. ` +
          `Nobody remembers to clarify that ${pronouns.subject} was supposed to watch the woods.`,
        changes: [
          ...createNightRestChanges([actor], round, "comfortable"),
          createStatusChange(eventId, actor, "well-rested", 1, round),
          ...createSurvivalChanges([actor, ...members]),
        ],
      };
    },
  };
}

const TRADE_DEAL: EventDefinition = {
  id: "low-brains-trade-deal",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.2,
  tags: ["hazard", "item"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(5, ["item-requirement", "custom-eligibility"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
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
      requiredItemDefinitionIds: ALL_ITEM_IDS,
      requiredItemRequireUsable: false,
      itemAccess: "owned",
    },
    {
      id: "target",
      count: 1,
      isEligible: (tribute) => tribute.inventory.length === 0,
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const item = requireSelectedItem(context, "actor");

    return {
      text:
        `${target.snapshot.name} offers ${actor.snapshot.name} a very special invisible weapon in exchange for ${actorPronouns.possessiveAdjective} real supplies. ` +
        `${actor.snapshot.name} carefully accepts the invisible weapon and walks away delighted with the trade.`,
      changes: [
        createTransferChange(item.id, actor.id, target.id),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const LUCKY_ROCK: EventDefinition = {
  id: "low-brains-lucky-rock",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1,
  tags: ["hazard", "item"],
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brains === 1,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "eq",
            threshold: 1,
            valueSource: "base",
          },
        ],
      },
      requiredItemDefinitionIds: ALL_ITEM_IDS,
      requiredItemRequireUsable: false,
      itemAccess: "owned",
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const item = requireSelectedItem(context, "actor");

    return {
      text:
        `${actor.snapshot.name} finds a rock shaped vaguely like a face and becomes convinced it is lucky. ` +
        `To make room for it, ${pronouns.subject} abandons one of ${pronouns.possessiveAdjective} other supplies beside the path.`,
      changes: [
        createDestroyChange(actor, item.id, "low-brains-lucky-rock"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const THIS_SIDE_UP: EventDefinition = {
  id: "low-brains-this-side-up",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.1,
  tags: ["hazard", "status", "item", "weapon"],
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
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
      requiredItemDefinitionIds: BOW_IDS,
      requiredItemRequireUsable: false,
      itemAccess: "owned",
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    requireSelectedItem(context, "actor");

    return {
      text:
        `${actor.snapshot.name} holds ${pronouns.possessiveAdjective} bow sideways because it looks more intimidating that way. ` +
        `The arrow snaps against the frame and buries itself in ${pronouns.possessiveAdjective} forearm.`,
      changes: [
        createStatusChange(context.eventId, actor, "injured", 1, context.round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const WARNING_SHOT: EventDefinition = {
  id: "low-brains-warning-shot",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.5,
  tags: ["fatal", "weapon", "environment"],
  selectionProfile: statSelectionProfile(5, ["item-requirement", "custom-eligibility"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) =>
        tribute.snapshot.stats.brains === 1 || tribute.snapshot.stats.luck === 1,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat-any",
            roleId: "actor",
            alternatives: [
              {
                stat: "brains",
                comparison: "eq",
                threshold: 1,
                valueSource: "base",
              },
              {
                stat: "luck",
                comparison: "eq",
                threshold: 1,
                valueSource: "base",
              },
            ],
          },
        ],
      },
      requiredItemDefinitionIds: RANGED_WEAPON_IDS,
      requiredItemRequireUsable: false,
      itemAccess: "owned",
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    requireSelectedItem(context, "actor");

    return {
      text:
        `${actor.snapshot.name} tries to fire a warning shot into the air but forgets that falling ammunition remains ammunition. ` +
        `Several seconds later, the projectile returns and strikes ${actor.snapshot.name} directly in the head.`,
      changes: createFatalChanges(
        actor,
        "low-brains-warning-shot",
        "Killed by falling ammunition",
        `${actor.snapshot.name} is killed when ammunition from an ill-advised warning shot falls back down.`,
      ),
    };
  },
};

const PLAYING_DEAD: EventDefinition = {
  id: "low-brains-playing-dead",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.65,
  tags: ["fatal", "combat", "ambush"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
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

    return {
      text:
        `${actor.snapshot.name} drops to the ground and plays dead before ${target.snapshot.name} reaches ${actorPronouns.object}. ` +
        `${target.snapshot.name} briefly pauses to appreciate how convenient this is before making the performance permanent.`,
      changes: [
        ...createFatalChanges(
          actor,
          "low-brains-playing-dead",
          "Killed while playing dead",
          `${actor.snapshot.name} is killed by ${target.snapshot.name} while attempting to play dead.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const REVERSE_PSYCHOLOGY: EventDefinition = {
  id: "low-brains-reverse-psychology",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.1,
  tags: ["hazard", "item", "combat"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
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
      requiredItemDefinitionIds: ALL_ITEM_IDS,
      requiredItemRequireUsable: false,
      itemAccess: "owned",
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const selectedItem = requireSelectedItem(context, "actor");
    const transferableItems = actor.inventory.filter(
      (item) => item.id === selectedItem.id || !context.unavailableItemInstanceIds?.has(item.id),
    );

    return {
      text:
        `${target.snapshot.name} tells ${actor.snapshot.name} that handing over all of ${actorPronouns.possessiveAdjective} supplies would be an incredibly stupid thing to do. ` +
        `Determined not to be manipulated by obvious reverse psychology, ${actor.snapshot.name} hands everything over.`,
      changes: [
        ...transferableItems.map((item) => createTransferChange(item.id, actor.id, target.id)),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const HANSEL_AND_GRETEL_TRUCE_EVENTS = TRUCE_EVENT_SIZES.map(createHanselAndGretelTruce);
const WATCH_DUTY_EVENTS = TRUCE_EVENT_SIZES.map(createWatchDuty);

export const LOW_BRAINS_EVENTS = [
  CHILDPROOFED_MEDKIT_BRAINS,
  HANSEL_AND_GRETEL_SOLO,
  ...HANSEL_AND_GRETEL_TRUCE_EVENTS,
  NATURES_SNACK_BOWL,
  PREMIUM_WATER,
  FREE_HONEY,
  SNAKE_TAMER_FATAL,
  SNAKE_TAMER_NONFATAL,
  OBVIOUS_TRAP_NONFATAL,
  OBVIOUS_TRAP_FATAL,
  TWO_BIRDS_ONE_WEAPON,
  FISHING_GENIUS,
  WEAPON_MAINTENANCE,
  NATURES_BLANKET,
  ...WATCH_DUTY_EVENTS,
  TRADE_DEAL,
  LUCKY_ROCK,
  THIS_SIDE_UP,
  WARNING_SHOT,
  PLAYING_DEAD,
  REVERSE_PSYCHOLOGY,
] satisfies readonly EventDefinition[];
