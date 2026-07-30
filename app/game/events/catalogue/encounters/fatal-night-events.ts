import { getEffectiveStats } from "~/game/engine/effective-stats";
import { selectWeightedItem } from "~/game/engine/random";
import { getCombatScore } from "~/game/engine/stat-formulas";
import {
  createAttemptedKillChange,
  createEliminationChange,
  createItemUseChange,
  createKillCreditChange,
  createNightRestChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { resolveScoreCheck, type StatCheckOutcome } from "~/game/events/event-outcomes";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventItemSelection,
  type EventResolution,
  type EventResolutionContext,
  type EventSelectionContext,
  type ParticipantRoleDefinition,
} from "~/game/events/event-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { NightRestQuality } from "~/game/survival/survival-schema";
import { getActiveTruceForTribute, getLivingTruceMembers } from "~/game/truces/truce-engine";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type {
  GameChange,
  GameState,
  GameTribute,
  InventoryItem,
  Truce,
} from "~/game/types/game-state";

const PIERCING_WEAPON_IDS = [
  "knife",
  "short-sword",
  "rapier",
  "longsword",
  "greatsword",
  "spear",
  "pike",
  "trident",
] as const satisfies readonly ItemDefinitionId[];

const AXE_ITEM_IDS = ["hand-axe", "axe"] as const satisfies readonly ItemDefinitionId[];
const RANGED_BOW_ITEM_IDS = [
  "bow",
  "longbow",
  "crossbow",
] as const satisfies readonly ItemDefinitionId[];
const POISON_FORAGE_ITEM_IDS = [
  "poison-berries",
  "poison-mushrooms",
] as const satisfies readonly ItemDefinitionId[];
const FIRE_STARTER_ITEM_IDS = [
  "lighter",
  "matches",
  "flint-stone",
  "kindling",
] as const satisfies readonly ItemDefinitionId[];
const BEDDING_ITEM_IDS = [
  "blanket",
  "sleeping-bag",
  "pillow",
  "thermal-blanket",
] as const satisfies readonly ItemDefinitionId[];
const REST_CAPABLE_ITEM_IDS = [
  "kindling",
  "blanket",
  "sleeping-bag",
  "thermal-blanket",
  "pillow",
  "tent",
  "tarp",
  "lighter",
  "matches",
  "flint-stone",
] as const satisfies readonly ItemDefinitionId[];

interface FatalNightOptions {
  causeLabel: string;
  text: string;
  actor: GameTribute;
  target: GameTribute;
  itemChanges?: readonly GameChange[];
  actorRestQuality?: NightRestQuality;
  actorStatusIds?: readonly StatusEffectId[];
  actorNeeds?: readonly ("food" | "water")[];
  breakTruce?: Truce | null;
  transferLoot?: boolean;
  excludedLootItemInstanceIds?: ReadonlySet<string>;
}

function choose<T>(random: EventResolutionContext["random"], values: readonly T[]): T {
  const index = Math.min(values.length - 1, Math.floor(random() * values.length));
  const value = values[index];

  if (value === undefined) {
    throw new Error("Cannot choose from an empty collection.");
  }

  return value;
}

function getSelectedRoleItem(
  context: EventResolutionContext,
  roleId: string,
): EventItemSelection | null {
  return context.itemsByRole?.[roleId]?.[0] ?? null;
}

function requireSelectedRoleItem(
  context: EventResolutionContext,
  roleId: string,
): EventItemSelection {
  const selection = getSelectedRoleItem(context, roleId);

  if (!selection) {
    throw new Error(
      `Fatal Night event "${context.eventId}" is missing selected item role "${roleId}".`,
    );
  }

  return selection;
}

function getItemLabel(item: InventoryItem): string {
  return getItemDefinition(item.definitionId).label.toLowerCase();
}

function hasWeapon(tribute: GameTribute): boolean {
  return tribute.inventory.some((item) =>
    (getItemDefinition(item.definitionId).tags as readonly string[]).includes("weapon"),
  );
}

function ownsAnyItem(tribute: GameTribute, itemIds: readonly ItemDefinitionId[]): boolean {
  const itemIdSet = new Set<ItemDefinitionId>(itemIds);
  return tribute.inventory.some((item) => itemIdSet.has(item.definitionId));
}

function getStandardTruce(
  state: GameState,
  actor: GameTribute,
  target?: GameTribute,
): Truce | null {
  const truce = getActiveTruceForTribute(state, actor.id);

  if (truce?.kind !== "standard" || (target && !truce.tributeIds.includes(target.id))) {
    return null;
  }

  return truce;
}

function requireStandardTruce(state: GameState, actor: GameTribute, target: GameTribute): Truce {
  const truce = getStandardTruce(state, actor, target);

  if (!truce) {
    throw new Error("Fatal Night betrayal selected tributes outside the same standard truce.");
  }

  return truce;
}

function standardTruceActorEligibility(
  tribute: GameTribute,
  { state }: EventSelectionContext,
): boolean {
  const truce = getStandardTruce(state, tribute);
  return truce !== null && getLivingTruceMembers(state, truce).length >= 2;
}

function standardTruceTargetEligibility(
  tribute: GameTribute,
  {
    state,
    participantsByRole,
  }: Parameters<NonNullable<ParticipantRoleDefinition["isEligible"]>>[1],
): boolean {
  const actor = participantsByRole.actor?.[0];
  return actor !== undefined && getStandardTruce(state, actor, tribute) !== null;
}

function createStandardTruceRoles(
  actorOptions: Partial<ParticipantRoleDefinition> = {},
  targetOptions: Partial<ParticipantRoleDefinition> = {},
): readonly ParticipantRoleDefinition[] {
  return [
    {
      id: "actor",
      count: 1,
      isEligible: standardTruceActorEligibility,
      ...actorOptions,
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      isEligible: standardTruceTargetEligibility,
      ...targetOptions,
    },
  ];
}

function createHostileRoles(
  actorOptions: Partial<ParticipantRoleDefinition> = {},
  targetOptions: Partial<ParticipantRoleDefinition> = {},
): readonly ParticipantRoleDefinition[] {
  return [
    {
      id: "actor",
      count: 1,
      opposesRoleIds: ["target"],
      ...actorOptions,
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
      ...targetOptions,
    },
  ];
}

function createNeedChange(tribute: GameTribute, need: "food" | "water"): GameChange {
  return {
    type: "satisfy-survival-need",
    tributeId: tribute.id,
    need,
  };
}

function createLootChanges(
  target: GameTribute,
  actor: GameTribute,
  excludedItemInstanceIds: ReadonlySet<string>,
): GameChange[] {
  return target.inventory.flatMap((item): GameChange[] =>
    excludedItemInstanceIds.has(item.id)
      ? []
      : [
          {
            type: "transfer-item",
            itemInstanceId: item.id,
            fromTributeId: target.id,
            toTributeId: actor.id,
            reason: "death-loot",
          },
        ],
  );
}

function createFatalNightChanges(
  context: EventResolutionContext,
  {
    causeLabel,
    text,
    actor,
    target,
    itemChanges = [],
    actorRestQuality = "sheltered",
    actorStatusIds = [],
    actorNeeds = [],
    breakTruce = null,
    transferLoot = true,
    excludedLootItemInstanceIds = new Set<string>(),
  }: FatalNightOptions,
): GameChange[] {
  return [
    ...itemChanges,
    createEliminationChange(target, context.eventId, causeLabel, text, [actor.id]),
    createAttemptedKillChange(actor),
    createKillCreditChange(actor),
    ...(transferLoot ? createLootChanges(target, actor, excludedLootItemInstanceIds) : []),
    ...(breakTruce
      ? [
          {
            type: "break-truce" as const,
            truceId: breakTruce.id,
            reason: "betrayal" as const,
          },
        ]
      : []),
    ...actorNeeds.map((need) => createNeedChange(actor, need)),
    ...actorStatusIds.map((statusId) =>
      createStatusChange(context.eventId, actor, statusId, 1, context.round),
    ),
    ...createNightRestChanges([actor], context.round, actorRestQuality),
    ...createSurvivalChanges([actor]),
  ];
}

function createFailedAttackChanges(
  context: EventResolutionContext,
  actor: GameTribute,
  target: GameTribute,
  itemChanges: readonly GameChange[],
): GameChange[] {
  return [
    ...itemChanges,
    createAttemptedKillChange(actor),
    ...createNightRestChanges([actor], context.round, "sheltered"),
    ...createNightRestChanges([target], context.round, "unsheltered"),
    ...createSurvivalChanges([actor, target]),
  ];
}

function getRestQuality(item: InventoryItem): NightRestQuality {
  return getItemDefinition(item.definitionId).rest?.quality ?? "sheltered";
}

function willUseRemoveItem(item: InventoryItem): boolean {
  return item.usesRemaining === 1;
}

function getOutcomeWeight(outcome: StatCheckOutcome, advantage: number): number {
  switch (outcome) {
    case "critical-failure":
      return Math.max(0.5, 1 - advantage * 0.5);
    case "failure":
      return Math.max(1, 4 - advantage);
    case "success":
      return Math.max(1, 4 + advantage);
    case "exceptional-success":
      return Math.max(0.5, 1 + advantage * 0.5);
  }
}

function selectSuccessfulOutcome(
  score: number,
  difficulty: number,
  random: EventResolutionContext["random"],
): "success" | "exceptional-success" {
  const advantage = score - difficulty;
  const outcomes = [
    {
      outcome: "success" as const,
      weight: getOutcomeWeight("success", advantage),
    },
    {
      outcome: "exceptional-success" as const,
      weight: getOutcomeWeight("exceptional-success", advantage),
    },
  ];

  return selectWeightedItem(outcomes, ({ weight }) => weight, random).outcome;
}

const BETRAYAL_ON_WATCH_EVENT: EventDefinition = {
  id: "night-fatal-betrayal-on-watch",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.35,
  tags: ["fatal", "combat", "weapon", "item", "truce", "ambush"],
  roles: createStandardTruceRoles({
    itemAccess: "owned",
    requiredItemDefinitionIds: PIERCING_WEAPON_IDS,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const truce = requireStandardTruce(context.state, actor, target);
    const weapon = requireSelectedRoleItem(context, "actor");
    const weaponLabel = getItemLabel(weapon.item);
    const text = choose(context.random, [
      `${actor.snapshot.name} volunteers to take the first watch and waits until ` +
        `${target.snapshot.name}'s breathing becomes slow and even. ${actor.snapshot.name} kneels beside ` +
        `${targetPronouns.object}, covers ${targetPronouns.possessiveAdjective} mouth, and drives the ` +
        `${weaponLabel} into ${target.snapshot.name}'s chest. By sunrise, ${actor.snapshot.name} has ` +
        "gathered both packs and left no trace of the former alliance.",
      `${actor.snapshot.name} decides to end ${actorPronouns.possessiveAdjective} truce early and ` +
        `stabs ${target.snapshot.name} in the chest with the ${weaponLabel} while ` +
        `${targetPronouns.subject} ${targetPronouns.bePresent} asleep.`,
    ]);

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "Betrayed on watch",
        text,
        actor,
        target,
        itemChanges: [createItemUseChange(weapon.owner, weapon.item, context.eventId)],
        breakTruce: truce,
      }),
    };
  },
};

const POISONED_SHARED_MEAL_EVENT: EventDefinition = {
  id: "night-fatal-poisoned-shared-meal",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.3,
  tags: ["fatal", "combat", "item", "truce", "ambush"],
  roles: createStandardTruceRoles({
    itemAccess: "owned",
    requiredItemDefinitionIds: POISON_FORAGE_ITEM_IDS,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);
    const truce = requireStandardTruce(context.state, actor, target);
    const poison = requireSelectedRoleItem(context, "actor");
    const poisonLabel = getItemLabel(poison.item);
    const text = choose(context.random, [
      `${actor.snapshot.name} volunteers to prepare dinner while ${target.snapshot.name} finds water. ` +
        `Once ${targetPronouns.subject} ${targetPronouns.bePresent} out of sight, ${actor.snapshot.name} ` +
        `crushes ${poisonLabel} into ${target.snapshot.name}'s portion. The pair toast their truce before ` +
        `${target.snapshot.name} eats and dies before finishing the final bite.`,
      `${actor.snapshot.name} decides to end the truce before ${target.snapshot.name} can betray ${getTributePronouns(actor).object} first. ` +
        `${actor.snapshot.name} mixes ${poisonLabel} into ${target.snapshot.name}'s dinner and sits back ` +
        "for a meal and a show.",
    ]);

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "Poisoned shared meal",
        text,
        actor,
        target,
        itemChanges: [createItemUseChange(poison.owner, poison.item, context.eventId)],
        actorNeeds: ["food", "water"],
        breakTruce: truce,
      }),
    };
  },
};

const CHOPPED_FROM_TREE_EVENT: EventDefinition = {
  id: "night-fatal-chopped-from-tree",
  category: "hazard",
  periods: ["night"],
  baseWeight: 0.5,
  tags: ["hazard", "fatal", "combat", "weapon", "item", "ambush"],
  safetyResolution: "force-success",
  roles: createHostileRoles({
    itemAccess: "owned",
    requiredItemDefinitionIds: AXE_ITEM_IDS,
    getWeight: (tribute) => getEffectiveStats(tribute).brawn,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const weapon = requireSelectedRoleItem(context, "actor");
    const weaponLabel = getItemLabel(weapon.item);
    const outcome =
      context.resolutionMode === "safety"
        ? "success"
        : resolveScoreCheck({
            score: getEffectiveStats(actor).brawn,
            difficulty: 3,
            random: context.random,
          });
    const itemChanges = [createItemUseChange(weapon.owner, weapon.item, context.eventId)];

    if (outcome === "critical-failure") {
      const text =
        `${actor.snapshot.name} discovers ${target.snapshot.name} sleeping on a broad branch overhead. ` +
        `As quietly as possible, ${actorPronouns.subject} begins chopping through the branch with the ` +
        `${weaponLabel}. ${target.snapshot.name} plummets into a bed of soft leaves and escapes with ` +
        "nothing worse than a bruised tailbone.";

      return {
        text,
        changes: createFailedAttackChanges(context, actor, target, itemChanges),
      };
    }

    if (outcome === "failure") {
      const text = choose(context.random, [
        `${actor.snapshot.name} discovers ${target.snapshot.name} sleeping overhead and begins chopping ` +
          `through the tree with the ${weaponLabel}. After several exhausting minutes, it becomes clear ` +
          `that this is a terrible plan. Fortunately, ${target.snapshot.name} remains asleep while ` +
          `${actor.snapshot.name} escapes into the darkness.`,
        `${actor.snapshot.name} discovers ${target.snapshot.name} sleeping in a tree and begins chopping ` +
          `with the ${weaponLabel}. ${target.snapshot.name} wakes to the tree shaking violently and ` +
          `escapes before ${actor.snapshot.name} can finish the job.`,
      ]);

      return {
        text,
        changes: createFailedAttackChanges(context, actor, target, itemChanges),
      };
    }

    const text =
      outcome === "exceptional-success"
        ? choose(context.random, [
            `${actor.snapshot.name} discovers ${target.snapshot.name} sleeping on a broad branch and ` +
              `quietly chops through it with the ${weaponLabel}. ${target.snapshot.name} crashes through ` +
              "the canopy face-first before landing with a deadly thud.",
            `${actor.snapshot.name} discovers ${target.snapshot.name} sleeping in a tree and brings the ` +
              `entire trunk down. The full weight of the tree lands directly on ` +
              `${targetPronouns.object}.`,
          ])
        : `${actor.snapshot.name} discovers ${target.snapshot.name} sleeping on a broad branch and ` +
          `quietly chops through it with the ${weaponLabel}. ${target.snapshot.name} plummets to the ` +
          "forest floor and lands face-first on an upturned branch.";

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "Chopped from a tree",
        text,
        actor,
        target,
        itemChanges,
      }),
    };
  },
};

const FIRELIGHT_AMBUSH_EVENT: EventDefinition = {
  id: "night-fatal-firelight-ambush",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.3,
  tags: ["fatal", "combat", "weapon", "item", "ambush", "status"],
  roles: createHostileRoles(
    {
      itemAccess: "owned",
      requiredItemDefinitionIds: RANGED_BOW_ITEM_IDS,
    },
    {
      itemAccess: "owned",
      requiredItemDefinitionIds: FIRE_STARTER_ITEM_IDS,
      isEligible: (tribute) => !tribute.statuses.some((status) => status.definitionId === "hidden"),
    },
  ),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const weapon = requireSelectedRoleItem(context, "actor");
    const fireStarter = requireSelectedRoleItem(context, "target");
    const weaponLabel = getItemLabel(weapon.item);
    const fireLabel = getItemLabel(fireStarter.item);
    const text = choose(context.random, [
      `${target.snapshot.name} risks the glow of a fire to escape the freezing night. After using the ` +
        `${fireLabel}, ${targetPronouns.subject} curls beside the flames. ${actor.snapshot.name} watches ` +
        `from the shadows, draws the ${weaponLabel}, and eliminates ${target.snapshot.name} before ` +
        `${targetPronouns.subject} can react.`,
      `${actor.snapshot.name} sees a glow in the woods and follows it to ${target.snapshot.name}'s camp. ` +
        `From the shadows, ${actorPronouns.subject} draws the ${weaponLabel} and shoots ` +
        `${target.snapshot.name} straight through the head.`,
    ]);
    const excludedLootItemIds = willUseRemoveItem(fireStarter.item)
      ? new Set([fireStarter.item.id])
      : new Set<string>();

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "Firelight ambush",
        text,
        actor,
        target,
        itemChanges: [
          createItemUseChange(weapon.owner, weapon.item, context.eventId),
          createItemUseChange(fireStarter.owner, fireStarter.item, context.eventId),
        ],
        actorRestQuality: "unsheltered",
        actorStatusIds: ["hidden"],
        excludedLootItemInstanceIds: excludedLootItemIds,
      }),
    };
  },
};

const CRY_FROM_RAVINE_EVENT: EventDefinition = {
  id: "night-fatal-cry-from-ravine",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.4,
  tags: ["fatal", "combat", "environment", "ambush", "status"],
  roles: createHostileRoles({
    isEligible: (tribute) => !hasWeapon(tribute),
    getWeight: (tribute) => getEffectiveStats(tribute).brains,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const text =
      `${actor.snapshot.name} hides beside a steep ravine and cries out for help. When ` +
      `${target.snapshot.name} cautiously approaches the edge, ${actor.snapshot.name} rises from hiding ` +
      `and shoves ${getTributePronouns(target).object} into the darkness. Several moments pass before ${actorPronouns.subject} hears ` +
      "the deadly impact.";

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "Shoved into a ravine",
        text,
        actor,
        target,
        actorStatusIds: ["hidden"],
      }),
    };
  },
};

const DROWNED_AT_RIVER_EVENT: EventDefinition = {
  id: "night-fatal-drowned-at-river",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.35,
  tags: ["fatal", "combat", "environment", "ambush"],
  roles: createHostileRoles({
    getWeight: (tribute) => getCombatScore(tribute),
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const text = choose(context.random, [
      `${target.snapshot.name} shelters near a waterfall, hoping the roar will hide any snoring. ` +
        `${actor.snapshot.name} finds ${targetPronouns.object} sleeping beside the water and holds ` +
        `${targetPronouns.object} beneath the surface until the struggling stops.`,
      `${actor.snapshot.name} gets up during the night and finds ${target.snapshot.name} sleeping beside ` +
        `the river on ${actorPronouns.possessiveAdjective} way back to camp. ` +
        `${actorPronouns.Subject} takes a quick moment to drown ${target.snapshot.name} before returning to bed.`,
    ]);

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "Drowned at the river",
        text,
        actor,
        target,
        actorNeeds: ["water"],
      }),
    };
  },
};

const ROLLED_INTO_FIRE_EVENT: EventDefinition = {
  id: "night-fatal-rolled-into-fire",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.3,
  tags: ["fatal", "combat", "truce", "ambush"],
  roles: createStandardTruceRoles(),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const truce = requireStandardTruce(context.state, actor, target);
    const text = choose(context.random, [
      `${actor.snapshot.name} and ${target.snapshot.name} arrange themselves on opposite sides of the fire. ` +
        `Once ${target.snapshot.name} falls asleep, ${actor.snapshot.name} rolls ${getTributePronouns(target).object} directly into the flames ` +
        "and uses the abandoned bedding to make the remaining side of camp significantly more comfortable.",
      `${actor.snapshot.name} and ${target.snapshot.name} go to sleep around a campfire. Once ` +
        `${target.snapshot.name} falls asleep, ${actor.snapshot.name} ends the truce early and rolls ` +
        `${getTributePronouns(target).object} into the flames, enjoying the extra bedding left behind.`,
    ]);

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "Rolled into the fire",
        text,
        actor,
        target,
        actorRestQuality: "comfortable",
        breakTruce: truce,
      }),
    };
  },
};

function beddingTruceActorEligibility(
  tribute: GameTribute,
  { state }: Parameters<NonNullable<ParticipantRoleDefinition["isEligible"]>>[1],
): boolean {
  const truce = getStandardTruce(state, tribute);

  if (!truce) {
    return false;
  }

  return getLivingTruceMembers(state, truce).some((member) =>
    ownsAnyItem(member, BEDDING_ITEM_IDS),
  );
}

function beddingTruceTargetEligibility(
  tribute: GameTribute,
  {
    state,
    participantsByRole,
  }: Parameters<NonNullable<ParticipantRoleDefinition["isEligible"]>>[1],
): boolean {
  const actor = participantsByRole.actor?.[0];

  return (
    actor !== undefined &&
    getStandardTruce(state, actor, tribute) !== null &&
    (ownsAnyItem(actor, BEDDING_ITEM_IDS) || ownsAnyItem(tribute, BEDDING_ITEM_IDS))
  );
}

const SMOTHERED_BENEATH_BLANKET_EVENT: EventDefinition = {
  id: "night-fatal-smothered-beneath-blanket",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.3,
  tags: ["fatal", "combat", "item", "tool", "truce", "ambush"],
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: beddingTruceActorEligibility,
      optionalItemAccess: "owned",
      optionalItemDefinitionIds: BEDDING_ITEM_IDS,
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      isEligible: beddingTruceTargetEligibility,
      optionalItemAccess: "owned",
      optionalItemDefinitionIds: BEDDING_ITEM_IDS,
    },
  ],
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);
    const truce = requireStandardTruce(context.state, actor, target);
    const bedding = getSelectedRoleItem(context, "actor") ?? getSelectedRoleItem(context, "target");

    if (!bedding) {
      throw new Error("Smothering requires selected bedding.");
    }

    const beddingLabel = getItemLabel(bedding.item);
    const text =
      `${actor.snapshot.name} waits until ${target.snapshot.name} falls asleep, pulls the ` +
      `${beddingLabel} tightly over ${targetPronouns.possessiveAdjective} face, and holds it there ` +
      "through the muffled struggle. When the cannon fires, " +
      `${actor.snapshot.name} carefully folds it and decides to wash it in the morning.`;

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "Smothered beneath the bedding",
        text,
        actor,
        target,
        itemChanges: [createItemUseChange(bedding.owner, bedding.item, context.eventId)],
        actorRestQuality: "comfortable",
        breakTruce: truce,
      }),
    };
  },
};

const ROCK_FROM_DARKNESS_EVENT: EventDefinition = {
  id: "night-fatal-rock-from-darkness",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.35,
  tags: ["fatal", "combat", "environment", "ambush", "status"],
  roles: createHostileRoles({
    getWeight: (tribute) => getEffectiveStats(tribute).brains,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const text =
      `${actor.snapshot.name} spots ${target.snapshot.name} sleeping beneath a rocky ledge and silently ` +
      `climbs above. After considering ${actorPronouns.possessiveAdjective} options, ` +
      `${actorPronouns.subject} pushes a large rock over the edge and listens for the splat, satisfied ` +
      `that ${actorPronouns.subject} hit the target.`;

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "Crushed by a falling rock",
        text,
        actor,
        target,
        actorStatusIds: ["hidden"],
      }),
    };
  },
};

const SNORING_PROBLEM_EVENT: EventDefinition = {
  id: "night-fatal-snoring-problem",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.3,
  tags: ["fatal", "combat", "truce", "ambush", "status"],
  roles: createStandardTruceRoles(),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const truce = requireStandardTruce(context.state, actor, target);
    const text =
      `${target.snapshot.name} begins snoring loudly enough to announce the campsite to everyone within ` +
      `several kilometres. ${actor.snapshot.name} tries shaking ${getTributePronouns(target).object} awake, covering ${getTributePronouns(target).possessiveAdjective} mouth, and ` +
      `reconsidering the entire alliance. ${actor.snapshot.name} finally cuts ${getTributePronouns(actor).possessiveAdjective} losses and smothers ` +
      `${target.snapshot.name}, enjoying an excellent night's sleep afterward.`;

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "The snoring problem",
        text,
        actor,
        target,
        actorRestQuality: "comfortable",
        actorStatusIds: ["well-rested"],
        breakTruce: truce,
      }),
    };
  },
};

const COLLAPSING_CAVE_ENTRANCE_EVENT: EventDefinition = {
  id: "night-fatal-collapsing-cave-entrance",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.3,
  tags: ["fatal", "combat", "environment", "ambush"],
  roles: createHostileRoles(
    {
      getWeight: (tribute) => getEffectiveStats(tribute).brains,
    },
    {
      isEligible: (tribute) => !hasWeapon(tribute),
    },
  ),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const text =
      `${actor.snapshot.name} discovers ${target.snapshot.name} sleeping inside a shallow cave and notices ` +
      "loose rocks above the entrance. Over the next hour, " +
      `${actor.snapshot.name} quietly rearranges the hillside until the entrance collapses over ` +
      `${target.snapshot.name}.`;

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "Buried in a collapsed cave",
        text,
        actor,
        target,
        transferLoot: false,
      }),
    };
  },
};

const SENT_TO_CHECK_NOISE_EVENT: EventDefinition = {
  id: "night-fatal-sent-to-check-noise",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.3,
  tags: ["fatal", "combat", "weapon", "item", "truce", "ambush"],
  roles: createStandardTruceRoles({
    itemAccess: "owned",
    requiredItemDefinitionIds: PIERCING_WEAPON_IDS,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const truce = requireStandardTruce(context.state, actor, target);
    const weapon = requireSelectedRoleItem(context, "actor");
    const weaponLabel = getItemLabel(weapon.item);
    const text =
      `${actor.snapshot.name} hears something moving beyond the firelight and sends ` +
      `${target.snapshot.name} to investigate. As ${target.snapshot.name} enters the trees, ` +
      `${actor.snapshot.name} draws the ${weaponLabel}, follows several steps behind, and attacks ` +
      `the moment ${target.snapshot.name} turns toward ${actorPronouns.object}.`;

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "Sent to check the noise",
        text,
        actor,
        target,
        itemChanges: [createItemUseChange(weapon.owner, weapon.item, context.eventId)],
        breakTruce: truce,
      }),
    };
  },
};

const CUT_LOOSE_FROM_TREE_EVENT: EventDefinition = {
  id: "night-fatal-cut-loose-from-tree",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.3,
  tags: ["fatal", "combat", "weapon", "item", "ambush", "status"],
  roles: createHostileRoles({
    itemAccess: "owned",
    requiredItemDefinitionIds: PIERCING_WEAPON_IDS,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const weapon = requireSelectedRoleItem(context, "actor");
    const weaponLabel = getItemLabel(weapon.item);
    const text =
      `${actor.snapshot.name} finds ${target.snapshot.name} asleep in a large tree, secured to the trunk ` +
      `with a strip of fabric. Rather than risk a fight in the branches, ${actor.snapshot.name} quietly ` +
      `cuts the knot with the ${weaponLabel}. ${target.snapshot.name} rolls once, drops through the canopy, ` +
      "and lands with a deadly thud.";

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "Cut loose from a tree",
        text,
        actor,
        target,
        itemChanges: [createItemUseChange(weapon.owner, weapon.item, context.eventId)],
        actorStatusIds: ["hidden"],
      }),
    };
  },
};

const FAKE_EMERGENCY_EVENT: EventDefinition = {
  id: "night-fatal-fake-emergency",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.35,
  tags: ["fatal", "combat", "item", "tool", "ambush"],
  roles: createHostileRoles(
    {
      getWeight: (tribute) => getEffectiveStats(tribute).brains,
    },
    {
      itemAccess: "owned",
      requiredItemDefinitionIds: REST_CAPABLE_ITEM_IDS,
    },
  ),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const shelter = requireSelectedRoleItem(context, "target");
    const text =
      `${actor.snapshot.name} races into ${target.snapshot.name}'s camp shouting that the forest is on fire. ` +
      `When ${target.snapshot.name} bolts from the shelter, ${actor.snapshot.name} trips ${getTributePronouns(target).object}, pins ${getTributePronouns(target).object} ` +
      "to the ground, and finishes the job with a twist of the neck. The forest remains disappointingly unburned.";

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "The fake emergency",
        text,
        actor,
        target,
        actorRestQuality: getRestQuality(shelter.item),
      }),
    };
  },
};

const FAKE_EMERGENCY_BOW_EVENT: EventDefinition = {
  id: "night-fatal-fake-emergency-bow",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.25,
  tags: ["fatal", "combat", "weapon", "item", "tool", "ambush"],
  roles: createHostileRoles(
    {
      itemAccess: "owned",
      requiredItemDefinitionIds: RANGED_BOW_ITEM_IDS,
    },
    {
      itemAccess: "owned",
      requiredItemDefinitionIds: REST_CAPABLE_ITEM_IDS,
    },
  ),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);
    const weapon = requireSelectedRoleItem(context, "actor");
    const shelter = requireSelectedRoleItem(context, "target");
    const text =
      `${actor.snapshot.name} races into ${target.snapshot.name}'s camp shouting that the forest is on fire. ` +
      `When ${target.snapshot.name} bolts from the shelter, ${actor.snapshot.name} shoots several arrows ` +
      `into ${targetPronouns.possessiveAdjective} back and watches surprise spread across ` +
      `${target.snapshot.name}'s face.`;

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "The fake emergency with a bow",
        text,
        actor,
        target,
        itemChanges: [createItemUseChange(weapon.owner, weapon.item, context.eventId)],
        actorRestQuality: getRestQuality(shelter.item),
      }),
    };
  },
};

const SLEEPING_BAG_CANOE_EVENT: EventDefinition = {
  id: "night-fatal-sleeping-bag-canoe",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.3,
  tags: ["fatal", "combat", "environment", "item", "tool", "ambush"],
  roles: createHostileRoles(
    {
      isEligible: (tribute) => getEffectiveStats(tribute).brawn >= 3,
      getWeight: (tribute) => getEffectiveStats(tribute).brawn,
    },
    {
      itemAccess: "owned",
      requiredItemDefinitionIds: ["sleeping-bag"],
    },
  ),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const sleepingBag = requireSelectedRoleItem(context, "target");
    const outcome = selectSuccessfulOutcome(getEffectiveStats(actor).brawn, 3, context.random);
    const text =
      outcome === "exceptional-success"
        ? `${actor.snapshot.name} finds ${target.snapshot.name} bundled tightly inside a sleeping bag beside ` +
          `the river. With one powerful pull, ${actor.snapshot.name} launches the entire bundle into the current ` +
          "and watches it glide almost gracefully over the waterfall, where the screams disappear beneath the roar."
        : `${actor.snapshot.name} finds ${target.snapshot.name} sleeping beside the river near a waterfall, ` +
          `tightly bundled inside a sleeping bag. ${actor.snapshot.name} drags the entire bundle into the current ` +
          `and watches it float over the falls as ${target.snapshot.name}'s surprised screams vanish beneath the water.`;

    return {
      text,
      changes: createFatalNightChanges(context, {
        causeLabel: "The sleeping-bag canoe",
        text,
        actor,
        target,
        actorNeeds: ["water"],
        excludedLootItemInstanceIds: new Set([sleepingBag.item.id]),
      }),
    };
  },
};

export const FATAL_NIGHT_EVENTS = [
  BETRAYAL_ON_WATCH_EVENT,
  POISONED_SHARED_MEAL_EVENT,
  CHOPPED_FROM_TREE_EVENT,
  FIRELIGHT_AMBUSH_EVENT,
  CRY_FROM_RAVINE_EVENT,
  DROWNED_AT_RIVER_EVENT,
  ROLLED_INTO_FIRE_EVENT,
  SMOTHERED_BENEATH_BLANKET_EVENT,
  ROCK_FROM_DARKNESS_EVENT,
  SNORING_PROBLEM_EVENT,
  COLLAPSING_CAVE_ENTRANCE_EVENT,
  SENT_TO_CHECK_NOISE_EVENT,
  CUT_LOOSE_FROM_TREE_EVENT,
  FAKE_EMERGENCY_EVENT,
  FAKE_EMERGENCY_BOW_EVENT,
  SLEEPING_BAG_CANOE_EVENT,
] satisfies readonly EventDefinition[];
