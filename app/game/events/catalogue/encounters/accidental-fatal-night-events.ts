import { getEffectiveStats } from "~/game/engine/effective-stats";
import {
  createEliminationChange,
  createItemUseChange,
  createKillCreditChange,
  createNightRestChanges,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
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
import type { NightRestQuality } from "~/game/survival/survival-schema";
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

const HUNTING_WEAPON_IDS = [
  "bow",
  "longbow",
  "crossbow",
  "spear",
  "trident",
] as const satisfies readonly ItemDefinitionId[];

const RANGED_WEAPON_IDS = [
  "bow",
  "longbow",
  "crossbow",
  "slingshot",
  "blowgun",
] as const satisfies readonly ItemDefinitionId[];

const MELEE_WEAPON_IDS = [
  "knife",
  "short-sword",
  "rapier",
  "longsword",
  "greatsword",
  "spear",
  "pike",
  "trident",
  "hand-axe",
  "axe",
  "club",
  "warhammer",
] as const satisfies readonly ItemDefinitionId[];

const AXE_ITEM_IDS = ["hand-axe", "axe"] as const satisfies readonly ItemDefinitionId[];

const FIRE_STARTER_ITEM_IDS = [
  "lighter",
  "matches",
  "flint-stone",
  "kindling",
] as const satisfies readonly ItemDefinitionId[];

const SHELTER_ITEM_IDS = [
  "tent",
  "tarp",
  "blanket",
  "sleeping-bag",
  "thermal-blanket",
] as const satisfies readonly ItemDefinitionId[];

const STRUCTURAL_SHELTER_ITEM_IDS = ["tent", "tarp"] as const satisfies readonly ItemDefinitionId[];

const BLANKET_FAMILY_ITEM_IDS = [
  "blanket",
  "sleeping-bag",
  "thermal-blanket",
] as const satisfies readonly ItemDefinitionId[];

interface AccidentalFatalOptions {
  causeLabel: string;
  text: string;
  actor: GameTribute;
  target: GameTribute;
  itemChanges?: readonly GameChange[];
  creditActor?: boolean;
  transferLoot?: boolean;
  breakTruce?: Truce | null;
  restQuality?: NightRestQuality;
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
      `Accidental Night event "${context.eventId}" is missing selected item role "${roleId}".`,
    );
  }

  return selection;
}

function getItemLabel(item: InventoryItem): string {
  return getItemDefinition(item.definitionId).label.toLowerCase();
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
    throw new Error("Accidental Night truce event selected incompatible tributes.");
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

function unalliedTargetEligibility(
  tribute: GameTribute,
  {
    state,
    participantsByRole,
  }: Parameters<NonNullable<ParticipantRoleDefinition["isEligible"]>>[1],
): boolean {
  const actor = participantsByRole.actor?.[0];

  return actor !== undefined && !areTributesInSameTruce(state, actor.id, tribute.id);
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
      isEligible: standardTruceTargetEligibility,
      ...targetOptions,
    },
  ];
}

function createUnalliedPairRoles(
  actorOptions: Partial<ParticipantRoleDefinition> = {},
  targetOptions: Partial<ParticipantRoleDefinition> = {},
): readonly ParticipantRoleDefinition[] {
  return [
    {
      id: "actor",
      count: 1,
      ...actorOptions,
    },
    {
      id: "target",
      count: 1,
      isEligible: unalliedTargetEligibility,
      ...targetOptions,
    },
  ];
}

function hasAccessibleShelter(state: GameState, tribute: GameTribute): boolean {
  const truce = getActiveTruceForTribute(state, tribute.id);
  const accessibleTributes = truce ? getLivingTruceMembers(state, truce) : [tribute];

  return accessibleTributes.some((member) => ownsAnyItem(member, SHELTER_ITEM_IDS));
}

function getOwnedShelterItem(
  tribute: GameTribute,
  unavailableItemInstanceIds: ReadonlySet<string> | undefined,
): InventoryItem {
  const item = tribute.inventory.find(
    (candidate) =>
      (SHELTER_ITEM_IDS as readonly ItemDefinitionId[]).includes(candidate.definitionId) &&
      !unavailableItemInstanceIds?.has(candidate.id),
  );

  if (!item) {
    throw new Error(`Tribute "${tribute.id}" is missing an available owned shelter item.`);
  }

  return item;
}

function createLootChanges(target: GameTribute, actor: GameTribute): GameChange[] {
  return target.inventory.map((item): GameChange => ({
    type: "transfer-item",
    itemInstanceId: item.id,
    fromTributeId: target.id,
    toTributeId: actor.id,
    reason: "death-loot",
  }));
}

function createAccidentalFatalChanges(
  context: EventResolutionContext,
  {
    causeLabel,
    text,
    actor,
    target,
    itemChanges = [],
    creditActor = false,
    transferLoot = false,
    breakTruce = null,
    restQuality = "sheltered",
  }: AccidentalFatalOptions,
): GameChange[] {
  if (transferLoot && !creditActor) {
    throw new Error("Death loot requires attributed kill credit.");
  }

  return [
    ...itemChanges,
    createEliminationChange(
      target,
      context.eventId,
      causeLabel,
      text,
      creditActor ? [actor.id] : [],
    ),
    ...(creditActor ? [createKillCreditChange(actor)] : []),
    ...(transferLoot ? createLootChanges(target, actor) : []),
    ...(breakTruce
      ? [
          {
            type: "break-truce" as const,
            truceId: breakTruce.id,
            reason: "accidental" as const,
          },
        ]
      : []),
    ...createNightRestChanges([actor], context.round, restQuality),
    ...createSurvivalChanges([actor]),
  ];
}

function createSelfFatalChanges(
  context: EventResolutionContext,
  actor: GameTribute,
  causeLabel: string,
  text: string,
  itemChanges: readonly GameChange[] = [],
): GameChange[] {
  return [...itemChanges, createEliminationChange(actor, context.eventId, causeLabel, text)];
}

function getFailureProbability(score: number, difficulty = 3): number {
  const advantage = score - difficulty;
  const criticalFailureWeight = Math.max(0.5, 1 - advantage * 0.5);
  const failureWeight = Math.max(1, 4 - advantage);
  const successWeight = Math.max(1, 4 + advantage);
  const exceptionalSuccessWeight = Math.max(0.5, 1 + advantage * 0.5);

  return (
    (criticalFailureWeight + failureWeight) /
    (criticalFailureWeight + failureWeight + successWeight + exceptionalSuccessWeight)
  );
}

const MISTAKEN_FOR_DINNER_EVENT: EventDefinition = {
  id: "night-accidental-mistaken-for-dinner",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.28,
  tags: ["fatal", "combat", "weapon", "item", "ambush"],
  roles: createUnalliedPairRoles({
    itemAccess: "owned",
    requiredItemDefinitionIds: HUNTING_WEAPON_IDS,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const weapon = requireSelectedRoleItem(context, "actor");
    const weaponLabel = getItemLabel(weapon.item);
    const text =
      `${actor.snapshot.name} hears something moving through the brush and attacks with the ` +
      `${weaponLabel} before it can escape. Proud of having found dinner, ${actor.snapshot.name} ` +
      `approaches the body and discovers ${target.snapshot.name} instead. ` +
      `${actor.snapshot.name} briefly weighs the pros and cons of cannibalism before heading back to camp.`;

    return {
      text,
      changes: createAccidentalFatalChanges(context, {
        causeLabel: "Mistaken for dinner",
        text,
        actor,
        target,
        itemChanges: [createItemUseChange(weapon.owner, weapon.item, context.eventId)],
        creditActor: true,
        transferLoot: true,
        restQuality: "unsheltered",
      }),
    };
  },
};

const STARTLED_OVER_EDGE_EVENT: EventDefinition = {
  id: "night-accidental-startled-over-edge",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.26,
  tags: ["fatal", "combat", "environment"],
  roles: createUnalliedPairRoles(),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const text =
      `${actor.snapshot.name} hears movement nearby and shouts, "Who goes there?!" Several loud crashes ` +
      `answer, followed by a sickly thud. ${actor.snapshot.name} investigates and discovers ` +
      `${target.snapshot.name} had stumbled backward over a cliff. ` +
      `${actor.snapshot.name} leans over the side and apologizes into the darkness.`;

    return {
      text,
      changes: createAccidentalFatalChanges(context, {
        causeLabel: "Startled over the edge",
        text,
        actor,
        target,
        creditActor: true,
      }),
    };
  },
};

const SLEEPWALKING_INTO_RIVER_EVENT: EventDefinition = {
  id: "night-accidental-sleepwalking-into-river",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.25,
  tags: ["fatal", "environment", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) =>
        tribute.statuses.some(
          (status) => status.definitionId === "exhausted" && status.severity >= 2,
        ),
      getWeight: (tribute) =>
        tribute.statuses.find((status) => status.definitionId === "exhausted")?.severity ?? 0,
    },
  ],
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const text =
      `${actor.snapshot.name} rises in the middle of the night and begins sleepwalking directly into the river. ` +
      `Lost in ${pronouns.possessiveAdjective} exhaustion, ${pronouns.subject} takes several determined ` +
      "steps beneath the surface and never wakes from the aquatic slumber.";

    return {
      text,
      changes: createSelfFatalChanges(context, actor, "Sleepwalked into the river", text),
    };
  },
};

const SMOKE_FILLED_SHELTER_EVENT: EventDefinition = {
  id: "night-accidental-smoke-filled-shelter",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.3,
  tags: ["fatal", "environment", "item", "tool"],
  getWeightMultiplier(context) {
    const eligible = context.livingTributes.filter(
      (tribute) =>
        ownsAnyItem(tribute, FIRE_STARTER_ITEM_IDS) && ownsAnyItem(tribute, SHELTER_ITEM_IDS),
    );

    if (eligible.length === 0) {
      return 0;
    }

    return (
      eligible.reduce(
        (sum, tribute) => sum + getFailureProbability(getEffectiveStats(tribute).brains),
        0,
      ) / eligible.length
    );
  },
  roles: [
    {
      id: "actor",
      count: 1,
      itemAccess: "owned",
      requiredItemDefinitionIds: FIRE_STARTER_ITEM_IDS,
      isEligible: (tribute) => ownsAnyItem(tribute, SHELTER_ITEM_IDS),
      getWeight: (tribute) =>
        Math.max(0.01, getFailureProbability(getEffectiveStats(tribute).brains)),
    },
  ],
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const fireStarter = requireSelectedRoleItem(context, "actor");
    const shelter = getOwnedShelterItem(actor, context.unavailableItemInstanceIds);
    const fireLabel = getItemLabel(fireStarter.item);
    const shelterLabel = getItemLabel(shelter);
    const text =
      `${actor.snapshot.name} worries that other tributes will see the glow from the ${fireLabel}, ` +
      `so ${pronouns.subject} brings it inside the ${shelterLabel}. The shelter remains wonderfully ` +
      `warm throughout the night as ${actor.snapshot.name} quietly suffocates.`;

    return {
      text,
      changes: createSelfFatalChanges(context, actor, "Smoke-filled shelter", text, [
        createItemUseChange(actor, shelter, context.eventId),
        createItemUseChange(fireStarter.owner, fireStarter.item, context.eventId),
      ]),
    };
  },
};

const KICKED_BURNING_LOG_EVENT: EventDefinition = {
  id: "night-accidental-kicked-burning-log",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.22,
  tags: ["fatal", "environment", "truce"],
  roles: createStandardTruceRoles(),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const pronouns = getTributePronouns(actor);
    const truce = requireStandardTruce(context.state, actor, target);
    const text =
      `${actor.snapshot.name} kicks violently in ${pronouns.possessiveAdjective} sleep and sends a burning ` +
      `log rolling across the campsite. It catches in ${target.snapshot.name}'s bedding before either tribute ` +
      `fully wakes. By the time ${actor.snapshot.name} smothers the flames, ` +
      `${target.snapshot.name} has stopped moving.`;

    return {
      text,
      changes: createAccidentalFatalChanges(context, {
        causeLabel: "Kicked burning log",
        text,
        actor,
        target,
        creditActor: true,
        breakTruce: truce,
        restQuality: "unsheltered",
      }),
    };
  },
};

const FATAL_TREE_FALL_EVENT: EventDefinition = {
  id: "night-accidental-fatal-tree-fall",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.24,
  tags: ["fatal", "environment"],
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) => !hasAccessibleShelter(state, tribute),
    },
  ],
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const text =
      `${actor.snapshot.name} climbs into a tree without testing the branches. The first snaps beneath them, ` +
      `sending ${actor.snapshot.name} through several more branches like a very painful pinball machine. ` +
      "The final impact ends both the descent and the Games.";

    return {
      text,
      changes: createSelfFatalChanges(context, actor, "Fatal tree fall", text),
    };
  },
};

const WRONG_TREE_EVENT: EventDefinition = {
  id: "night-accidental-wrong-tree",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.24,
  tags: ["fatal", "environment"],
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) => !hasAccessibleShelter(state, tribute),
    },
  ],
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const text = choose(context.random, [
      `${actor.snapshot.name} chooses a thick dead tree as protection from the wind and settles beneath ` +
        `its leaning trunk. Sometime after midnight, a loud crack wakes ${pronouns.object} just long enough ` +
        `to watch the tree fall toward ${pronouns.object}, crushing ${actor.snapshot.name}.`,
      `${actor.snapshot.name} chooses a thick dead tree as protection from the wind and settles beneath ` +
        `its branches. Sometime after midnight, a loud crack wakes ${pronouns.object} just long enough ` +
        `to watch several dead limbs plummet down, swiftly ending ${actor.snapshot.name}'s Games.`,
    ]);

    return {
      text,
      changes: createSelfFatalChanges(context, actor, "The wrong tree", text),
    };
  },
};

const ROCK_THROWN_AT_NOISE_EVENT: EventDefinition = {
  id: "night-accidental-rock-thrown-at-noise",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.27,
  tags: ["fatal", "combat", "ambush"],
  roles: createUnalliedPairRoles({
    isEligible: (tribute) => !ownsAnyItem(tribute, RANGED_WEAPON_IDS),
    getWeight: (tribute) => getEffectiveStats(tribute).luck,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const text =
      `${actor.snapshot.name} hears footsteps approaching and hurls a rock into the darkness. A surprised ` +
      `grunt is followed by a heavy collapse. When ${actor.snapshot.name} investigates, they discover ` +
      `${target.snapshot.name} lying motionless beneath a rapidly forming lump on the head.`;

    return {
      text,
      changes: createAccidentalFatalChanges(context, {
        causeLabel: "A rock thrown at the noise",
        text,
        actor,
        target,
        creditActor: true,
        transferLoot: true,
      }),
    };
  },
};

const RETURNING_WATCHKEEPER_EVENT: EventDefinition = {
  id: "night-accidental-returning-watchkeeper",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.22,
  tags: ["fatal", "combat", "weapon", "item", "truce", "ambush"],
  roles: createStandardTruceRoles({
    itemAccess: "owned",
    requiredItemDefinitionIds: MELEE_WEAPON_IDS,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const truce = requireStandardTruce(context.state, actor, target);
    const weapon = requireSelectedRoleItem(context, "actor");
    const weaponLabel = getItemLabel(weapon.item);
    const text =
      `${target.snapshot.name} returns from checking the perimeter and quietly sits beside the fire. ` +
      `${actor.snapshot.name} wakes, sees a silhouette leaning over the camp, and attacks with the ` +
      `${weaponLabel} before recognizing them. Recognition arrives only after the fatal blow.`;

    return {
      text,
      changes: createAccidentalFatalChanges(context, {
        causeLabel: "The returning watchkeeper",
        text,
        actor,
        target,
        itemChanges: [createItemUseChange(weapon.owner, weapon.item, context.eventId)],
        creditActor: true,
        transferLoot: true,
        breakTruce: truce,
      }),
    };
  },
};

const FALLING_TREE_FIREWOOD_EVENT: EventDefinition = {
  id: "night-accidental-falling-tree-firewood",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.2,
  tags: ["fatal", "environment", "weapon", "item", "truce"],
  roles: createStandardTruceRoles({
    itemAccess: "owned",
    requiredItemDefinitionIds: AXE_ITEM_IDS,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const truce = requireStandardTruce(context.state, actor, target);
    const weapon = requireSelectedRoleItem(context, "actor");
    const text =
      `${actor.snapshot.name} tries to bring down a dead tree for firewood while ` +
      `${target.snapshot.name} holds the light. The tree falls in the only direction ` +
      `${actor.snapshot.name} insisted was impossible and crushes ${target.snapshot.name} beneath ` +
      "several nights' worth of excellent fuel.";

    return {
      text,
      changes: createAccidentalFatalChanges(context, {
        causeLabel: "Falling tree while gathering firewood",
        text,
        actor,
        target,
        itemChanges: [createItemUseChange(weapon.owner, weapon.item, context.eventId)],
        breakTruce: truce,
      }),
    };
  },
};

const OVERENGINEERED_ALARM_EVENT: EventDefinition = {
  id: "night-accidental-overengineered-alarm",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.2,
  tags: ["fatal", "environment", "truce", "ambush"],
  roles: createStandardTruceRoles({
    getWeight: (tribute) => getEffectiveStats(tribute).brains,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const truce = requireStandardTruce(context.state, actor, target);
    const text = choose(context.random, [
      `While ${target.snapshot.name} is out searching for nearby camps, ${actor.snapshot.name} builds an ` +
        `elaborate alarm using sharpened branches, suspended rocks, and a trip line. ` +
        `${target.snapshot.name} returns empty-handed, misses the tripwire, and successfully proves that ` +
        "every part of the alarm works by becoming a grotesque pincushion.",
      `While ${target.snapshot.name} is out searching for nearby camps, ${actor.snapshot.name} builds an ` +
        `elaborate alarm using sharpened branches, suspended rocks, and a trip line. ` +
        `${target.snapshot.name} returns unaware of the wire and successfully proves the rock portion ` +
        "of the alarm works by becoming a pulpy pile beneath it.",
    ]);

    return {
      text,
      changes: createAccidentalFatalChanges(context, {
        causeLabel: "The overengineered alarm",
        text,
        actor,
        target,
        creditActor: true,
        breakTruce: truce,
      }),
    };
  },
};

const OVERLOADED_SHELTER_EVENT: EventDefinition = {
  id: "night-accidental-overloaded-shelter",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.22,
  tags: ["fatal", "environment", "item", "tool"],
  roles: createUnalliedPairRoles({
    itemAccess: "owned",
    requiredItemDefinitionIds: STRUCTURAL_SHELTER_ITEM_IDS,
  }),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);
    const shelter = requireSelectedRoleItem(context, "actor");
    const shelterLabel = getItemLabel(shelter.item);
    const text = choose(context.random, [
      `${actor.snapshot.name} finishes setting up the ${shelterLabel} when ${target.snapshot.name} appears ` +
        `from the woods. After a moment's hesitation, ${actor.snapshot.name} offers to share. During the ` +
        `night, the central support snaps and pierces ${target.snapshot.name}, Final Destination-style, ` +
        `before the shelter collapses. ${actor.snapshot.name} feels terrible for inviting ` +
        `${targetPronouns.object} inside.`,
      `${actor.snapshot.name} offers ${target.snapshot.name} space beneath the ${shelterLabel} and suggests ` +
        `adding branches and leaves for camouflage. In the middle of the night, the overloaded central ` +
        `support snaps and pierces ${target.snapshot.name}, Final Destination-style, before the entire ` +
        `shelter collapses around them. ${actor.snapshot.name} quietly leaves the ruined camp.`,
    ]);

    return {
      text,
      changes: createAccidentalFatalChanges(context, {
        causeLabel: "Overloaded shelter collapse",
        text,
        actor,
        target,
        itemChanges: [createItemUseChange(shelter.owner, shelter.item, context.eventId)],
        restQuality: "unsheltered",
      }),
    };
  },
};

const BURNING_BLANKET_EVENT: EventDefinition = {
  id: "night-accidental-burning-blanket-panic",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.19,
  tags: ["fatal", "environment", "item", "tool", "truce"],
  roles: createStandardTruceRoles(
    {
      requiredItemDefinitionIds: FIRE_STARTER_ITEM_IDS,
    },
    {
      itemAccess: "owned",
      requiredItemDefinitionIds: BLANKET_FAMILY_ITEM_IDS,
    },
  ),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const truce = requireStandardTruce(context.state, actor, target);
    const fireStarter = requireSelectedRoleItem(context, "actor");
    const blanket = requireSelectedRoleItem(context, "target");
    const blanketLabel = getItemLabel(blanket.item);
    const text =
      `${actor.snapshot.name} and ${target.snapshot.name} huddle around a campfire and try to sleep. ` +
      `A spark lands on ${target.snapshot.name}'s ${blanketLabel} and quickly catches fire. ` +
      `${actor.snapshot.name} panics and tries to beat out the flames with a burning branch. This is ` +
      `less helpful than intended. By the time the fire is extinguished, so is ${target.snapshot.name}.`;

    return {
      text,
      changes: createAccidentalFatalChanges(context, {
        causeLabel: "Burning blanket panic",
        text,
        actor,
        target,
        itemChanges: [createItemUseChange(fireStarter.owner, fireStarter.item, context.eventId)],
        breakTruce: truce,
        restQuality: "unsheltered",
      }),
    };
  },
};

const BOTH_SWING_AT_ONCE_EVENT: EventDefinition = {
  id: "night-accidental-both-swing-at-once",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.24,
  tags: ["fatal", "combat", "weapon", "item", "ambush"],
  roles: createUnalliedPairRoles(
    {
      itemAccess: "owned",
      requiredItemDefinitionIds: MELEE_WEAPON_IDS,
    },
    {
      itemAccess: "owned",
      requiredItemDefinitionIds: MELEE_WEAPON_IDS,
    },
  ),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorWeapon = requireSelectedRoleItem(context, "actor");
    const targetWeapon = requireSelectedRoleItem(context, "target");
    const actorWeaponLabel = getItemLabel(actorWeapon.item);
    const text =
      `${actor.snapshot.name} and ${target.snapshot.name} hear each other moving through the darkness. ` +
      `Both swing toward the sound at exactly the same moment. ${actor.snapshot.name}'s ` +
      `${actorWeaponLabel} connects first, cleaving ${target.snapshot.name}'s head from their body ` +
      "with a look of surprise still showing.";

    return {
      text,
      changes: createAccidentalFatalChanges(context, {
        causeLabel: "Both swung at once",
        text,
        actor,
        target,
        itemChanges: [
          createItemUseChange(actorWeapon.owner, actorWeapon.item, context.eventId),
          createItemUseChange(targetWeapon.owner, targetWeapon.item, context.eventId),
        ],
        creditActor: true,
        transferLoot: true,
        restQuality: "unsheltered",
      }),
    };
  },
};

const PUSHED_WHILE_DREAMING_EVENT: EventDefinition = {
  id: "night-accidental-pushed-while-dreaming",
  category: "fatal",
  periods: ["night"],
  baseWeight: 0.21,
  tags: ["fatal", "environment", "truce"],
  roles: createStandardTruceRoles(),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const truce = requireStandardTruce(context.state, actor, target);
    const text =
      `${actor.snapshot.name} dreams that something is attacking the campsite and shoves it away with both ` +
      `hands. Unfortunately, the something is ${target.snapshot.name}, and the campsite is beside a steep ` +
      `slope. ${actor.snapshot.name} wakes in time to hear ${target.snapshot.name} reach the bottom.`;

    return {
      text,
      changes: createAccidentalFatalChanges(context, {
        causeLabel: "Pushed while dreaming",
        text,
        actor,
        target,
        breakTruce: truce,
      }),
    };
  },
};

export const ACCIDENTAL_FATAL_NIGHT_EVENTS = [
  MISTAKEN_FOR_DINNER_EVENT,
  STARTLED_OVER_EDGE_EVENT,
  SLEEPWALKING_INTO_RIVER_EVENT,
  SMOKE_FILLED_SHELTER_EVENT,
  KICKED_BURNING_LOG_EVENT,
  FATAL_TREE_FALL_EVENT,
  WRONG_TREE_EVENT,
  ROCK_THROWN_AT_NOISE_EVENT,
  RETURNING_WATCHKEEPER_EVENT,
  FALLING_TREE_FIREWOOD_EVENT,
  OVERENGINEERED_ALARM_EVENT,
  OVERLOADED_SHELTER_EVENT,
  BURNING_BLANKET_EVENT,
  BOTH_SWING_AT_ONCE_EVENT,
  PUSHED_WHILE_DREAMING_EVENT,
] satisfies readonly EventDefinition[];
