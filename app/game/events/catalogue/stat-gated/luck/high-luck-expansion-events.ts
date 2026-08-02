import {
  createEliminationChange,
  createFatalChanges,
  createItemUseChange,
  createNightRestChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";
import { getActiveTruceForTribute, getLivingTruceMembers } from "~/game/truces/truce-engine";
import type { GameChange, GameTribute } from "~/game/types/game-state";

import {
  chooseTextVariant,
  createFatalWithoutLoot,
  getLowercaseItemLabel,
  hasStatus,
  MELEE_WEAPON_IDS,
  requireSelectedItem,
  statSelectionProfile,
} from "../stat-gated-helpers";

const BOW_WEAPON_IDS = ["bow", "longbow"] as const satisfies readonly ItemDefinitionId[];

const RANGED_WEAPON_IDS = [
  "bow",
  "longbow",
  "crossbow",
  "blowgun",
  "slingshot",
] as const satisfies readonly ItemDefinitionId[];

const SPEAR_FISHING_WEAPON_IDS = [
  "spear",
  "trident",
] as const satisfies readonly ItemDefinitionId[];

function isHighLuck(tribute: GameTribute): boolean {
  return tribute.snapshot.stats.luck >= 4;
}

function isMaximumLuck(tribute: GameTribute): boolean {
  return tribute.snapshot.stats.luck === 5;
}

function isHighLuckAndHungry(tribute: GameTribute): boolean {
  return isHighLuck(tribute) && hasStatus(tribute, "hungry");
}

function isHighLuckAndThirsty(tribute: GameTribute): boolean {
  return isHighLuck(tribute) && hasStatus(tribute, "thirsty");
}

function createSatisfyNeedChange(tribute: GameTribute, need: "food" | "water"): GameChange {
  return {
    type: "satisfy-survival-need",
    tributeId: tribute.id,
    need,
  };
}

function isHighLuckTruceCarrier(
  tribute: GameTribute,
  context: Parameters<NonNullable<EventDefinition["roles"][number]["isEligible"]>>[1],
): boolean {
  if (!isHighLuck(tribute)) {
    return false;
  }

  const truce = getActiveTruceForTribute(context.state, tribute.id);

  return (
    truce !== null &&
    getLivingTruceMembers(context.state, truce).some((member) => member.inventory.length > 0)
  );
}

function getSelectedActorWeapon(context: EventResolutionContext) {
  return requireSelectedItem(context, "actor");
}

const CAMOUFLUKE: EventDefinition = {
  id: "high-luck-camoufluke",
  category: "survival",
  periods: ["day"],
  baseWeight: 0.9,
  tags: ["survival", "combat", "ambush", "environment", "status"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighLuck,
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);

    const text = chooseTextVariant(random, [
      `${target.snapshot.name} chases ${actor.snapshot.name} through the trees, hot in pursuit. ` +
        `${actor.snapshot.name} slips into a muddy ditch and, before ${actorPronouns.subject} can climb back out, leaves blow across ${actorPronouns.possessiveAdjective} face and completely conceal ${actorPronouns.object}. ` +
        `${target.snapshot.name} walks straight past while ${actor.snapshot.name} lies face-down in the mud, equal parts grateful and confused.`,
      `${target.snapshot.name} chases ${actor.snapshot.name} through the trees, hot in pursuit. ` +
        `${actor.snapshot.name} searches for a hiding place in vain when an industrious groundhog kicks up a wall of dust, perfectly concealing ${actorPronouns.object} and temporarily blinding ${target.snapshot.name}.`,
    ]);

    return {
      text,
      changes: [
        createStatusChange(eventId, actor, "hidden", 1, round),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const PERSONAL_RAIN_CLOUD_USEFUL: EventDefinition = {
  id: "high-luck-personal-rain-cloud-useful",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.8,
  tags: ["survival", "deprivation", "resource", "environment"],
  selectionProfile: statSelectionProfile(6, ["status-requirement", "deprivation-requirement"]),
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
      isEligible: isHighLuckAndThirsty,
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");

    return {
      text:
        `${actor.snapshot.name} shelters beneath a tree during a sudden downpour. ` +
        `Once the rain stops, a perfect pool of clean water has gathered right at eye level, allowing ${actor.snapshot.name} to take a long drink.`,
      changes: [createSatisfyNeedChange(actor, "water"), ...createSurvivalChanges([actor])],
    };
  },
};

const STUCK_IN_THE_MUD_FORTUNATE: EventDefinition = {
  id: "high-luck-stuck-in-the-mud-fortunate",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.65,
  tags: ["fatal", "combat", "ambush", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighLuck,
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
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${actor.snapshot.name} becomes stuck ankle-deep in thick mud while fleeing from ${target.snapshot.name}. ` +
        `${target.snapshot.name} charges forward, hits the same patch at full speed, and sinks face-first up to ${targetPronouns.possessiveAdjective} shoulders while ${actor.snapshot.name} calmly pulls free, leaving ${target.snapshot.name} to sink into the muck.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-luck-stuck-in-the-mud-fortunate",
          "Sank into deep mud",
          `${target.snapshot.name} sinks into deep mud while chasing ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const BIRD_STRIKE_SPECIAL_DELIVERY: EventDefinition = {
  id: "high-luck-bird-strike-special-delivery",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.7,
  tags: ["survival", "deprivation", "resource", "environment"],
  selectionProfile: statSelectionProfile(6, ["status-requirement", "deprivation-requirement"]),
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
      isEligible: isHighLuckAndHungry,
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} looks upward after hearing wings overhead. ` +
        `A bird drops a piece of fruit directly into ${pronouns.possessiveAdjective} hands before flying away.`,
      changes: [createSatisfyNeedChange(actor, "food"), ...createSurvivalChanges([actor])],
    };
  },
};

const STEP_ON_A_WASP_NEST_REDIRECT: EventDefinition = {
  id: "high-luck-step-on-a-wasp-nest-redirect",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.65,
  tags: ["fatal", "combat", "ambush", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighLuck,
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
        `${actor.snapshot.name} steps directly onto a tracker jacker nest and runs screaming through the woods. ` +
        `The swarm follows until ${actorPronouns.subject} passes ${target.snapshot.name}, at which point the tracker jackers collectively decide that ${target.snapshot.name} looks like the more offensive tribute. ` +
        `${target.snapshot.name}'s screams are drowned out by the buzzing, then stop altogether.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-luck-step-on-a-wasp-nest-redirect",
          "Killed by redirected tracker jackers",
          `${target.snapshot.name} is killed by tracker jackers redirected by ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const TRACKER_JACKED: EventDefinition = {
  id: "high-luck-tracker-jacked",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.4,
  tags: ["fatal", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(5),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isMaximumLuck,
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
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${actor.snapshot.name} walks beneath a tracker jacker hive just as it falls from the tree. ` +
        `The hive bounces off ${actorPronouns.possessiveAdjective} backpack, rolls down a hill, and bursts open directly beside ${target.snapshot.name}. ` +
        `${actor.snapshot.name} runs in the opposite direction while ${targetPronouns.possessiveAdjective} final screams are drowned out by the buzzing.`,
      changes: [
        createEliminationChange(
          target,
          "high-luck-tracker-jacked",
          "Killed by tracker jackers",
          `${target.snapshot.name} is killed by tracker jackers after a falling hive ricochets away from ${actor.snapshot.name}.`,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const FORAGING_DIGNITY_RESTORED: EventDefinition = {
  id: "high-luck-foraging-dignity-restored",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.55,
  tags: ["survival", "deprivation", "resource", "environment"],
  selectionProfile: statSelectionProfile(6, ["status-requirement", "deprivation-requirement"]),
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
      isEligible: isHighLuckAndHungry,
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} reaches for a piece of fruit hanging from a high branch. ` +
        `It is frustratingly just out of reach, but as though it feels sympathy for ${pronouns.object}, the fruit falls, bounces off ${pronouns.possessiveAdjective} forehead, and lands perfectly inside ${pronouns.possessiveAdjective} open backpack.`,
      changes: [createSatisfyNeedChange(actor, "food"), ...createSurvivalChanges([actor])],
    };
  },
};

const FISHING_DIGNITY_RESTORED: EventDefinition = {
  id: "high-luck-fishing-dignity-restored",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.55,
  tags: ["survival", "deprivation", "resource", "environment"],
  selectionProfile: statSelectionProfile(6, ["status-requirement", "deprivation-requirement"]),
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
      isEligible: isHighLuckAndHungry,
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} sits beside the river wondering how ${pronouns.subject} is going to catch a fish. ` +
        `One suddenly launches from the water, slaps ${pronouns.object} across the face, and lands stunned on the riverbank beside ${pronouns.object}.`,
      changes: [createSatisfyNeedChange(actor, "food"), ...createSurvivalChanges([actor])],
    };
  },
};

const BERRY_FORTUNATE: EventDefinition = {
  id: "high-luck-berry-fortunate",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.55,
  tags: ["survival", "deprivation", "resource", "environment"],
  selectionProfile: statSelectionProfile(6, ["status-requirement", "deprivation-requirement"]),
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
      isEligible: isHighLuckAndHungry,
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} reaches for a handful of berries just as the branch snaps. ` +
        `The entire cluster falls neatly into ${pronouns.possessiveAdjective} backpack while the broken branch misses ${pronouns.object} by less than an inch.`,
      changes: [createSatisfyNeedChange(actor, "food"), ...createSurvivalChanges([actor])],
    };
  },
};

const LAST_SIP_FIRST_TRY: EventDefinition = {
  id: "high-luck-last-sip-first-try",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.65,
  tags: ["survival", "deprivation", "resource", "environment"],
  selectionProfile: statSelectionProfile(6, ["status-requirement", "deprivation-requirement"]),
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
      isEligible: isHighLuckAndThirsty,
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} finds a few drops of rainwater collected inside a curled leaf. ` +
        `As ${pronouns.subject} lifts it to drink, another leaf above tips over and fills the first one to the brim.`,
      changes: [createSatisfyNeedChange(actor, "water"), ...createSurvivalChanges([actor])],
    };
  },
};

const SLIPPERY_WHEN_ARMED_FORTUNATE: EventDefinition = {
  id: "high-luck-slippery-when-armed-fortunate",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.55,
  tags: ["fatal", "combat", "weapon", "item"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(6, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isMaximumLuck,
      requiredItemDefinitionIds: MELEE_WEAPON_IDS,
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
    const weapon = getSelectedActorWeapon(context);

    return {
      text:
        `${actor.snapshot.name} and ${target.snapshot.name} get into an epic fight. ` +
        `${actor.snapshot.name} raises ${actorPronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)} but loses ${actorPronouns.possessiveAdjective} grip at the worst possible moment. ` +
        `The weapon spins through the air, ricochets off a tree trunk, and strikes ${target.snapshot.name} directly in the chest.`,
      changes: [
        createItemUseChange(actor, weapon, "high-luck-slippery-when-armed"),
        ...createFatalChanges(
          target,
          "high-luck-slippery-when-armed-fortunate",
          "Killed by a fortunate weapon ricochet",
          `${target.snapshot.name} is killed when ${actor.snapshot.name}'s weapon ricochets from a tree.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const BOW_TO_CHANCE: EventDefinition = {
  id: "high-luck-bow-to-chance",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.45,
  tags: ["fatal", "combat", "weapon", "item"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(6, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isMaximumLuck,
      requiredItemDefinitionIds: BOW_WEAPON_IDS,
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
    const weapon = getSelectedActorWeapon(context);

    return {
      text:
        `${actor.snapshot.name} draws ${actorPronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)} while aiming at ${target.snapshot.name}. ` +
        `Unfortunately, the string snaps at the last second and launches the arrow sideways, where it ricochets off a tree and strikes ${target.snapshot.name} straight through the eye.`,
      changes: [
        createItemUseChange(actor, weapon, "high-luck-bow-to-chance"),
        ...createFatalWithoutLoot(
          target,
          actor,
          "high-luck-bow-to-chance",
          "Killed by an impossible arrow ricochet",
          `${target.snapshot.name} is killed by ${actor.snapshot.name}'s ricocheting arrow.`,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const SPEAR_FISHING_ACTUAL_SUCCESS: EventDefinition = {
  id: "high-luck-spear-fishing-actual-success",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.8,
  tags: ["survival", "deprivation", "resource", "weapon", "item"],
  selectionProfile: statSelectionProfile(8, [
    "status-requirement",
    "deprivation-requirement",
    "item-requirement",
  ]),
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
      isEligible: isHighLuckAndHungry,
      requiredItemDefinitionIds: SPEAR_FISHING_WEAPON_IDS,
      itemAccess: "owned",
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const weapon = getSelectedActorWeapon(context);

    return {
      text:
        `${actor.snapshot.name} thrusts ${pronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)} into the river without seeing a single fish. ` +
        `When ${pronouns.subject} pulls it back out, an enormous salmon is somehow impaled on the end.`,
      changes: [
        createItemUseChange(actor, weapon, "high-luck-spear-fishing"),
        createSatisfyNeedChange(actor, "food"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const EXCALIBUR_FORTUNATE: EventDefinition = {
  id: "high-luck-excalibur-fortunate",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.55,
  tags: ["fatal", "combat", "weapon", "item", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(6, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighLuck,
      requiredItemDefinitionIds: MELEE_WEAPON_IDS,
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
    const weapon = getSelectedActorWeapon(context);

    return {
      text:
        `${actor.snapshot.name} swings ${actorPronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)} and lodges it deep inside a tree. ` +
        `While ${actorPronouns.subject} pulls desperately at the handle, the tree cracks, falls forward, and crushes ${target.snapshot.name}. ` +
        `The weapon shakes loose unharmed from the impact.`,
      changes: [
        createItemUseChange(actor, weapon, "high-luck-excalibur"),
        ...createFatalChanges(
          target,
          "high-luck-excalibur-fortunate",
          "Crushed by a falling tree",
          `${target.snapshot.name} is crushed by a tree felled by ${actor.snapshot.name}'s lodged weapon.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const WARNING_SHOT_FORTUNATE: EventDefinition = {
  id: "high-luck-warning-shot-fortunate",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.45,
  tags: ["fatal", "combat", "weapon", "item"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(6, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isMaximumLuck,
      requiredItemDefinitionIds: RANGED_WEAPON_IDS,
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
    const weapon = getSelectedActorWeapon(context);

    return {
      text:
        `${actor.snapshot.name} hears movement in the bushes and fires a warning shot into the air with ${actorPronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)}. ` +
        `Several seconds later, the projectile falls back into the arena and strikes ${target.snapshot.name}, who had been hiding nearby, square through the skull.`,
      changes: [
        createItemUseChange(actor, weapon, "high-luck-warning-shot"),
        ...createFatalChanges(
          target,
          "high-luck-warning-shot-fortunate",
          "Killed by a returning warning shot",
          `${target.snapshot.name} is killed when ${actor.snapshot.name}'s warning shot falls back into the arena.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const THE_SAFEST_TRIP: EventDefinition = {
  id: "high-luck-safest-trip",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.55,
  tags: ["fatal", "combat", "ambush", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighLuck,
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

    return {
      text:
        `${actor.snapshot.name} trips over a root just as ${target.snapshot.name} swings at ${actorPronouns.object}. ` +
        `The attack passes harmlessly overhead, and ${targetPronouns.possessiveAdjective} momentum carries ${targetPronouns.object} over the edge of a nearby ravine.`,
      changes: [
        ...createFatalWithoutLoot(
          target,
          actor,
          "high-luck-safest-trip",
          "Fell into a ravine",
          `${target.snapshot.name} falls into a ravine while attacking ${actor.snapshot.name}.`,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const PINECONE_ALARM: EventDefinition = {
  id: "high-luck-pinecone-alarm",
  category: "survival",
  periods: ["night"],
  baseWeight: 1,
  tags: ["survival", "combat", "ambush", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighLuck,
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} finally falls asleep beneath a tall tree. ` +
        `A pinecone drops directly onto ${actorPronouns.possessiveAdjective} forehead, waking ${actorPronouns.object} seconds before ${target.snapshot.name} enters the shelter. ` +
        `Seeing ${actorPronouns.object} awake, ${target.snapshot.name} slips back into the darkness.`,
      changes: [
        ...createNightRestChanges([actor], round, "sheltered"),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const DESIGNATED_CARRIER_FORTUNATE: EventDefinition = {
  id: "high-luck-designated-carrier-fortunate",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.2,
  tags: ["survival", "truce", "item"],
  selectionProfile: statSelectionProfile(6, ["truce-requirement", "item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighLuckTruceCarrier,
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} is handed the group's supplies moments before the backpack strap breaks. ` +
        `The bag falls directly onto a hidden pressure plate, safely triggering a trap that would otherwise have caught the entire group. ` +
        `${pronouns.Subject} checks the supplies and finds everything completely unharmed.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const TERRIBLE_THROW_EXCELLENT_RESULT: EventDefinition = {
  id: "high-luck-terrible-throw-excellent-result",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.55,
  tags: ["fatal", "combat", "weapon", "item", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(6, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighLuck,
      requiredItemDefinitionIds: BOW_WEAPON_IDS,
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
    const weapon = getSelectedActorWeapon(context);

    return {
      text:
        `${actor.snapshot.name} shoots an arrow at ${target.snapshot.name} and misses completely. ` +
        `The arrow cuts through a vine overhead, releasing a suspended branch that swings down and kills ${target.snapshot.name} instead.`,
      changes: [
        createItemUseChange(actor, weapon, "high-luck-terrible-throw"),
        ...createFatalChanges(
          target,
          "high-luck-terrible-throw-excellent-result",
          "Killed by a released branch",
          `${target.snapshot.name} is killed by a branch released by ${actor.snapshot.name}'s missed arrow.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const RIGHT_PLACE_WRONG_TIME_FOR_TARGET: EventDefinition = {
  id: "high-luck-right-place-wrong-time-for-target",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.6,
  tags: ["fatal", "combat", "ambush", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighLuck,
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
        `${actor.snapshot.name} leans against a tree to rest. ` +
        `The trunk cracks, tips forward, and falls directly onto ${target.snapshot.name}, who had chosen that exact moment to sneak up behind ${actorPronouns.object}.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-luck-right-place-wrong-time-for-target",
          "Crushed by a falling tree",
          `${target.snapshot.name} is crushed by a tree that falls while stalking ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

export const HIGH_LUCK_EXPANSION_EVENTS = [
  CAMOUFLUKE,
  PERSONAL_RAIN_CLOUD_USEFUL,
  STUCK_IN_THE_MUD_FORTUNATE,
  BIRD_STRIKE_SPECIAL_DELIVERY,
  STEP_ON_A_WASP_NEST_REDIRECT,
  TRACKER_JACKED,
  FORAGING_DIGNITY_RESTORED,
  FISHING_DIGNITY_RESTORED,
  BERRY_FORTUNATE,
  LAST_SIP_FIRST_TRY,
  SLIPPERY_WHEN_ARMED_FORTUNATE,
  BOW_TO_CHANCE,
  SPEAR_FISHING_ACTUAL_SUCCESS,
  EXCALIBUR_FORTUNATE,
  WARNING_SHOT_FORTUNATE,
  THE_SAFEST_TRIP,
  PINECONE_ALARM,
  DESIGNATED_CARRIER_FORTUNATE,
  TERRIBLE_THROW_EXCELLENT_RESULT,
  RIGHT_PLACE_WRONG_TIME_FOR_TARGET,
] satisfies readonly EventDefinition[];
