import {
  createAttemptedKillChange,
  createEliminationChange,
  createFatalChanges,
  createItemUseChange,
  createKillCreditChange,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameChange, GameTribute } from "~/game/types/game-state";

import {
  MELEE_WEAPON_IDS,
  getLowercaseItemLabel,
  hasStatus,
  isHighBrains,
  requireSelectedItem,
  statSelectionProfile,
} from "../stat-gated-helpers";

function createSatisfyNeedChange(tribute: GameTribute, need: "food" | "water"): GameChange {
  return {
    type: "satisfy-survival-need",
    tributeId: tribute.id,
    need,
  };
}

function createRemoveStatusChanges(tribute: GameTribute, statusId: "poisoned"): GameChange[] {
  return tribute.statuses.flatMap((status): GameChange[] =>
    status.definitionId === statusId
      ? [
          {
            type: "remove-status",
            tributeId: tribute.id,
            statusId: status.id,
          },
        ]
      : [],
  );
}

function createInventoryTransferChanges(
  from: GameTribute,
  to: GameTribute,
  reason = "theft",
): GameChange[] {
  return from.inventory.map((item): GameChange => ({
    type: "transfer-item",
    itemInstanceId: item.id,
    fromTributeId: from.id,
    toTributeId: to.id,
    reason,
  }));
}

function createSharedFatalChanges(
  victim: GameTribute,
  killers: readonly GameTribute[],
  causeId: string,
  causeLabel: string,
  summary: string,
): GameChange[] {
  return [
    createEliminationChange(
      victim,
      causeId,
      causeLabel,
      summary,
      killers.map((killer) => killer.id),
    ),
    ...killers.flatMap((killer) => [
      createAttemptedKillChange(killer),
      createKillCreditChange(killer),
    ]),
  ];
}

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

const FIELD_GUIDE: EventDefinition = {
  id: "high-brains-field-guide",
  category: "survival",
  periods: ["day"],
  baseWeight: 2.2,
  tags: ["survival", "deprivation", "resource"],
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
      isEligible: (tribute) => isHighBrains(tribute) && hasStatus(tribute, "hungry"),
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} carefully compares several plants, checking their leaves, roots, and smell before selecting the only one that is safe to eat. ` +
        `It tastes terrible, which ${pronouns.subject} finds reassuring.`,
      changes: [createSatisfyNeedChange(actor, "food"), ...createSurvivalChanges([actor])],
    };
  },
};

const CLEAN_ENOUGH: EventDefinition = {
  id: "high-brains-clean-enough",
  category: "survival",
  periods: ["day"],
  baseWeight: 2.2,
  tags: ["survival", "deprivation", "resource"],
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
      isEligible: (tribute) => isHighBrains(tribute) && hasStatus(tribute, "thirsty"),
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} filters muddy river water through layers of cloth, sand, and charcoal before boiling it over a small fire. ` +
        `The result is still unpleasant, but significantly less alive than when ${pronouns.subject} found it.`,
      changes: [createSatisfyNeedChange(actor, "water"), ...createSurvivalChanges([actor])],
    };
  },
};

const TRAIL_MARKER: EventDefinition = {
  id: "high-brains-trail-marker",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.35,
  tags: ["survival", "status"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text: `${actor.snapshot.name} leaves subtle marks along the trees while exploring, allowing ${pronouns.object} to travel deep into the arena without losing the route back to camp.`,
      changes: [
        createStatusChange(eventId, actor, "alert", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const WRONG_FOOTPRINTS: EventDefinition = {
  id: "high-brains-wrong-footprints",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.35,
  tags: ["survival", "status"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} straps branches beneath ${pronouns.possessiveAdjective} shoes, intentionally making the prints appear larger and less human. ` +
        `Any tributes that come across them decide to investigate another part of the arena.`,
      changes: [
        createStatusChange(eventId, actor, "hidden", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const CAMP_INSPECTION: EventDefinition = {
  id: "high-brains-camp-inspection",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.8,
  tags: ["fatal", "combat", "ambush", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
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
        `${actor.snapshot.name} watches ${target.snapshot.name} from a distance, studying ${targetPronouns.possessiveAdjective} movements through the day. ` +
        `${actor.snapshot.name} finds an opening, digs a hole, carefully places a tracker jacker nest inside, and obscures the trap with leaves. ` +
        `${actor.snapshot.name} then waits for the souped-up Capitol venom to finish the job.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-brains-tracker-jacker-trap",
          "Killed by a tracker jacker trap",
          `${target.snapshot.name} is killed by a tracker jacker trap prepared by ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const LEAD_A_HORSE_TO_WATER: EventDefinition = {
  id: "high-brains-lead-a-horse-to-water",
  category: "fatal",
  periods: ["day", "night"],
  baseWeight: 0.55,
  tags: ["fatal", "combat", "ambush", "status"],
  participantShape: "trio",
  selectionProfile: statSelectionProfile(5, ["status-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) =>
        isHighBrains(tribute) && (hasStatus(tribute, "alert") || hasStatus(tribute, "hidden")),
      opposesRoleIds: ["target-one", "target-two"],
    },
    {
      id: "target-one",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor", "target-two"],
    },
    {
      id: "target-two",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor", "target-one"],
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const targetOne = requireSingleParticipant(participantsByRole, "target-one");
    const targetTwo = requireSingleParticipant(participantsByRole, "target-two");
    const targetOnePronouns = getTributePronouns(targetOne);

    return {
      text:
        `${actor.snapshot.name} knows the locations of both ${targetOne.snapshot.name} and ${targetTwo.snapshot.name}. ` +
        `Instead of taking either tribute on directly, ${actor.snapshot.name} carefully leads ${targetOne.snapshot.name} toward ${targetTwo.snapshot.name}'s camp, ` +
        `staying out of sight and making only enough noise to guide ${targetOnePronouns.object} in the right direction. ` +
        `The plan works, and ${targetOne.snapshot.name} kills ${targetTwo.snapshot.name} while ${actor.snapshot.name} watches from the shadows.`,
      changes: [
        ...createSharedFatalChanges(
          targetTwo,
          [actor, targetOne],
          "high-brains-engineered-confrontation",
          "Killed in an engineered confrontation",
          `${targetTwo.snapshot.name} is killed by ${targetOne.snapshot.name} after being led into a confrontation by ${actor.snapshot.name}.`,
        ),
        ...createSurvivalChanges([actor, targetOne]),
      ],
    };
  },
};

const UNATTENDED_BAGGAGE: EventDefinition = {
  id: "high-brains-unattended-baggage",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.25,
  tags: ["hazard", "item", "ambush"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      isEligible: (tribute) => tribute.inventory.length > 0,
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${actor.snapshot.name} notices that ${target.snapshot.name} always sets ${targetPronouns.possessiveAdjective} backpack down before climbing. ` +
        `The next time ${target.snapshot.name} disappears into a tree, ${actor.snapshot.name} steals the contents of the bag and replaces the useful items with rocks.`,
      changes: [
        ...createInventoryTransferChanges(target, actor),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const RETURN_TO_SENDER: EventDefinition = {
  id: "high-brains-return-to-sender",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.8,
  tags: ["fatal", "combat", "ambush", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
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
        `${actor.snapshot.name} notices an obvious trap with a stick poking out of the ground as a marker. ` +
        `${actor.snapshot.name} removes the stick without disturbing the suspicious pile of leaves and places it several metres past the trap. ` +
        `When ${target.snapshot.name} returns to inspect ${targetPronouns.possessiveAdjective} work, ${targetPronouns.subject} falls into ${targetPronouns.possessiveAdjective} own pit and is impaled on the sharpened stakes.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-brains-return-to-sender",
          "Killed by a redirected trap",
          `${target.snapshot.name} is killed by a trap redirected by ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const FALSE_CONFIDENCE: EventDefinition = {
  id: "high-brains-false-confidence",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.85,
  tags: ["fatal", "combat", "weapon", "item"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(6, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
      requiredItemDefinitionIds: MELEE_WEAPON_IDS,
      itemAccess: "owned",
      requiredItemRequireUsable: false,
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      requiredItemDefinitionIds: MELEE_WEAPON_IDS,
      itemAccess: "owned",
      requiredItemRequireUsable: false,
      opposesRoleIds: ["actor"],
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const actorWeapon = requireSelectedItem(context, "actor");
    const targetWeapon = requireSelectedItem(context, "target");

    return {
      text:
        `${actor.snapshot.name} deliberately leaves an opening in ${actorPronouns.possessiveAdjective} defence while fighting ${target.snapshot.name}. ` +
        `${target.snapshot.name} lunges exactly where expected, overextends, and drives ${targetPronouns.possessiveAdjective} ${getLowercaseItemLabel(targetWeapon)} into the tree behind ${actor.snapshot.name}. ` +
        `${actor.snapshot.name} finishes the fight with ${actorPronouns.possessiveAdjective} ${getLowercaseItemLabel(actorWeapon)} before ${target.snapshot.name} can pull the weapon free.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-brains-false-confidence",
          "Killed after overextending",
          `${target.snapshot.name} is outmanoeuvred and killed by ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const LOAD_BEARING_TRIBUTE: EventDefinition = {
  id: "high-brains-load-bearing-tribute",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.7,
  tags: ["fatal", "combat", "ambush", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
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
        `${actor.snapshot.name} comes across ${target.snapshot.name} resting at camp. ` +
        `${actorPronouns.Subject} identifies the single branch supporting the crude shelter and, with one well-placed cut, brings the entire structure down, burying ${target.snapshot.name} beneath the wreckage.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-brains-load-bearing-tribute",
          "Crushed beneath a sabotaged shelter",
          `${target.snapshot.name} is crushed when ${actor.snapshot.name} sabotages the shelter.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const DELAYED_REACTION: EventDefinition = {
  id: "high-brains-delayed-reaction",
  category: "fatal",
  periods: ["day", "night"],
  baseWeight: 0.9,
  tags: ["fatal", "combat", "ambush", "item", "status"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(6, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
      requiredItemDefinitionIds: ["poison-vial"],
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
    const poison = requireSelectedItem(context, "actor");
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${actor.snapshot.name} waits until ${target.snapshot.name} leaves camp before coating the edges of ${targetPronouns.possessiveAdjective} supplies with poison. ` +
        `By the time ${target.snapshot.name} realizes something is wrong, ${actor.snapshot.name} is already far away.`,
      changes: [
        createItemUseChange(actor, poison, context.eventId),
        ...createFatalChanges(
          target,
          "high-brains-delayed-reaction",
          "Killed by poisoned supplies",
          `${target.snapshot.name} is poisoned by supplies tampered with by ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const DOSE_MAKES_THE_POISON: EventDefinition = {
  id: "high-brains-dose-makes-the-poison",
  category: "survival",
  periods: ["day", "night"],
  baseWeight: 12,
  tags: ["survival", "status"],
  selectionProfile: statSelectionProfile(7, ["status-requirement"]),
  recoveryProfile: {
    targets: [
      {
        kind: "status",
        roleId: "actor",
        statusIds: ["poisoned"],
      },
    ],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isHighBrains(tribute) && hasStatus(tribute, "poisoned"),
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");

    return {
      text:
        `${actor.snapshot.name} recognizes the symptoms of poisoning and immediately induces vomiting, drinks water, and rests before the toxin can spread further. ` +
        `It is deeply unpleasant but significantly preferable to dying.`,
      changes: [...createRemoveStatusChanges(actor, "poisoned"), ...createSurvivalChanges([actor])],
    };
  },
};

export const HIGH_BRAINS_EVENTS = [
  SICK_BUT_SMART,
  FIELD_GUIDE,
  CLEAN_ENOUGH,
  TRAIL_MARKER,
  WRONG_FOOTPRINTS,
  CAMP_INSPECTION,
  LEAD_A_HORSE_TO_WATER,
  UNATTENDED_BAGGAGE,
  RETURN_TO_SENDER,
  FALSE_CONFIDENCE,
  LOAD_BEARING_TRIBUTE,
  DELAYED_REACTION,
  DOSE_MAKES_THE_POISON,
] satisfies readonly EventDefinition[];
