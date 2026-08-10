import {
  createAttemptedKillChange,
  createEliminationChange,
  createFatalChanges,
  createItemUseChange,
  createKillCreditChange,
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
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameChange, GameTribute } from "~/game/types/game-state";

import {
  MELEE_WEAPON_IDS,
  TRUCE_EVENT_SIZES,
  createFatalWithoutLoot,
  getActiveTruceOfSize,
  getLowercaseItemLabel,
  getParticipantShapeForSize,
  hasStatus,
  isHighBrains,
  isLowBrains,
  requireSelectedItem,
  statSelectionProfile,
  type TruceEventSize,
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

function getTruceEventBaseWeight(baseWeight: number, size: TruceEventSize): number {
  return size === 2 || size === 3 ? baseWeight : baseWeight / size;
}

function createHighBrainsTruceMemberRoles(
  size: TruceEventSize,
): readonly ParticipantRoleDefinition[] {
  return [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isHighBrains(tribute) && getActiveTruceOfSize(state, tribute.id, size) !== null,
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
          {
            kind: "truce",
            roleId: "actor",
            truceKind: "standard",
            exactSize: size,
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

function getSelectedOwnedWeapon(
  actor: GameTribute,
  context: Parameters<NonNullable<EventDefinition["resolve"]>>[0],
): ReturnType<typeof requireSelectedItem> {
  const weapon = requireSelectedItem(context, "actor");

  if (!actor.inventory.some((item) => item.id === weapon.id)) {
    throw new Error(
      `High-Brains event "${context.eventId}" selected a weapon not owned by ${actor.id}.`,
    );
  }

  return weapon;
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
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "status",
            roleId: "actor",
            statusId: "poisoned",
            present: true,
          },
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
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
            stat: "brains",
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
            stat: "brains",
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
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "gte",
            threshold: 4,
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
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "gte",
            threshold: 4,
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
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
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
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "status-any",
            roleId: "actor",
            alternatives: [
              {
                statusId: "alert",
                present: true,
              },
              {
                statusId: "hidden",
                present: true,
              },
            ],
          },
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
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
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
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
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
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
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
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
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
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
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
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
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "status",
            roleId: "actor",
            statusId: "poisoned",
            present: true,
          },
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
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
        `${actor.snapshot.name} recognizes the symptoms of poisoning and immediately induces vomiting, drinks water, and rests before the toxin can spread further. ` +
        `It is deeply unpleasant but significantly preferable to dying.`,
      changes: [...createRemoveStatusChanges(actor, "poisoned"), ...createSurvivalChanges([actor])],
    };
  },
};

const EFFICIENT_SHELTER: EventDefinition = {
  id: "high-brains-efficient-shelter",
  category: "survival",
  periods: ["night"],
  baseWeight: 1.7,
  tags: ["survival", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
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

    return {
      text:
        `${actor.snapshot.name} builds a small shelter against a natural rock wall, using the terrain to provide most of the structure. ` +
        `It is not impressive to look at, but unlike several nearby trees, it is unlikely to collapse during the night.`,
      changes: [
        ...createNightRestChanges([actor], round, "sheltered"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const ALARM_SYSTEM: EventDefinition = {
  id: "high-brains-alarm-system",
  category: "survival",
  periods: ["night"],
  baseWeight: 1.7,
  tags: ["survival", "environment", "status"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "gte",
            threshold: 4,
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
        `${actor.snapshot.name} surrounds ${pronouns.possessiveAdjective} camp with strings tied to loose stones and scraps of metal. ` +
        `When something approaches during the night, the resulting clatter wakes ${pronouns.object} long before it reaches the shelter.`,
      changes: [
        ...createNightRestChanges([actor], round, "sheltered"),
        createStatusChange(eventId, actor, "alert", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

function createSleepSchedule(size: TruceEventSize): EventDefinition {
  return {
    id: `high-brains-sleep-schedule-${size}`,
    category: "survival",
    periods: ["night"],
    baseWeight: getTruceEventBaseWeight(1.7, size),
    tags: ["survival", "truce", "cooperative"],
    participantShape: getParticipantShapeForSize(size),
    selectionProfile: statSelectionProfile(4, ["truce-requirement"]),
    roles: createHighBrainsTruceMemberRoles(size),
    resolve({ round, participantsByRole }) {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const members = requireParticipants(participantsByRole, "members");
      const allMembers = [actor, ...members];

      if (members.length !== size - 1) {
        throw new Error(`Sleep Schedule expected ${size - 1} truce mates.`);
      }

      return {
        text:
          `${actor.snapshot.name} organizes the truce into overlapping watch shifts, ensuring everyone receives enough sleep without leaving the camp unguarded. ` +
          `It is disappointingly sensible and works exactly as intended.`,
        changes: [
          ...createNightRestChanges(allMembers, round, "sheltered"),
          ...createSurvivalChanges(allMembers),
        ],
      };
    },
  };
}

function createDivisionOfLabour(size: TruceEventSize): EventDefinition {
  return {
    id: `high-brains-division-of-labour-${size}`,
    category: "survival",
    periods: ["day"],
    baseWeight: getTruceEventBaseWeight(1.55, size),
    tags: ["survival", "truce", "cooperative", "deprivation", "status"],
    participantShape: getParticipantShapeForSize(size),
    selectionProfile: statSelectionProfile(5, ["truce-requirement", "deprivation-requirement"]),
    roles: createHighBrainsTruceMemberRoles(size),
    resolve({ eventId, round, participantsByRole }) {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const members = requireParticipants(participantsByRole, "members");
      const allMembers = [actor, ...members];
      const pronouns = getTributePronouns(actor);

      if (members.length !== size - 1) {
        throw new Error(`Division of Labour expected ${size - 1} truce mates.`);
      }

      /*
       * This is authored as a Day event, so the engine cannot record Night
       * rest here. The completed shelter work is represented by well-rested,
       * while food and water use their normal survival-need changes.
       */
      return {
        text:
          `${actor.snapshot.name} takes charge of the group and assigns jobs based on what they are least likely to ruin. ` +
          `By evening, everyone has food, water, shelter, and only a small amount of resentment toward ${pronouns.object}.`,
        changes: [
          ...allMembers.flatMap((member) => [
            createSatisfyNeedChange(member, "food"),
            createSatisfyNeedChange(member, "water"),
            createStatusChange(eventId, member, "well-rested", 1, round),
          ]),
          ...createSurvivalChanges(allMembers),
        ],
      };
    },
  };
}

const USEFUL_IDIOT: EventDefinition = {
  id: "high-brains-useful-idiot",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.7,
  tags: ["fatal", "combat", "truce", "item", "ambush"],
  participantShape: "trio",
  selectionProfile: statSelectionProfile(7, [
    "truce-requirement",
    "item-requirement",
    "custom-eligibility",
  ]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isHighBrains(tribute) && getActiveTruceOfSize(state, tribute.id, 2) !== null,
      auditEligibility: {
        coverage: "opaque",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
      opposesRoleIds: ["target"],
    },
    {
      id: "trucemate",
      count: 1,
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];

        if (!actor || tribute.snapshot.stats.brains > 3) {
          return false;
        }

        return getActiveTruceOfSize(state, actor.id, 2)?.tributeIds.includes(tribute.id) ?? false;
      },
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];

        if (!actor) {
          return false;
        }

        const truce = getActiveTruceOfSize(state, actor.id, 2);

        return !(truce?.tributeIds.includes(tribute.id) ?? false);
      },
      opposesRoleIds: ["actor", "trucemate"],
    },
  ],
  resolve({ state, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const trucemate = requireSingleParticipant(participantsByRole, "trucemate");
    const target = requireSingleParticipant(participantsByRole, "target");
    const truce = getActiveTruceOfSize(state, actor.id, 2);
    const actorPronouns = getTributePronouns(actor);

    if (!truce) {
      throw new Error("Useful Idiot expected an active two-person truce.");
    }

    return {
      text:
        `${actor.snapshot.name} convinces ${trucemate.snapshot.name} to walk ahead of ${actorPronouns.object} through the clearing. ` +
        `When ${trucemate.snapshot.name} gets caught in a makeshift net, ${actor.snapshot.name} grabs the trapped tribute's supplies and runs away unharmed before ${target.snapshot.name} arrives and finishes the job.`,
      changes: [
        ...createInventoryTransferChanges(trucemate, actor, "truce-betrayal-theft"),
        ...createFatalWithoutLoot(
          trucemate,
          target,
          "high-brains-useful-idiot",
          "Killed after being used as bait",
          `${trucemate.snapshot.name} is used as bait by ${actor.snapshot.name} and killed by ${target.snapshot.name}.`,
        ),
        {
          type: "break-truce",
          truceId: truce.id,
          reason: "betrayal",
        },
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

function createHostileTakeover(size: Exclude<TruceEventSize, 2>): EventDefinition {
  return {
    id: `high-brains-hostile-takeover-${size}`,
    category: "fatal",
    periods: ["day", "night"],
    baseWeight: getTruceEventBaseWeight(0.55, size),
    tags: ["fatal", "combat", "truce", "item", "ambush"],
    participantShape: getParticipantShapeForSize(size),
    selectionProfile: statSelectionProfile(6, ["truce-requirement"]),
    roles: createHighBrainsTruceMemberRoles(size),
    resolve({ state, participantsByRole }) {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const members = requireParticipants(participantsByRole, "members");
      const truce = getActiveTruceOfSize(state, actor.id, size);
      const pronouns = getTributePronouns(actor);

      if (!truce || members.length !== size - 1) {
        throw new Error(`Hostile Takeover expected an active ${size}-person truce.`);
      }

      return {
        text:
          `${actor.snapshot.name} quietly convinces each member of the truce that everyone else is planning a betrayal. ` +
          `Before long, the group has torn itself apart while ${pronouns.subject} watches from a safe distance and collects whatever remains.`,
        changes: [
          ...members.flatMap((member) =>
            createFatalChanges(
              member,
              "high-brains-hostile-takeover",
              "Killed during a manipulated truce collapse",
              `${member.snapshot.name} is killed after ${actor.snapshot.name} manipulates the truce into turning on itself.`,
              actor,
            ),
          ),
          {
            type: "break-truce",
            truceId: truce.id,
            reason: "betrayal",
          },
          ...createSurvivalChanges([actor]),
        ],
      };
    },
  };
}

const FAKE_WEAKNESS: EventDefinition = {
  id: "high-brains-fake-weakness",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.8,
  tags: ["fatal", "combat", "weapon", "item", "ambush"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
      requiredItemDefinitionIds: MELEE_WEAPON_IDS,
      itemAccess: "owned",
      requiredItemRequireUsable: false,
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
    const targetPronouns = getTributePronouns(target);
    const weapon = getSelectedOwnedWeapon(actor, context);

    return {
      text:
        `${actor.snapshot.name} deliberately stumbles and begins limping, tempting ${target.snapshot.name} to rush forward for an easy kill. ` +
        `When ${targetPronouns.subject} gets close enough, ${actor.snapshot.name} drives a hidden ${getLowercaseItemLabel(weapon)} into ${targetPronouns.possessiveAdjective} chest.`,
      changes: [
        ...createFatalChanges(
          target,
          "high-brains-fake-weakness",
          "Killed by a feigned weakness",
          `${target.snapshot.name} is lured into an ambush and killed by ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const OVERTHINKING: EventDefinition = {
  id: "high-brains-overthinking",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.3,
  tags: ["hazard", "status"],
  selectionProfile: statSelectionProfile(3),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brains === 5,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "eq",
            threshold: 5,
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
        `${actor.snapshot.name} notices several possible routes through the arena and spends hours comparing their risks, resources, visibility, terrain, and long-term strategic value. ` +
        `By the time ${pronouns.subject} makes a decision, the sun is already beginning to set and ${pronouns.subject} is exhausted from the effort.`,
      changes: [
        createStatusChange(eventId, actor, "exhausted", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const PERFECT_PLAN: EventDefinition = {
  id: "high-brains-perfect-plan",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.45,
  tags: ["fatal", "environment"],
  selectionProfile: statSelectionProfile(3),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brains === 5,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
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
        `${actor.snapshot.name} decides to create the perfect trap, ending up with an elaborate monstrosity involving counterweights, sharpened stakes, and a carefully concealed trigger. ` +
        `When attempting to test the system, ${actor.snapshot.name} triggers it and launches a spiked log directly into ${pronouns.possessiveAdjective} chest.`,
      changes: createFatalChanges(
        actor,
        "high-brains-perfect-plan",
        "Killed while testing an elaborate trap",
        `${actor.snapshot.name} is killed by ${pronouns.possessiveAdjective} own elaborate trap.`,
      ),
    };
  },
};

const OCCUPATIONAL_HAZARD: EventDefinition = {
  id: "high-brains-occupational-hazard",
  category: "hazard",
  periods: ["day", "night"],
  baseWeight: 1.2,
  tags: ["hazard", "weapon", "item", "status"],
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "gte",
            threshold: 4,
            valueSource: "base",
          },
        ],
      },
      requiredItemTags: ["weapon"],
      itemAccess: "owned",
      requiredItemRequireUsable: false,
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const weapon = getSelectedOwnedWeapon(actor, context);

    return {
      text:
        `${actor.snapshot.name} carefully prepares a poisoned ${getLowercaseItemLabel(weapon)}, having chosen berries that are both toxic and unlikely to dry on the blade. ` +
        `Unfortunately, ${pronouns.subject} is not as graceful as ${pronouns.subject} is smart and scratches ${pronouns.possessiveAdjective} hand on the weapon.`,
      changes: [
        createStatusChange(context.eventId, actor, "poisoned", 1, context.round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const SEEMS_SUSPICIOUS: EventDefinition = {
  id: "high-brains-seems-suspicious",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.4,
  tags: ["hazard", "deprivation", "resource"],
  selectionProfile: statSelectionProfile(5, ["status-requirement", "deprivation-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isHighBrains(tribute) && hasStatus(tribute, "hungry"),
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
            stat: "brains",
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
        `${actor.snapshot.name} finds a patch of perfectly ordinary edible berries but becomes convinced their convenient location must be part of an elaborate trap. ` +
        `${pronouns.Subject} watches them from behind a tree until birds eat every berry, leaving ${pronouns.object} just as hungry as before.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const TOO_CLEAN: EventDefinition = {
  id: "high-brains-too-clean",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.4,
  tags: ["hazard", "deprivation", "resource"],
  selectionProfile: statSelectionProfile(5, ["status-requirement", "deprivation-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isHighBrains(tribute) && hasStatus(tribute, "thirsty"),
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
            stat: "brains",
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
        `${actor.snapshot.name} discovers a clear freshwater spring and immediately becomes suspicious of how safe it appears. ` +
        `After considering poison, parasites, hidden pressure plates, and several increasingly unlikely Capitol schemes, ${pronouns.subject} decides dehydration is the more predictable threat and walks away.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const I_CAN_FIX_IT: EventDefinition = {
  id: "high-brains-i-can-fix-it",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.1,
  tags: ["hazard", "weapon", "item"],
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brains === 5,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "eq",
            threshold: 5,
            valueSource: "base",
          },
        ],
      },
      requiredItemTags: ["weapon"],
      itemAccess: "owned",
      requiredItemRequireUsable: false,
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const weapon = getSelectedOwnedWeapon(actor, context);

    return {
      text:
        `${actor.snapshot.name} notices a tiny imperfection in ${pronouns.possessiveAdjective} ${getLowercaseItemLabel(weapon)} and takes it apart to improve the design. ` +
        `Several hours and fourteen carefully arranged pieces later, ${pronouns.subject} realizes knowing how something works is not the same as knowing how to put it back together.`,
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

const TRAP_ENTHUSIAST: EventDefinition = {
  id: "high-brains-trap-enthusiast",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.45,
  tags: ["fatal", "environment"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
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
        `${actor.snapshot.name} surrounds ${pronouns.possessiveAdjective} camp with an intricate network of snares, tripwires, pits, and counterweights. ` +
        `When ${pronouns.subject} tries to leave, ${pronouns.subject} forgets the safe route and falls directly into a spike-filled pit.`,
      changes: createFatalChanges(
        actor,
        "high-brains-trap-enthusiast",
        "Killed by their own trap network",
        `${actor.snapshot.name} is killed by ${pronouns.possessiveAdjective} own trap network.`,
      ),
    };
  },
};

const JUST_ONE_MORE_ADJUSTMENT: EventDefinition = {
  id: "high-brains-just-one-more-adjustment",
  category: "hazard",
  periods: ["day", "night"],
  baseWeight: 1.2,
  tags: ["hazard", "environment", "status"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "gte",
            threshold: 4,
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
        `${actor.snapshot.name} completes an effective trap before deciding it could be slightly more efficient. ` +
        `After several unnecessary improvements, the mechanism collapses, destroys itself, and strikes ${pronouns.object} in the face with a loose branch.`,
      changes: [
        createStatusChange(eventId, actor, "injured", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const REST_IS_INEFFICIENT: EventDefinition = {
  id: "high-brains-rest-is-inefficient",
  category: "hazard",
  periods: ["night"],
  baseWeight: 1.5,
  tags: ["hazard", "status"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
            comparison: "gte",
            threshold: 4,
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
        `${actor.snapshot.name} lies awake calculating tomorrow's route, possible betrayals, food requirements, weather patterns, weapon matchups, and the statistical likelihood that ${pronouns.subject} forgot something important. ` +
        `By sunrise, ${pronouns.subject} has developed an excellent plan and absolutely no energy to carry it out.`,
      changes: [
        ...createNightRestChanges([actor], round, "unsheltered"),
        createStatusChange(eventId, actor, "exhausted", 1, round),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const TOO_CLEVER_BY_HALF: EventDefinition = {
  id: "high-brains-too-clever-by-half",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.65,
  tags: ["fatal", "combat", "ambush"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
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
      isEligible: isLowBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "target",
            stat: "brains",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");

    return {
      text:
        `${actor.snapshot.name} constructs an elaborate deception involving false tracks, staged supplies, and several carefully planted clues. ` +
        `${target.snapshot.name} ignores every clue, wanders in from the wrong direction, and catches ${actor.snapshot.name} crouched behind a bush, making them easy prey.`,
      changes: [
        ...createFatalChanges(
          actor,
          "high-brains-too-clever-by-half",
          "Killed when an elaborate deception failed",
          `${actor.snapshot.name} is killed by ${target.snapshot.name} after an elaborate deception fails.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const PREDICTABLY_UNPREDICTABLE: EventDefinition = {
  id: "high-brains-predictably-unpredictable",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.45,
  tags: ["fatal", "combat", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(5),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brains === 5,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "actor",
            stat: "brains",
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
      isEligible: isLowBrains,
      auditEligibility: {
        coverage: "complete",
        prerequisites: [
          {
            kind: "stat",
            roleId: "target",
            stat: "brains",
            comparison: "lte",
            threshold: 2,
            valueSource: "base",
          },
        ],
      },
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} anticipates every logical move ${target.snapshot.name} could possibly make and positions ${actorPronouns.reflexive} accordingly. ` +
        `${target.snapshot.name}, operating without the burden of logic, does something so profoundly stupid that ${actor.snapshot.name} is struck by a falling branch and killed before either tribute understands what happened.`,
      changes: [
        ...createFatalChanges(
          actor,
          "high-brains-predictably-unpredictable",
          "Killed by an accidentally dislodged branch",
          `${actor.snapshot.name} is accidentally killed by ${target.snapshot.name}'s unpredictable mistake.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const HIGH_BRAINS_SLEEP_SCHEDULE_EVENTS = TRUCE_EVENT_SIZES.map(createSleepSchedule);

const HIGH_BRAINS_DIVISION_OF_LABOUR_EVENTS = TRUCE_EVENT_SIZES.map(createDivisionOfLabour);

const HIGH_BRAINS_HOSTILE_TAKEOVER_EVENTS = ([3, 4, 5, 6] as const).map(createHostileTakeover);

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
  EFFICIENT_SHELTER,
  ALARM_SYSTEM,
  ...HIGH_BRAINS_SLEEP_SCHEDULE_EVENTS,
  ...HIGH_BRAINS_DIVISION_OF_LABOUR_EVENTS,
  USEFUL_IDIOT,
  ...HIGH_BRAINS_HOSTILE_TAKEOVER_EVENTS,
  FAKE_WEAKNESS,
  OVERTHINKING,
  PERFECT_PLAN,
  OCCUPATIONAL_HAZARD,
  SEEMS_SUSPICIOUS,
  TOO_CLEAN,
  I_CAN_FIX_IT,
  TRAP_ENTHUSIAST,
  JUST_ONE_MORE_ADJUSTMENT,
  REST_IS_INEFFICIENT,
  TOO_CLEVER_BY_HALF,
  PREDICTABLY_UNPREDICTABLE,
] satisfies readonly EventDefinition[];
