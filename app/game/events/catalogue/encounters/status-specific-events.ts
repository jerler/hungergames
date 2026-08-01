import { getEffectiveStats } from "~/game/engine/effective-stats";
import {
  getAwarenessScore,
  getCombatScore,
  getForagingScore,
  getSurvivalScore,
} from "~/game/engine/stat-formulas";
import {
  createAttemptedKillChange,
  createEliminationChange,
  createFatalChanges,
  createKillCreditChange,
  createNightRestChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import {
  resolveScoreCheck,
  type StatCheckOutcome,
  type StatCheckDifficulty,
} from "~/game/events/event-outcomes";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
  type EventSelectionProfile,
  type EventSpecificityReason,
  type ParticipantRoleDefinition,
} from "~/game/events/event-schema";
import { compileItemUseEffects } from "~/game/items/item-effect-engine";
import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { isItemUsableBy } from "~/game/items/item-usability";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import {
  areTributesInSameTruce,
  getActiveTruceForTribute,
  getLivingTruceMembers,
} from "~/game/truces/truce-engine";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type {
  GameChange,
  GameState,
  GameTribute,
  InventoryItem,
  Truce,
} from "~/game/types/game-state";

const DEFAULT_DIFFICULTY = 3;

const TRUCE_SIZES = [2, 3, 4, 5, 6] as const;
type TruceSize = (typeof TRUCE_SIZES)[number];

const CAFFEINATED_ITEM_IDS = [
  "coffee",
  "coca-cola",
  "energy-drink",
  "herbal-tea",
] as const satisfies readonly ItemDefinitionId[];

const POISON_TREATMENT_ITEM_IDS = [
  "antidote",
  "med-kit",
] as const satisfies readonly ItemDefinitionId[];

function profile(
  specificityScore: number,
  specificityReasons: readonly EventSpecificityReason[],
): EventSelectionProfile {
  return {
    specificityScore,
    specificityReasons,
  };
}

function getStatusSeverity(tribute: GameTribute, statusId: StatusEffectId): number {
  return tribute.statuses.find((status) => status.definitionId === statusId)?.severity ?? 0;
}

function hasStatus(tribute: GameTribute, statusId: StatusEffectId, minimumSeverity = 1): boolean {
  return getStatusSeverity(tribute, statusId) >= minimumSeverity;
}

function satisfyNeed(tribute: GameTribute, need: "food" | "water"): GameChange {
  return {
    type: "satisfy-survival-need",
    tributeId: tribute.id,
    need,
  };
}

function removeStatusChanges(tribute: GameTribute, statusId: StatusEffectId): GameChange[] {
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

function selectedItem(context: EventResolutionContext, roleId: string): InventoryItem {
  const item = context.itemsByRole?.[roleId]?.[0]?.item;

  if (!item) {
    throw new Error(
      `Status-specific event "${context.eventId}" is missing selected item role "${roleId}".`,
    );
  }

  return item;
}

function itemLabel(item: InventoryItem): string {
  return getItemDefinition(item.definitionId).label.toLowerCase();
}

function transferItem(
  item: InventoryItem,
  from: GameTribute,
  to: GameTribute,
  reason: string,
): GameChange {
  return {
    type: "transfer-item",
    itemInstanceId: item.id,
    fromTributeId: from.id,
    toTributeId: to.id,
    reason,
  };
}

function transferEntireInventory(from: GameTribute, to: GameTribute, reason: string): GameChange[] {
  return from.inventory.map((item) => transferItem(item, from, to, reason));
}

function transferInventories(
  fromTributes: readonly GameTribute[],
  to: GameTribute,
  reason: string,
): GameChange[] {
  return fromTributes.flatMap((tribute) => transferEntireInventory(tribute, to, reason));
}

function splitInventoryRandomly(
  victim: GameTribute,
  recipients: readonly [GameTribute, GameTribute],
  random: EventResolutionContext["random"],
): GameChange[] {
  return victim.inventory.map((item) => {
    const recipient = random() < 0.5 ? recipients[0] : recipients[1];

    return transferItem(item, victim, recipient, "shared-death-loot");
  });
}

function createFatalWithoutLoot(
  victim: GameTribute,
  killer: GameTribute,
  causeId: string,
  causeLabel: string,
  summary: string,
): GameChange[] {
  return [
    createEliminationChange(victim, causeId, causeLabel, summary, [killer.id]),
    createAttemptedKillChange(killer),
    createKillCreditChange(killer),
  ];
}

function createJointFatalWithoutLoot(
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

function createNightRestIfNeeded(
  context: EventResolutionContext,
  tributes: readonly GameTribute[],
  quality: "comfortable" | "sheltered" | "unsheltered",
): GameChange[] {
  return context.round.period === "night"
    ? createNightRestChanges(tributes, context.round, quality)
    : [];
}

function finishForSurvivors(
  context: EventResolutionContext,
  tributes: readonly GameTribute[],
  nightQuality: "comfortable" | "sheltered" | "unsheltered" = "unsheltered",
): GameChange[] {
  return [
    ...createNightRestIfNeeded(context, tributes, nightQuality),
    ...createSurvivalChanges(tributes),
  ];
}

function areNotInSameTruce(state: GameState, first: GameTribute, second: GameTribute): boolean {
  return !areTributesInSameTruce(state, first.id, second.id);
}

function isUntruced(state: GameState, tribute: GameTribute): boolean {
  return getActiveTruceForTribute(state, tribute.id) === null;
}

function findUsableWeapon(
  user: GameTribute,
  inventories: readonly GameTribute[],
): InventoryItem | null {
  for (const owner of inventories) {
    const weapon = owner.inventory.find((item) => {
      const definition = getItemDefinition(item.definitionId);

      return definition.tags.includes("weapon") && isItemUsableBy(user, item);
    });

    if (weapon) {
      return weapon;
    }
  }

  return null;
}

function formatNameList(tributes: readonly GameTribute[]): string {
  const names = tributes.map((tribute) => tribute.snapshot.name);

  if (names.length === 1) {
    return names[0] ?? "The tribute";
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function getStandardTruceOfSize(
  state: GameState,
  tributeId: string,
  size: TruceSize,
): Truce | null {
  const truce = getActiveTruceForTribute(state, tributeId);

  if (truce?.kind !== "standard" || getLivingTruceMembers(state, truce).length !== size) {
    return null;
  }

  return truce;
}

function sameStandardTruceRole(id: string, size: TruceSize): ParticipantRoleDefinition {
  return {
    id,
    count: size,
    isEligible: (tribute, { state, participantsByRole }) => {
      const selected = participantsByRole[id] ?? [];

      if (selected.length === 0) {
        return getStandardTruceOfSize(state, tribute.id, size) !== null;
      }

      const first = selected[0];

      if (!first) {
        return false;
      }

      const truce = getStandardTruceOfSize(state, first.id, size);

      return truce?.tributeIds.includes(tribute.id) ?? false;
    },
  };
}

function resolveOutcome(
  score: number,
  random: EventResolutionContext["random"],
  difficulty: StatCheckDifficulty = DEFAULT_DIFFICULTY,
): StatCheckOutcome {
  return resolveScoreCheck({
    score,
    difficulty,
    random,
  });
}

const EMERGENCY_BARK_BUFFET: EventDefinition = {
  id: "status-emergency-bark-buffet",
  category: "survival",
  periods: ["day"],
  baseWeight: 3,
  tags: ["survival", "status", "deprivation"],
  selectionProfile: profile(3, ["status-requirement", "deprivation-requirement"]),
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
      isEligible: (tribute) => hasStatus(tribute, "hungry", 2),
      getWeight: (tribute) => getStatusSeverity(tribute, "hungry"),
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const outcome = resolveOutcome(getForagingScore(actor), context.random);
    const baseText =
      `${actor.snapshot.name} finally gives in to desperation and peels a strip of bark from a tree, ` +
      `chewing thoughtfully and wishing ${pronouns.subject} had Tabasco sauce.`;

    if (outcome === "critical-failure") {
      return {
        text: baseText,
        changes: [
          createStatusChange(context.eventId, actor, "poisoned", 1, context.round),
          ...createSurvivalChanges([actor]),
        ],
      };
    }

    if (outcome === "failure") {
      return {
        text: baseText,
        changes: createSurvivalChanges([actor]),
      };
    }

    return {
      text: baseText,
      changes: [satisfyNeed(actor, "food"), ...createSurvivalChanges([actor])],
    };
  },
};

const MEAL_WORTH_FOLLOWING: EventDefinition = {
  id: "status-meal-worth-following",
  category: "survival",
  periods: ["day"],
  baseWeight: 3,
  tags: ["survival", "status", "deprivation"],
  selectionProfile: profile(4, [
    "status-requirement",
    "deprivation-requirement",
    "truce-requirement",
  ]),
  recoveryProfile: {
    targets: [
      {
        kind: "survival-need",
        roleId: "actor",
        need: "food",
      },
      {
        kind: "survival-need",
        roleId: "target",
        need: "food",
      },
    ],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => hasStatus(tribute, "hungry"),
      getWeight: (tribute) => getStatusSeverity(tribute, "hungry"),
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];

        return (
          !hasStatus(tribute, "hungry") && (!actor || areNotInSameTruce(state, actor, tribute))
        );
      },
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const outcome = resolveOutcome(
      DEFAULT_DIFFICULTY +
        getAwarenessScore(actor, context.round) -
        getAwarenessScore(target, context.round),
      context.random,
    );

    if (outcome === "critical-failure") {
      return {
        text:
          `${target.snapshot.name} picks a few more berries before noticing ${actor.snapshot.name} and sprinting after ${actorPronouns.object}. ` +
          `${actor.snapshot.name} gets away but feels like ${target.snapshot.name} is still hunting ${actorPronouns.object} for several hours.`,
        changes: [
          createStatusChange(
            context.eventId,
            actor,
            "hunted",
            1,
            context.round,
            undefined,
            target.id,
          ),
          satisfyNeed(target, "food"),
          ...createSurvivalChanges([actor, target]),
        ],
      };
    }

    if (outcome === "failure") {
      return {
        text:
          `${target.snapshot.name} picks berries for hours until, unfortunately, no berries remain on the bush. ` +
          `${actor.snapshot.name} finally leaves, dejected.`,
        changes: [satisfyNeed(target, "food"), ...createSurvivalChanges([actor, target])],
      };
    }

    return {
      text:
        `After several minutes, ${target.snapshot.name} walks away with a full bag of berries, ` +
        `giving ${actor.snapshot.name} an opening to grab a meal for ${actorPronouns.reflexive}.`,
      changes: [
        satisfyNeed(target, "food"),
        satisfyNeed(actor, "food"),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const LAST_EDIBLE_THING: EventDefinition = {
  id: "status-last-edible-thing",
  category: "fatal",
  periods: ["day"],
  baseWeight: 2,
  tags: ["fatal", "combat", "status", "deprivation", "resource"],
  selectionProfile: profile(4, [
    "status-requirement",
    "deprivation-requirement",
    "truce-requirement",
  ]),
  participantShape: "trio",
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => hasStatus(tribute, "hungry"),
      getWeight: (tribute) => getStatusSeverity(tribute, "hungry"),
    },
    {
      id: "target",
      count: 1,
      opposesRoleIds: ["actor"],
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];

        return hasStatus(tribute, "hungry") && (!actor || areNotInSameTruce(state, actor, tribute));
      },
      getWeight: (tribute) => getStatusSeverity(tribute, "hungry"),
    },
    {
      id: "bystander",
      count: 1,
      opposesRoleIds: ["actor", "target"],
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];
        const target = participantsByRole.target?.[0];

        return (
          (!actor || areNotInSameTruce(state, actor, tribute)) &&
          (!target || areNotInSameTruce(state, target, tribute))
        );
      },
      getWeight: (tribute) => 1 + getStatusSeverity(tribute, "hungry"),
    },
  ],
  isEligible: ({ state, livingTributes }) => {
    const hungryTributes = livingTributes.filter((tribute) => hasStatus(tribute, "hungry"));

    return hungryTributes.some((actor, actorIndex) =>
      hungryTributes.some(
        (target, targetIndex) =>
          actorIndex !== targetIndex &&
          areNotInSameTruce(state, actor, target) &&
          livingTributes.some(
            (bystander) =>
              bystander.id !== actor.id &&
              bystander.id !== target.id &&
              areNotInSameTruce(state, actor, bystander) &&
              areNotInSameTruce(state, target, bystander),
          ),
      ),
    );
  },
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const bystander = requireSingleParticipant(context.participantsByRole, "bystander");

    const score =
      [actor, target, bystander].reduce((sum, tribute) => {
        const { brains, luck } = getEffectiveStats(tribute);

        return sum + Math.max(brains, luck);
      }, 0) / 3;
    const outcome = resolveOutcome(score, context.random);

    if (outcome === "critical-failure") {
      return {
        text:
          `${target.snapshot.name} and ${bystander.snapshot.name} lunge at ${actor.snapshot.name}, ` +
          `ending with only ${bystander.snapshot.name} left standing, victoriously munching on a carrot.`,
        changes: [
          ...createFatalChanges(
            actor,
            "last-edible-thing",
            "Killed over food",
            `${actor.snapshot.name} is killed in a fight over the arena's last carrot.`,
            bystander,
          ),
          ...createFatalChanges(
            target,
            "last-edible-thing",
            "Killed over food",
            `${target.snapshot.name} is killed in a fight over the arena's last carrot.`,
            bystander,
          ),
          satisfyNeed(bystander, "food"),
          ...createSurvivalChanges([bystander]),
        ],
      };
    }

    if (outcome === "failure") {
      return {
        text:
          `${target.snapshot.name} and ${bystander.snapshot.name} lunge at ${actor.snapshot.name}, ` +
          `ending with ${actor.snapshot.name} lifeless on the ground and the carrot split evenly between the victors.`,
        changes: [
          ...createJointFatalWithoutLoot(
            actor,
            [target, bystander],
            "last-edible-thing",
            "Killed over food",
            `${actor.snapshot.name} is killed by ${target.snapshot.name} and ${bystander.snapshot.name} over a carrot.`,
          ),
          ...splitInventoryRandomly(actor, [target, bystander], context.random),
          satisfyNeed(target, "food"),
          satisfyNeed(bystander, "food"),
          ...createSurvivalChanges([target, bystander]),
        ],
      };
    }

    if (outcome === "success") {
      return {
        text: `${actor.snapshot.name} takes off running, finally getting to enjoy a quick lunch.`,
        changes: [satisfyNeed(actor, "food"), ...createSurvivalChanges([actor, target, bystander])],
      };
    }

    return {
      text:
        `${actor.snapshot.name} drops the carrot, not looking for a fight. ` +
        `${bystander.snapshot.name} and ${target.snapshot.name} bring out their basket of food, ` +
        `inviting ${actor.snapshot.name} to eat with them before separating back into the woods.`,
      changes: [
        createStatusChange(context.eventId, actor, "well-fed", 1, context.round),
        createStatusChange(context.eventId, target, "well-fed", 1, context.round),
        createStatusChange(context.eventId, bystander, "well-fed", 1, context.round),
        ...createSurvivalChanges([actor, target, bystander]),
      ],
    };
  },
};

function createRationingEvent(size: TruceSize): EventDefinition {
  return {
    id: `status-rationing-becomes-personal-${size}`,
    category: "survival",
    periods: ["day", "night"],
    baseWeight: 4 / size,
    tags: ["survival", "status", "deprivation", "truce", "cooperative"],
    selectionProfile: profile(5, [
      "status-requirement",
      "deprivation-requirement",
      "truce-requirement",
      "item-requirement",
    ]),
    participantShape: size === 2 ? "pair" : size === 3 ? "trio" : "group-four-plus",
    recoveryProfile: {
      targets: [
        {
          kind: "survival-need",
          roleId: "members",
          need: "food",
        },
      ],
    },
    roles: [sameStandardTruceRole("members", size)],
    isEligible: ({ state }) =>
      state.truces.some((truce) => {
        if (truce.kind !== "standard") {
          return false;
        }

        const members = getLivingTruceMembers(state, truce);

        return (
          members.length === size &&
          members.some((member) => hasStatus(member, "hungry")) &&
          members.some((member) =>
            member.inventory.some((item) => item.definitionId === "cornucopia-provisions"),
          )
        );
      }),
    resolve(context): EventResolution {
      const members = requireParticipants(context.participantsByRole, "members");

      if (members.length !== size) {
        throw new Error(`Rationing event expected ${size} truce members.`);
      }

      const hungryMembers = members.filter((member) => hasStatus(member, "hungry"));

      return {
        text: `${formatNameList(members)} rest and divide rations evenly amongst the group.`,
        changes: [
          ...hungryMembers.map((member) => satisfyNeed(member, "food")),
          ...finishForSurvivors(context, members, "sheltered"),
        ],
      };
    },
  };
}

const MUDDY_MIRACLE: EventDefinition = {
  id: "status-muddy-miracle",
  category: "survival",
  periods: ["day"],
  baseWeight: 3,
  tags: ["survival", "status", "deprivation"],
  selectionProfile: profile(3, ["status-requirement", "deprivation-requirement"]),
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
      isEligible: (tribute) => hasStatus(tribute, "thirsty", 2),
      getWeight: (tribute) => getStatusSeverity(tribute, "thirsty"),
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const outcome = resolveOutcome(getSurvivalScore(actor), context.random);
    const changes: GameChange[] = [satisfyNeed(actor, "water")];

    if (outcome === "critical-failure" || outcome === "failure") {
      changes.push(createStatusChange(context.eventId, actor, "poisoned", 1, context.round));
    }

    changes.push(...createSurvivalChanges([actor]));

    return {
      text:
        `${actor.snapshot.name} finds a puddle and slurps it up, ` +
        `gritting ${pronouns.possessiveAdjective} teeth through the bitter aftertaste.`,
      changes,
    };
  },
};

const SOMEONE_ELSE_FOUND_WATER_FIRST: EventDefinition = {
  id: "status-someone-else-found-water-first",
  category: "fatal",
  periods: ["day"],
  baseWeight: 2,
  tags: ["fatal", "combat", "status", "deprivation", "ambush"],
  selectionProfile: profile(4, [
    "status-requirement",
    "deprivation-requirement",
    "truce-requirement",
  ]),
  participantShape: "pair",
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => hasStatus(tribute, "thirsty"),
      getWeight: (tribute) => getStatusSeverity(tribute, "thirsty"),
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];

        return !actor || areNotInSameTruce(state, actor, tribute);
      },
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const score = Math.max(getCombatScore(actor), getEffectiveStats(actor).brains);
    const outcome = resolveOutcome(score, context.random);

    if (outcome === "critical-failure") {
      return {
        text:
          `${actor.snapshot.name} sets out looking for water and comes across a sparkling stream. ` +
          `Kneeling down, ${actorPronouns.subject} screams as ${target.snapshot.name} emerges from the water and pulls ${actorPronouns.object} below the surface. ` +
          `It only takes a moment before ${actor.snapshot.name} stops twitching.`,
        changes: [
          ...createFatalChanges(
            actor,
            "drowned-at-stream",
            "Drowned",
            `${actor.snapshot.name} is dragged beneath the stream and drowned by ${target.snapshot.name}.`,
            target,
          ),
          satisfyNeed(target, "water"),
          ...createSurvivalChanges([target]),
        ],
      };
    }

    if (outcome === "failure") {
      return {
        text: `${actor.snapshot.name} wrestles ${actorPronouns.reflexive} free and takes off, only a little worse for wear.`,
        changes: [
          createStatusChange(
            context.eventId,
            actor,
            "injured",
            1,
            context.round,
            undefined,
            target.id,
          ),
          ...createSurvivalChanges([actor, target]),
        ],
      };
    }

    if (outcome === "success") {
      return {
        text:
          `${actor.snapshot.name} wrestles ${actorPronouns.reflexive} free and takes off, only a little worse for wear. ` +
          `At least ${actorPronouns.subject} gulped several crisp mouthfuls of spring water before escaping.`,
        changes: [
          satisfyNeed(actor, "water"),
          createStatusChange(
            context.eventId,
            actor,
            "injured",
            1,
            context.round,
            undefined,
            target.id,
          ),
          ...createSurvivalChanges([actor, target]),
        ],
      };
    }

    return {
      text:
        `${actor.snapshot.name} pulls ${actorPronouns.reflexive} back out and keeps ${target.snapshot.name} pushed under ` +
        `until finally ${target.snapshot.name} stops fighting back.`,
      changes: [
        satisfyNeed(actor, "water"),
        ...createFatalChanges(
          target,
          "drowned-at-stream",
          "Drowned",
          `${target.snapshot.name} is held beneath the stream and drowned by ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const THREE_STRAWS_NO_CUP: EventDefinition = {
  id: "status-three-straws-no-cup",
  category: "hazard",
  periods: ["day"],
  baseWeight: 6,
  tags: ["hazard", "status", "deprivation", "cooperative"],
  selectionProfile: profile(4, [
    "status-requirement",
    "deprivation-requirement",
    "truce-requirement",
  ]),
  participantShape: "trio",
  recoveryProfile: {
    targets: [
      {
        kind: "survival-need",
        roleId: "actor",
        need: "water",
      },
      {
        kind: "survival-need",
        roleId: "others",
        need: "water",
      },
    ],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isUntruced(state, tribute) && hasStatus(tribute, "thirsty"),
      getWeight: (tribute) => getStatusSeverity(tribute, "thirsty"),
    },
    {
      id: "others",
      count: 2,
      opposesRoleIds: ["actor"],
      isEligible: (tribute, { state }) => isUntruced(state, tribute),
      getWeight: (tribute) => 1 + getStatusSeverity(tribute, "thirsty"),
    },
  ],
  isEligible: ({ state, livingTributes }) =>
    livingTributes.some((tribute) => isUntruced(state, tribute) && hasStatus(tribute, "thirsty")) &&
    livingTributes.filter((tribute) => isUntruced(state, tribute)).length >= 3,
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const others = requireParticipants(context.participantsByRole, "others");
    const participants = [actor, ...others];

    return {
      text:
        `${formatNameList(participants)} all go looking for water, only to converge on the same small stream. ` +
        `A fight ensues, and they finally collapse exhausted and willing to share.`,
      changes: [
        ...participants.map((tribute) => satisfyNeed(tribute, "water")),
        ...participants.map((tribute) =>
          createStatusChange(context.eventId, tribute, "injured", 1, context.round),
        ),
        ...createSurvivalChanges(participants),
      ],
    };
  },
};

const COLLAPSE_AT_WATERLINE: EventDefinition = {
  id: "status-collapse-at-waterline",
  category: "fatal",
  periods: ["day"],
  baseWeight: 2,
  tags: ["fatal", "status", "deprivation", "combat", "resource"],
  selectionProfile: profile(4, [
    "status-requirement",
    "deprivation-requirement",
    "truce-requirement",
  ]),
  participantShape: "pair",
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => hasStatus(tribute, "thirsty", 2),
      getWeight: (tribute) => getStatusSeverity(tribute, "thirsty"),
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];

        return !actor || areNotInSameTruce(state, actor, tribute);
      },
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const actorHuntsTarget = context.state.vendettas.some(
      (vendetta) => vendetta.hunterTributeId === actor.id && vendetta.targetTributeId === target.id,
    );
    const targetHuntsActor = context.state.vendettas.some(
      (vendetta) => vendetta.hunterTributeId === target.id && vendetta.targetTributeId === actor.id,
    );
    const relationshipModifier = (actorHuntsTarget ? 0.75 : 0) - (targetHuntsActor ? 1 : 0);
    const outcome = resolveOutcome(
      getEffectiveStats(actor).luck + relationshipModifier,
      context.random,
    );

    if (outcome === "critical-failure") {
      return {
        text:
          `${target.snapshot.name} notices ${actor.snapshot.name}, quickly relieves ${actorPronouns.object} of every supply, ` +
          `and lets the muck pull ${actor.snapshot.name} underneath.`,
        changes: [
          ...createFatalChanges(
            actor,
            "muck-drowning",
            "Drowned in muck",
            `${actor.snapshot.name} is robbed and left to drown in the riverbank muck by ${target.snapshot.name}.`,
            target,
          ),
          satisfyNeed(target, "water"),
          ...createSurvivalChanges([target]),
        ],
      };
    }

    if (outcome === "failure") {
      return {
        text:
          `${target.snapshot.name} notices ${actor.snapshot.name} and quickly relieves ${actorPronouns.object} of every supply. ` +
          `It takes ${actor.snapshot.name} hours to pull ${actorPronouns.reflexive} free, finally earning a drink of water.`,
        changes: [
          ...(actor.inventory.length > 0
            ? transferEntireInventory(actor, target, "muck-robbery")
            : [
                createStatusChange(
                  context.eventId,
                  actor,
                  "exhausted",
                  1,
                  context.round,
                  undefined,
                  target.id,
                ),
              ]),
          satisfyNeed(actor, "water"),
          satisfyNeed(target, "water"),
          ...createSurvivalChanges([actor, target]),
        ],
      };
    }

    if (outcome === "success") {
      return {
        text:
          `${actor.snapshot.name} pleads with ${target.snapshot.name} for help. ` +
          `To ${actorPronouns.possessiveAdjective} relief, ${target.snapshot.name} pulls a long stick from the woods, ` +
          `leaves it within reach, and disappears back into the trees.`,
        changes: [
          satisfyNeed(actor, "water"),
          satisfyNeed(target, "water"),
          ...createSurvivalChanges([actor, target]),
        ],
      };
    }

    return {
      text:
        `${actor.snapshot.name} pleads with ${target.snapshot.name} for help. ` +
        `${target.snapshot.name} uses a long stick to pull ${actor.snapshot.name} free. ` +
        `As soon as ${actorPronouns.subject} ${actorPronouns.bePresent} back on dry ground, ` +
        `${actor.snapshot.name} grabs ${targetPronouns.possessiveAdjective} backpack and pushes ${target.snapshot.name} into the muck. Cold.`,
      changes: [
        satisfyNeed(actor, "water"),
        ...createFatalChanges(
          target,
          "muck-drowning",
          "Drowned in muck",
          `${target.snapshot.name} is pushed into the riverbank muck and drowned by ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const MICROSLEEP_AT_WORST_TIME: EventDefinition = {
  id: "status-microsleep-worst-time",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.5,
  tags: ["fatal", "ambush", "status", "combat", "weapon"],
  selectionProfile: profile(4, ["status-requirement", "truce-requirement"]),
  participantShape: "pair",
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => hasStatus(tribute, "exhausted", 2),
      getWeight: (tribute) => getStatusSeverity(tribute, "exhausted"),
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];

        return !actor || areNotInSameTruce(state, actor, tribute);
      },
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const weapon = findUsableWeapon(target, [target]);
    const text = weapon
      ? `${actor.snapshot.name} cannot hold out any longer and falls asleep for what feels like only a second. ` +
        `${actorPronouns.Subject} wakes just long enough to see the flash of ${target.snapshot.name}'s ${itemLabel(weapon)} ` +
        `before going back to sleep, permanently.`
      : `${actor.snapshot.name} cannot hold out any longer and falls asleep for what feels like only a second. ` +
        `${actorPronouns.Subject} wakes just long enough to see ${target.snapshot.name}'s crazed expression ` +
        `and feel ${targetPronouns.possessiveAdjective} hands around ${actorPronouns.possessiveAdjective} neck ` +
        `before going back to sleep, permanently.`;

    return {
      text,
      changes: [
        ...createFatalChanges(
          actor,
          "microsleep-ambush",
          "Killed while asleep",
          `${actor.snapshot.name} is killed by ${target.snapshot.name} after falling asleep in the open.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const SLEEPWALKING_THROUGH_ARENA: EventDefinition = {
  id: "status-sleepwalking-through-arena",
  category: "hazard",
  periods: ["night"],
  baseWeight: 3,
  tags: ["hazard", "status", "environment"],
  selectionProfile: profile(3, ["status-requirement"]),
  recoveryProfile: {
    targets: [
      {
        kind: "status",
        roleId: "actor",
        statusIds: ["exhausted"],
      },
    ],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => hasStatus(tribute, "exhausted", 2),
      getWeight: (tribute) => getStatusSeverity(tribute, "exhausted"),
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} is so exhausted, ${pronouns.subject} falls asleep without shelter on several sharp rocks ` +
        `and has the best sleep of ${pronouns.possessiveAdjective} life.`,
      changes: [
        ...removeStatusChanges(actor, "exhausted"),
        createStatusChange(context.eventId, actor, "injured", 1, context.round),
        ...finishForSurvivors(context, [actor], "comfortable"),
      ],
    };
  },
};

function createWatchEndsEarlyEvent(size: TruceSize): EventDefinition {
  return {
    id: `status-watch-ends-early-${size}`,
    category: "fatal",
    periods: ["night"],
    baseWeight: 2 / size,
    tags: ["fatal", "ambush", "status", "truce", "item"],
    selectionProfile: profile(5, ["status-requirement", "truce-requirement", "custom-eligibility"]),
    participantShape: size === 2 ? "trio" : "group-four-plus",
    roles: [
      {
        id: "actor",
        count: 1,
        isEligible: (tribute, { state }) =>
          hasStatus(tribute, "exhausted") &&
          getStandardTruceOfSize(state, tribute.id, size) !== null,
        getWeight: (tribute) => getStatusSeverity(tribute, "exhausted"),
      },
      {
        id: "members",
        count: size - 1,
        isEligible: (tribute, { state, participantsByRole }) => {
          const actor = participantsByRole.actor?.[0];

          if (!actor) {
            return false;
          }

          const truce = getStandardTruceOfSize(state, actor.id, size);

          return truce?.tributeIds.includes(tribute.id) ?? false;
        },
      },
      {
        id: "target",
        count: 1,
        targeting: "hostile",
        opposesRoleIds: ["actor", "members"],
        isEligible: (tribute, { state, participantsByRole }) => {
          const actor = participantsByRole.actor?.[0];
          const truce = actor ? getStandardTruceOfSize(state, actor.id, size) : null;

          return truce !== null && !truce.tributeIds.includes(tribute.id);
        },
      },
    ],
    isEligible: ({ state, livingTributes }) =>
      state.truces.some(
        (truce) =>
          truce.kind === "standard" &&
          getLivingTruceMembers(state, truce).length === size &&
          getLivingTruceMembers(state, truce).some((member) => hasStatus(member, "exhausted")) &&
          livingTributes.some((tribute) => !truce.tributeIds.includes(tribute.id)),
      ),
    resolve(context) {
      const actor = requireSingleParticipant(context.participantsByRole, "actor");
      const members = requireParticipants(context.participantsByRole, "members");
      const target = requireSingleParticipant(context.participantsByRole, "target");
      const truceMembers = [actor, ...members];
      const targetPronouns = getTributePronouns(target);
      const targetWeapon = findUsableWeapon(target, [target]);
      const groupWeapon = findUsableWeapon(target, truceMembers);
      const killer = targetWeapon || groupWeapon ? target : (members[0] ?? target);
      let text: string;

      if (targetWeapon) {
        text =
          `${actor.snapshot.name} falls asleep almost immediately during ${getTributePronouns(actor).possessiveAdjective} turn keeping watch, ` +
          `and the camp is easily attacked by ${target.snapshot.name}, who steals their supplies and kills ${actor.snapshot.name} ` +
          `with ${targetPronouns.possessiveAdjective} ${itemLabel(targetWeapon)}.`;
      } else if (groupWeapon) {
        text =
          `${actor.snapshot.name} falls asleep almost immediately during ${getTributePronouns(actor).possessiveAdjective} turn keeping watch, ` +
          `and the camp is easily attacked by ${target.snapshot.name}, who steals their supplies and kills ${actor.snapshot.name} ` +
          `with the group's own ${itemLabel(groupWeapon)}.`;
      } else {
        text =
          `${actor.snapshot.name} falls asleep almost immediately during ${getTributePronouns(actor).possessiveAdjective} turn keeping watch, ` +
          `and the camp is easily attacked by ${target.snapshot.name}, who steals their supplies but thankfully leaves everyone alive. ` +
          `In the morning, ${actor.snapshot.name} is killed for the betrayal.`;
      }

      return {
        text,
        changes: [
          ...transferInventories(truceMembers, target, "truce-camp-raid"),
          ...createFatalWithoutLoot(
            actor,
            killer,
            "failed-watch",
            "Killed after failing watch",
            `${actor.snapshot.name} is killed after falling asleep while guarding the truce camp.`,
          ),
          ...finishForSurvivors(context, [...members, target], "unsheltered"),
        ],
      };
    },
  };
}

const CAFFEINE_ARBITRATION: EventDefinition = {
  id: "status-caffeine-arbitration",
  category: "survival",
  periods: ["day"],
  baseWeight: 3,
  tags: ["survival", "status", "item", "resource"],
  selectionProfile: profile(5, ["status-requirement", "item-requirement", "truce-requirement"]),
  recoveryProfile: {
    targets: [
      {
        kind: "status",
        roleId: "actor",
        statusIds: ["exhausted"],
      },
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
      isEligible: (tribute) => hasStatus(tribute, "exhausted"),
      getWeight: (tribute) => getStatusSeverity(tribute, "exhausted"),
    },
    {
      id: "target",
      count: 1,
      opposesRoleIds: ["actor"],
      requiredItemDefinitionIds: CAFFEINATED_ITEM_IDS,
      itemAccess: "owned",
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];

        return !actor || areNotInSameTruce(state, actor, tribute);
      },
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);
    const item = selectedItem(context, "target");

    return {
      text:
        `${actor.snapshot.name} and ${target.snapshot.name}'s fight ends in a standstill. ` +
        `${actor.snapshot.name} yawns involuntarily, and ${target.snapshot.name} negotiates ${itemLabel(item)} ` +
        `in exchange for ${targetPronouns.possessiveAdjective} life, to which ${actor.snapshot.name} agrees perhaps too enthusiastically.`,
      changes: [
        transferItem(item, target, actor, "caffeine-arbitration"),
        ...compileItemUseEffects({
          eventId: context.eventId,
          round: context.round,
          actingTribute: actor,
          owner: actor,
          item,
          random: context.random,
          reason: "caffeine-arbitration",
        }),
        satisfyNeed(actor, "water"),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const WORCESTERSHIRE: EventDefinition = {
  id: "status-worcestershire",
  category: "survival",
  periods: ["day", "night"],
  baseWeight: 1.5,
  tags: ["survival", "status"],
  selectionProfile: profile(2, ["status-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => hasStatus(tribute, "disoriented"),
      getWeight: (tribute) => getStatusSeverity(tribute, "disoriented"),
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");

    return {
      text: `${actor.snapshot.name} spends several hours arguing with an arena goose about the proper pronunciation of Worcestershire.`,
      changes: finishForSurvivors(context, [actor]),
    };
  },
};

const FOLLOWING_OWN_FOOTPRINTS: EventDefinition = {
  id: "status-following-own-footprints",
  category: "survival",
  periods: ["day"],
  baseWeight: 2,
  tags: ["survival", "status", "environment"],
  selectionProfile: profile(2, ["status-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => hasStatus(tribute, "disoriented"),
      getWeight: (tribute) => getStatusSeverity(tribute, "disoriented"),
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} follows a trail of footprints for hours, increasingly impressed by the stranger's agility, ` +
        `before arriving back at ${pronouns.possessiveAdjective} own abandoned camp.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const REFLECTION_ATTACKS_FIRST: EventDefinition = {
  id: "status-reflection-attacks-first",
  category: "fatal",
  periods: ["day"],
  baseWeight: 2,
  tags: ["fatal", "status", "environment", "deprivation"],
  selectionProfile: profile(3, ["status-requirement", "deprivation-requirement"]),
  recoveryProfile: {
    targets: [
      {
        kind: "status",
        roleId: "actor",
        statusIds: ["disoriented"],
      },
      {
        kind: "survival-need",
        roleId: "actor",
        need: "water",
      },
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
      isEligible: (tribute) => hasStatus(tribute, "disoriented", 2),
      getWeight: (tribute) => getStatusSeverity(tribute, "disoriented"),
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const outcome = resolveOutcome(getEffectiveStats(actor).luck, context.random, 4);

    if (outcome === "critical-failure") {
      return {
        text:
          `${actor.snapshot.name}'s disorientation leads ${pronouns.object} to the river, where ${pronouns.subject} spots a hostile tribute beneath the water. ` +
          `${pronouns.Subject} attacks without hesitation and, in the confusion, successfully drowns ${pronouns.reflexive}.`,
        changes: createFatalChanges(
          actor,
          "reflection-drowning",
          "Accidental drowning",
          `${actor.snapshot.name} drowns while attacking ${pronouns.possessiveAdjective} own reflection.`,
        ),
      };
    }

    if (outcome === "failure") {
      return {
        text: `${actor.snapshot.name} finally gives up after nearly drowning ${pronouns.reflexive}.`,
        changes: [satisfyNeed(actor, "water"), ...createSurvivalChanges([actor])],
      };
    }

    if (outcome === "success") {
      return {
        text: `After a few minutes splashing in the water, ${actor.snapshot.name} finally becomes clear-headed and heads back to shore, thoroughly soaked.`,
        changes: [
          satisfyNeed(actor, "water"),
          ...removeStatusChanges(actor, "disoriented"),
          ...createSurvivalChanges([actor]),
        ],
      };
    }

    return {
      text: `Somehow, ${actor.snapshot.name} manages to grab a fish in the confusion and is able to enjoy a fresh dinner.`,
      changes: [
        satisfyNeed(actor, "water"),
        satisfyNeed(actor, "food"),
        ...removeStatusChanges(actor, "disoriented"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

function hallucinatoryRoles(): readonly ParticipantRoleDefinition[] {
  return [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isUntruced(state, tribute) && hasStatus(tribute, "disoriented"),
      getWeight: (tribute) => getStatusSeverity(tribute, "disoriented"),
    },
    {
      id: "observers",
      count: 3,
      isEligible: (tribute, { state }) => isUntruced(state, tribute),
    },
  ];
}

function hallucinatoryEligibility({
  state,
  livingTributes,
}: {
  state: GameState;
  livingTributes: readonly GameTribute[];
}): boolean {
  const untruced = livingTributes.filter((tribute) => isUntruced(state, tribute));

  return untruced.length >= 4 && untruced.some((tribute) => hasStatus(tribute, "disoriented"));
}

const HALLUCINATORY_JURY_CLIFF: EventDefinition = {
  id: "status-hallucinatory-jury-cliff",
  category: "fatal",
  periods: ["day", "night"],
  baseWeight: 1,
  tags: ["fatal", "status", "combat", "environment"],
  selectionProfile: profile(4, ["status-requirement", "truce-requirement"]),
  participantShape: "group-four-plus",
  roles: hallucinatoryRoles(),
  isEligible: hallucinatoryEligibility,
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const observers = requireParticipants(context.participantsByRole, "observers");
    const [observer1, observer2, observer3] = observers;

    if (!observer1 || !observer2 || !observer3) {
      throw new Error("Hallucinatory Jury requires three observers.");
    }

    const actorPronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name}, tripping out, convinces ${observer1.snapshot.name} that ${actorPronouns.subject} has found a way out of the arena. ` +
        `Quietly, they recruit ${observer2.snapshot.name} and ${observer3.snapshot.name}, and ${actor.snapshot.name} leads them through ` +
        `a complicated twist of trails ending at the side of a cliff. Finally realizing that ${actor.snapshot.name} has been bugging out, ` +
        `${observer1.snapshot.name} shoves ${actor.snapshot.name} into the chasm and everyone runs back to safety.`,
      changes: [
        ...createFatalChanges(
          actor,
          "hallucinatory-cliff-fall",
          "Pushed from a cliff",
          `${actor.snapshot.name} is pushed into a chasm by ${observer1.snapshot.name}.`,
          observer1,
        ),
        ...finishForSurvivors(context, observers, "unsheltered"),
      ],
    };
  },
};

const HALLUCINATORY_JURY_CROSSFIRE: EventDefinition = {
  id: "status-hallucinatory-jury-crossfire",
  category: "fatal",
  periods: ["day", "night"],
  baseWeight: 0.8,
  tags: ["fatal", "status", "combat", "environment"],
  selectionProfile: profile(4, ["status-requirement", "truce-requirement"]),
  participantShape: "group-four-plus",
  roles: hallucinatoryRoles(),
  isEligible: hallucinatoryEligibility,
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const observers = requireParticipants(context.participantsByRole, "observers");
    const [observer1, observer2, observer3] = observers;

    if (!observer1 || !observer2 || !observer3) {
      throw new Error("Hallucinatory Jury requires three observers.");
    }

    const actorPronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name}, tripping out, runs screaming through the woods, catching the attention of several tributes who peek out of hiding. ` +
        `${observer1.snapshot.name} rushes ${actor.snapshot.name}, knocking ${actorPronouns.object} down and covering ${actorPronouns.possessiveAdjective} mouth. ` +
        `This causes ${observer2.snapshot.name} and ${observer3.snapshot.name} to charge, ending with three deaths and a still-screaming ` +
        `${actor.snapshot.name}, who jumps up and continues running.`,
      changes: [
        createAttemptedKillChange(observer1),
        createKillCreditChange(observer1),
        createAttemptedKillChange(observer2),
        createKillCreditChange(observer2),
        createAttemptedKillChange(observer3),
        createKillCreditChange(observer3),
        createEliminationChange(
          observer2,
          "hallucinatory-crossfire",
          "Killed in a chaotic fight",
          `${observer2.snapshot.name} is killed by ${observer1.snapshot.name} during the confusion.`,
          [observer1.id],
        ),
        createEliminationChange(
          observer3,
          "hallucinatory-crossfire",
          "Killed in a chaotic fight",
          `${observer3.snapshot.name} is killed by ${observer2.snapshot.name} during the confusion.`,
          [observer2.id],
        ),
        createEliminationChange(
          observer1,
          "hallucinatory-crossfire",
          "Killed in a chaotic fight",
          `${observer1.snapshot.name} is killed by ${observer3.snapshot.name} during the confusion.`,
          [observer3.id],
        ),
        ...finishForSurvivors(context, [actor], "unsheltered"),
      ],
    };
  },
};

const ANTIDOTE_PRICE: EventDefinition = {
  id: "status-antidote-price",
  category: "survival",
  periods: ["day", "night"],
  baseWeight: 4,
  tags: ["survival", "status", "item"],
  selectionProfile: profile(5, ["status-requirement", "item-requirement", "truce-requirement"]),
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
      isEligible: (tribute) => hasStatus(tribute, "poisoned"),
      getWeight: (tribute) => getStatusSeverity(tribute, "poisoned"),
    },
    {
      id: "target",
      count: 1,
      opposesRoleIds: ["actor"],
      requiredItemDefinitionIds: POISON_TREATMENT_ITEM_IDS,
      itemAccess: "owned",
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];

        return !actor || areNotInSameTruce(state, actor, tribute);
      },
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const medicine = selectedItem(context, "target");

    if (actor.inventory.length === 0) {
      return {
        text:
          `${target.snapshot.name} comes across a very sick ${actor.snapshot.name} and asks what ${actorPronouns.subject} will pay for the antidote. ` +
          `${actor.snapshot.name} shows ${actorPronouns.subject} has nothing to offer, so ${target.snapshot.name} leaves ${actorPronouns.object} in the dust, ` +
          `knowing it is every person for themselves out here.`,
        changes: finishForSurvivors(context, [actor, target]),
      };
    }

    return {
      text:
        `${target.snapshot.name} comes across a very sick ${actor.snapshot.name} and asks what ${actorPronouns.subject} will pay for the antidote. ` +
        `${actor.snapshot.name} hands over ${actorPronouns.possessiveAdjective} pack in exchange and feels instantly better, ` +
        `colour flooding back into ${actorPronouns.possessiveAdjective} face as the shaking stops.`,
      changes: [
        ...transferEntireInventory(actor, target, "antidote-payment"),
        ...compileItemUseEffects({
          eventId: context.eventId,
          round: context.round,
          actingTribute: actor,
          owner: target,
          item: medicine,
          random: context.random,
          reason: "antidote-payment",
        }),
        ...finishForSurvivors(context, [actor, target]),
      ],
    };
  },
};

const POISONED_MERCY_KILLING: EventDefinition = {
  id: "status-poisoned-mercy-killing",
  category: "fatal",
  periods: ["day"],
  baseWeight: 2,
  tags: ["fatal", "status", "combat"],
  selectionProfile: profile(4, ["status-requirement", "truce-requirement"]),
  participantShape: "pair",
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => hasStatus(tribute, "poisoned"),
      getWeight: (tribute) => getStatusSeverity(tribute, "poisoned"),
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];

        return (
          !hasStatus(tribute, "poisoned") && (!actor || areNotInSameTruce(state, actor, tribute))
        );
      },
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);

    return {
      text:
        `${target.snapshot.name} discovers ${actor.snapshot.name} getting sick and shaking and decides to put ` +
        `${actorPronouns.object} out of ${actorPronouns.possessiveAdjective} misery.`,
      changes: [
        ...createFatalChanges(
          actor,
          "poison-mercy-killing",
          "Mercy killing",
          `${actor.snapshot.name} is killed by ${target.snapshot.name} after the poison takes hold.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const POISONED_BREAKS_TRUCE: EventDefinition = {
  id: "status-poisoned-breaks-truce",
  category: "fatal",
  periods: ["day"],
  baseWeight: 2,
  tags: ["fatal", "status", "combat", "truce"],
  selectionProfile: profile(4, ["status-requirement", "truce-requirement"]),
  participantShape: "pair",
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        hasStatus(tribute, "poisoned") && getActiveTruceForTribute(state, tribute.id) !== null,
      getWeight: (tribute) => getStatusSeverity(tribute, "poisoned"),
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

        return areTributesInSameTruce(state, actor.id, tribute.id);
      },
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);

    /*
     * Death-triggered truce dissolution is emitted by the existing
     * automatic truce-aftermath system. Do not add a second manual
     * break-truce change here.
     */
    return {
      text:
        `${target.snapshot.name} wakes to see the poison taking hold of ${actor.snapshot.name}: ` +
        `${actorPronouns.subject} ${actorPronouns.bePresent} pale, shaking, and repeatedly getting sick. ` +
        `${target.snapshot.name} says ${actorPronouns.subject} will get them both killed and ends the truce early with a deadly blow to the forehead.`,
      changes: [
        ...createFatalChanges(
          actor,
          "poisoned-truce-mercy-killing",
          "Killed by a truce partner",
          `${actor.snapshot.name} is killed by ${target.snapshot.name} after poison threatens their truce.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const RATIONING_EVENTS = TRUCE_SIZES.map(createRationingEvent);

const WATCH_ENDS_EARLY_EVENTS = TRUCE_SIZES.map(createWatchEndsEarlyEvent);

export const STATUS_SPECIFIC_EVENT_CONCEPT_IDS = [
  "status-emergency-bark-buffet",
  "status-meal-worth-following",
  "status-last-edible-thing",
  "status-rationing-becomes-personal",
  "status-muddy-miracle",
  "status-someone-else-found-water-first",
  "status-three-straws-no-cup",
  "status-collapse-at-waterline",
  "status-microsleep-worst-time",
  "status-sleepwalking-through-arena",
  "status-watch-ends-early",
  "status-caffeine-arbitration",
  "status-worcestershire",
  "status-following-own-footprints",
  "status-reflection-attacks-first",
  "status-hallucinatory-jury-cliff",
  "status-hallucinatory-jury-crossfire",
  "status-antidote-price",
  "status-poisoned-mercy-killing",
  "status-poisoned-breaks-truce",
] as const;

export const STATUS_SPECIFIC_EVENTS = [
  EMERGENCY_BARK_BUFFET,
  MEAL_WORTH_FOLLOWING,
  LAST_EDIBLE_THING,
  ...RATIONING_EVENTS,
  MUDDY_MIRACLE,
  SOMEONE_ELSE_FOUND_WATER_FIRST,
  THREE_STRAWS_NO_CUP,
  COLLAPSE_AT_WATERLINE,
  MICROSLEEP_AT_WORST_TIME,
  SLEEPWALKING_THROUGH_ARENA,
  ...WATCH_ENDS_EARLY_EVENTS,
  CAFFEINE_ARBITRATION,
  WORCESTERSHIRE,
  FOLLOWING_OWN_FOOTPRINTS,
  REFLECTION_ATTACKS_FIRST,
  HALLUCINATORY_JURY_CLIFF,
  HALLUCINATORY_JURY_CROSSFIRE,
  ANTIDOTE_PRICE,
  POISONED_MERCY_KILLING,
  POISONED_BREAKS_TRUCE,
] satisfies readonly EventDefinition[];
