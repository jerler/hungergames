import { getEffectiveStats } from "~/game/engine/effective-stats";
import { getCombatScore } from "~/game/engine/stat-formulas";
import {
  createItemUseChange,
  createNightRestChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { resolveScoreCheck } from "~/game/events/event-outcomes";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type EventItemSelection,
  type EventResolution,
  type EventResolutionContext,
  type EventTag,
  type ParticipantRoleDefinition,
} from "~/game/events/event-schema";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { NightRestQuality } from "~/game/survival/survival-schema";
import {
  createTruceInstance,
  getActiveTruceForTribute,
  getLivingTruceMembers,
  canStandardTrucePersist,
  STANDARD_TRUCE_EXPIRY_ROUND,
} from "~/game/truces/truce-engine";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type {
  GameChange,
  GameState,
  GameTribute,
  RoundReference,
  Truce,
} from "~/game/types/game-state";

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

const COMFORTABLE_SHELTER_ITEM_IDS = new Set<ItemDefinitionId>([
  "blanket",
  "sleeping-bag",
  "thermal-blanket",
]);

const NO_SHELTER_ITEM_IDS = new Set<ItemDefinitionId>([...SHELTER_ITEM_IDS, "pillow"]);

interface RestEntry {
  tribute: GameTribute;
  quality: NightRestQuality;
}

interface StatusApplication {
  tribute: GameTribute;
  statusId: StatusEffectId;
  severity?: 1 | 2 | 3;
  sourceTributeId?: string | null;
}

function choose<T>(random: EventResolutionContext["random"], values: readonly T[]): T {
  const index = Math.min(values.length - 1, Math.floor(random() * values.length));
  const value = values[index];

  if (value === undefined) {
    throw new Error("Cannot choose from an empty collection.");
  }

  return value;
}

function mergeTags(...groups: readonly (readonly EventTag[])[]): EventTag[] {
  return [...new Set(groups.flat())];
}

function hasStatus(tribute: GameTribute, statusId: StatusEffectId): boolean {
  return tribute.statuses.some((status) => status.definitionId === statusId);
}

function hasOwnedItem(tribute: GameTribute, itemId: ItemDefinitionId): boolean {
  return tribute.inventory.some((item) => item.definitionId === itemId);
}

function hasAnyOwnedItem(
  tribute: GameTribute,
  itemIds: ReadonlySet<ItemDefinitionId> | readonly ItemDefinitionId[],
): boolean {
  const ids = itemIds instanceof Set ? itemIds : new Set(itemIds);
  return tribute.inventory.some((item) => ids.has(item.definitionId));
}

function getSelectedRoleItem(
  context: EventResolutionContext,
  roleId: string,
): EventItemSelection | null {
  return context.itemsByRole?.[roleId]?.[0] ?? null;
}

function createRestChanges(
  context: EventResolutionContext,
  rests: readonly RestEntry[],
  statuses: readonly StatusApplication[] = [],
  extraChanges: readonly GameChange[] = [],
): GameChange[] {
  const uniqueTributes = new Map(rests.map(({ tribute }) => [tribute.id, tribute] as const));

  return [
    ...rests.flatMap(({ tribute, quality }) =>
      createNightRestChanges([tribute], context.round, quality),
    ),
    ...statuses.map(({ tribute, statusId, severity = 1, sourceTributeId = null }) =>
      createStatusChange(
        context.eventId,
        tribute,
        statusId,
        severity,
        context.round,
        undefined,
        sourceTributeId === tribute.id ? null : sourceTributeId,
      ),
    ),
    ...extraChanges,
    ...createSurvivalChanges([...uniqueTributes.values()]),
  ];
}

function createRemoveStatusChanges(tribute: GameTribute, statusId: StatusEffectId): GameChange[] {
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

function getShelterQuality(itemId: ItemDefinitionId): NightRestQuality {
  return COMFORTABLE_SHELTER_ITEM_IDS.has(itemId) ? "comfortable" : "sheltered";
}

function requireSameTruce(
  state: GameState,
  tributes: readonly GameTribute[],
  expectedKind?: Truce["kind"],
): Truce {
  const first = tributes[0];

  if (!first) {
    throw new Error("A truce event requires at least one tribute.");
  }

  const truce = getActiveTruceForTribute(state, first.id);

  if (!truce || (expectedKind && truce.kind !== expectedKind)) {
    throw new Error("A night relationship event selected incompatible tributes.");
  }

  if (!tributes.every((tribute) => truce.tributeIds.includes(tribute.id))) {
    throw new Error("A night relationship event selected tributes from different truces.");
  }

  return truce;
}

function alliedGroupRole(count: number): ParticipantRoleDefinition {
  return {
    id: "tributes",
    count,
    isEligible: (tribute, { state, participantsByRole }) => {
      const selected = participantsByRole.tributes ?? [];

      if (selected.length === 0) {
        const truce = getActiveTruceForTribute(state, tribute.id);
        return truce !== null && getLivingTruceMembers(state, truce).length >= count;
      }

      const anchor = selected[0];
      const truce = anchor ? getActiveTruceForTribute(state, anchor.id) : null;
      return truce?.tributeIds.includes(tribute.id) ?? false;
    },
  };
}

function compatiblePairRole(): ParticipantRoleDefinition {
  return {
    id: "tributes",
    count: 2,
    isEligible: (tribute, { state, participantsByRole }) => {
      const selected = participantsByRole.tributes ?? [];

      if (selected.length === 0) {
        const truce = getActiveTruceForTribute(state, tribute.id);
        return truce === null || getLivingTruceMembers(state, truce).length >= 2;
      }

      const first = selected[0];
      if (!first) {
        return false;
      }

      const firstTruce = getActiveTruceForTribute(state, first.id);
      const candidateTruce = getActiveTruceForTribute(state, tribute.id);

      return firstTruce ? firstTruce.tributeIds.includes(tribute.id) : candidateTruce === null;
    },
  };
}

function untrucedPairRoles(): readonly ParticipantRoleDefinition[] {
  return [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) => getActiveTruceForTribute(state, tribute.id) === null,
    },
    {
      id: "target",
      count: 1,
      isEligible: (tribute, { state }) => getActiveTruceForTribute(state, tribute.id) === null,
    },
  ];
}

function createStandardTruceChange(
  eventId: string,
  round: RoundReference,
  tributeIds: readonly string[],
): GameChange {
  return {
    type: "form-truce",
    truce: createTruceInstance(eventId, tributeIds, round, STANDARD_TRUCE_EXPIRY_ROUND),
  };
}

function createRomanticTruceChange(
  eventId: string,
  round: RoundReference,
  tributeIds: readonly [string, string],
): GameChange {
  return {
    type: "form-truce",
    truce: createTruceInstance(eventId, tributeIds, round, null, "romantic"),
  };
}

interface StaticSoloNightEventOptions {
  id: string;
  weight: number;
  quality: NightRestQuality;
  texts: readonly ((actor: GameTribute) => string)[];
  statuses?: readonly StatusEffectId[];
  tags?: readonly EventTag[];
  isEligible?: ParticipantRoleDefinition["isEligible"];
  getWeight?: ParticipantRoleDefinition["getWeight"];
}

function createStaticSoloNightEvent({
  id,
  weight,
  quality,
  texts,
  statuses = [],
  tags = [],
  isEligible,
  getWeight,
}: StaticSoloNightEventOptions): EventDefinition {
  return {
    id,
    category: "survival",
    periods: ["night"],
    baseWeight: weight,
    tags: mergeTags(["survival"], statuses.length > 0 ? ["status"] : [], tags),
    roles: [
      {
        id: "actor",
        count: 1,
        isEligible,
        getWeight,
      },
    ],
    resolve(context): EventResolution {
      const actor = requireSingleParticipant(context.participantsByRole, "actor");
      return {
        text: choose(context.random, texts)(actor),
        changes: createRestChanges(
          context,
          [{ tribute: actor, quality }],
          statuses.map((statusId) => ({ tribute: actor, statusId })),
        ),
      };
    },
  };
}

interface AlliedNightEventOptions {
  id: string;
  count: number;
  weight: number;
  quality?: NightRestQuality;
  tags?: readonly EventTag[];
  statuses?: readonly StatusEffectId[];
  texts: readonly ((tributes: readonly GameTribute[]) => string)[];
}

function createAlliedNightEvent({
  id,
  count,
  weight,
  quality = "sheltered",
  tags = [],
  statuses = [],
  texts,
}: AlliedNightEventOptions): EventDefinition {
  return {
    id,
    category: "survival",
    periods: ["night"],
    baseWeight: weight,
    tags: mergeTags(
      ["survival", "cooperative", "truce"],
      statuses.length > 0 ? ["status"] : [],
      tags,
    ),
    roles: [alliedGroupRole(count)],
    resolve(context): EventResolution {
      const tributes = requireParticipants(context.participantsByRole, "tributes");

      if (tributes.length !== count) {
        throw new Error(`Event "${id}" requires exactly ${count} tributes.`);
      }

      requireSameTruce(context.state, tributes);

      return {
        text: choose(context.random, texts)(tributes),
        changes: createRestChanges(
          context,
          tributes.map((tribute) => ({ tribute, quality })),
          tributes.flatMap((tribute) => statuses.map((statusId) => ({ tribute, statusId }))),
        ),
      };
    },
  };
}

function resolveFireStarting(context: EventResolutionContext): EventResolution {
  const actor = requireSingleParticipant(context.participantsByRole, "actor");
  const pronouns = getTributePronouns(actor);
  const selectedFireItem = getSelectedRoleItem(context, "actor");
  const itemBonus = (() => {
    switch (selectedFireItem?.item.definitionId) {
      case "lighter":
        return 2;
      case "matches":
        return 1.25;
      case "flint-stone":
        return 0.75;
      case "kindling":
        return 0.5;
      default:
        return 0;
    }
  })();
  const outcome = resolveScoreCheck({
    score: getEffectiveStats(actor).brains + itemBonus,
    difficulty: 3,
    random: context.random,
  });
  const itemChanges = selectedFireItem
    ? [createItemUseChange(selectedFireItem.owner, selectedFireItem.item, "night-starting-fire")]
    : [];

  switch (outcome) {
    case "critical-failure": {
      const text =
        `${actor.snapshot.name} piles dry leaves beneath a tower of branches and proudly lights ` +
        `the centre. The entire structure immediately collapses into the surrounding brush, ` +
        `forcing ${actor.snapshot.name} to hurriedly slap out the fire with ` +
        `${pronouns.possessiveAdjective} bare hands.`;
      return {
        text,
        changes: createRestChanges(
          context,
          [{ tribute: actor, quality: "unsheltered" }],
          [{ tribute: actor, statusId: "burned" }],
          itemChanges,
        ),
      };
    }
    case "failure": {
      const text =
        `${actor.snapshot.name} strikes sparks into damp kindling until ` +
        `${pronouns.subject} finally ${pronouns.havePresent === "has" ? "gives" : "give"} up ` +
        "and decides to just shiver through the night.";
      return {
        text,
        changes: createRestChanges(
          context,
          [{ tribute: actor, quality: "unsheltered" }],
          [],
          itemChanges,
        ),
      };
    }
    case "success": {
      const text =
        `${actor.snapshot.name} shields a small fire between two rocks, feeding it one branch ` +
        `at a time so it stays warm without becoming a glowing invitation to find and murder ` +
        `${pronouns.object}.`;
      return {
        text,
        changes: createRestChanges(
          context,
          [{ tribute: actor, quality: "sheltered" }],
          [],
          itemChanges,
        ),
      };
    }
    case "exceptional-success": {
      const text = choose(context.random, [
        `${actor.snapshot.name} notices the direction of the wind, digs a shallow fire pit, and ` +
          `builds a nearly smokeless fire inside it. Warm, hidden, and feeling extremely clever, ` +
          `${actor.snapshot.name} sleeps beside it until morning.`,
        `${actor.snapshot.name} builds a tiny fire beneath an overhanging rock, reflects the heat ` +
          `back into ${pronouns.possessiveAdjective} shelter, and sleeps like a baked potato tucked ` +
          "safely into the hillside.",
      ]);
      return {
        text,
        changes: createRestChanges(
          context,
          [{ tribute: actor, quality: "comfortable" }],
          [{ tribute: actor, statusId: "hidden" }],
          itemChanges,
        ),
      };
    }
  }
}

const STARTING_FIRE_EVENT: EventDefinition = {
  id: "night-starting-fire",
  category: "survival",
  periods: ["night"],
  baseWeight: 4,
  tags: ["survival", "status", "item", "tool"],
  roles: [
    {
      id: "actor",
      count: 1,
      optionalItemDefinitionIds: FIRE_STARTER_ITEM_IDS,
      optionalItemAccess: "owned",
      getWeight: (tribute) => getEffectiveStats(tribute).brains,
    },
  ],
  resolve: resolveFireStarting,
};

const SETTING_UP_CAMP_EVENT: EventDefinition = {
  id: "night-setting-up-camp",
  category: "survival",
  periods: ["night"],
  baseWeight: 4,
  tags: ["survival", "status", "item", "tool"],
  roles: [
    {
      id: "actor",
      count: 1,
      optionalItemDefinitionIds: SHELTER_ITEM_IDS,
      optionalItemAccess: "owned",
      getWeight: (tribute) => getEffectiveStats(tribute).brains,
    },
  ],
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const selectedShelter = getSelectedRoleItem(context, "actor");
    const itemBonus = selectedShelter
      ? selectedShelter.item.definitionId === "tent"
        ? 2
        : selectedShelter.item.definitionId === "tarp"
          ? 1.5
          : 1
      : 0;
    const outcome = resolveScoreCheck({
      score: getEffectiveStats(actor).brains + itemBonus,
      difficulty: 3,
      random: context.random,
    });
    const itemChanges = selectedShelter
      ? [createItemUseChange(selectedShelter.owner, selectedShelter.item, "night-setting-up-camp")]
      : [];

    if (outcome === "critical-failure" || outcome === "failure") {
      return {
        text:
          `${actor.snapshot.name} sets up camp on a patch of ground that looks perfectly flat. ` +
          `The moment ${pronouns.subject} ${pronouns.subject === "they" ? "lie" : "lies"} down, ` +
          `every rock, root, and ancient buried pinecone jabs itself into ` +
          `${actor.snapshot.name}'s behind.`,
        changes: createRestChanges(
          context,
          [{ tribute: actor, quality: "unsheltered" }],
          [],
          itemChanges,
        ),
      };
    }

    if (outcome === "success") {
      return {
        text:
          `${actor.snapshot.name} clears a campsite beneath the trees, hides the entrance behind ` +
          "fallen branches, and settles in before the temperature drops.",
        changes: createRestChanges(
          context,
          [{ tribute: actor, quality: "sheltered" }],
          [],
          itemChanges,
        ),
      };
    }

    return {
      text: choose(context.random, [
        `${actor.snapshot.name} finds a dry hollow with a clear escape route, disguises the entrance ` +
          "with moss, and builds a makeshift bed from pine needles. For one suspiciously comfortable " +
          "night, the arena feels almost like camping.",
        `${actor.snapshot.name} chooses a campsite beneath thick tree cover, strings a silent alarm ` +
          "around the perimeter made out of pinecones and an empty tin can, and sleeps more safely " +
          "than anyone in the arena has a right to.",
      ]),
      changes: createRestChanges(
        context,
        [{ tribute: actor, quality: "comfortable" }],
        [{ tribute: actor, statusId: "alert" }],
        itemChanges,
      ),
    };
  },
};

const BECOMING_LOST_EVENT = createStaticSoloNightEvent({
  id: "night-becoming-lost",
  weight: 1.5,
  quality: "unsheltered",
  statuses: ["disoriented"],
  isEligible: (tribute) => tribute.snapshot.stats.brains <= 3,
  getWeight: (tribute) => Math.max(0.25, 5 - tribute.snapshot.stats.brains),
  texts: [
    (actor) =>
      `${actor.snapshot.name} follows what ${getTributePronouns(actor).subject} believes is a ` +
      "familiar trail until passing the same unsettlingly shaped tree for the fourth time. Rather " +
      `than admit defeat, ${actor.snapshot.name} continues walking in increasingly confident ` +
      "circles, eventually becoming disoriented.",
    (actor) =>
      `${actor.snapshot.name} tries navigating by the stars, chooses the brightest one, and walks ` +
      "directly away from every recognizable landmark.",
  ],
});

const SLEEPING_IN_TREE_EVENT: EventDefinition = {
  id: "night-sleeping-in-tree",
  category: "survival",
  periods: ["night"],
  baseWeight: 3,
  tags: ["survival", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      getWeight: (tribute) =>
        (getEffectiveStats(tribute).brains + getEffectiveStats(tribute).luck) / 2,
    },
  ],
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const { brains, luck } = getEffectiveStats(actor);
    const outcome = resolveScoreCheck({
      score: (brains + luck) / 2,
      difficulty: 3,
      random: context.random,
    });

    switch (outcome) {
      case "critical-failure":
        return {
          text:
            `${actor.snapshot.name} climbs into a tree without testing the branches. The first one ` +
            `snaps beneath ${pronouns.object}, sending ${actor.snapshot.name} through several more ` +
            "branches on the way down like a very painful pinball machine. " +
            `${pronouns.Subject} ${pronouns.subject === "they" ? "decide" : "decides"} to sleep at the bottom.`,
          changes: createRestChanges(
            context,
            [{ tribute: actor, quality: "unsheltered" }],
            [{ tribute: actor, statusId: "injured", severity: 2 }],
          ),
        };
      case "failure":
        return {
          text:
            `${actor.snapshot.name} wedges ${pronouns.reflexive} between two branches and spends the ` +
            "night discovering that 1) bark is sharp, 2) branches sway, and 3) legs can apparently " +
            "fall asleep independently.",
          changes: createRestChanges(context, [{ tribute: actor, quality: "unsheltered" }]),
        };
      case "success":
        return {
          text: choose(context.random, [
            `${actor.snapshot.name} finds a sturdy tree and ties ${pronouns.reflexive} between two ` +
              "broad branches, sleeping safely above anyone travelling below.",
            `${actor.snapshot.name} climbs into the canopy, curls into the fork of a sturdy tree, ` +
              "and becomes indistinguishable from an unusually nervous bundle of leaves.",
          ]),
          changes: createRestChanges(
            context,
            [{ tribute: actor, quality: "sheltered" }],
            [{ tribute: actor, statusId: "hidden" }],
          ),
        };
      case "exceptional-success":
        return {
          text:
            `${actor.snapshot.name} selects a tree with dense leaves, tests every branch before ` +
            `trusting it, and secures ${pronouns.reflexive} tightly enough to sleep without ` +
            `${pronouns.possessiveAdjective} death. This is what passes for luxury now.`,
          changes: createRestChanges(
            context,
            [{ tribute: actor, quality: "comfortable" }],
            [{ tribute: actor, statusId: "hidden" }],
          ),
        };
    }
  },
};

const COMFORTABLE_BUSH_EVENT: EventDefinition = {
  id: "night-comfortable-bush",
  category: "survival",
  periods: ["night"],
  baseWeight: 2.5,
  tags: ["survival", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      getWeight: (tribute) =>
        (getEffectiveStats(tribute).brains + getEffectiveStats(tribute).luck) / 2,
    },
  ],
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const { brains, luck } = getEffectiveStats(actor);
    const outcome = resolveScoreCheck({
      score: (brains + luck) / 2,
      difficulty: 3,
      random: context.random,
    });

    if (outcome === "critical-failure" || outcome === "failure") {
      return {
        text:
          `${actor.snapshot.name} crawls beneath a promising bush looking for shelter and discovers ` +
          "too late that every branch points inward and something small already lives there.",
        changes: createRestChanges(context, [{ tribute: actor, quality: "unsheltered" }]),
      };
    }

    if (outcome === "success") {
      return {
        text: choose(context.random, [
          `${actor.snapshot.name} finds a thick, sheltered bush, crawls into the hollow beneath it, ` +
            "and curls up for a surprisingly safe night's rest.",
          `${actor.snapshot.name} finds a bush with a soft patch shaped almost exactly like ` +
            `${pronouns.reflexive} and decides not to question the blessing.`,
        ]),
        changes: createRestChanges(
          context,
          [{ tribute: actor, quality: "sheltered" }],
          [{ tribute: actor, statusId: "hidden" }],
        ),
      };
    }

    return {
      text:
        `${actor.snapshot.name} discovers a hollow beneath a dense flowering bush, lines it with ` +
        `dry leaves, and disappears so completely that even a rabbit fails to notice ${pronouns.object} before ` +
        "curling up in the burrow right next door.",
      changes: createRestChanges(
        context,
        [{ tribute: actor, quality: "comfortable" }],
        [{ tribute: actor, statusId: "hidden" }],
      ),
    };
  },
};

const SIMPLY_SLEEPING_EVENT = createStaticSoloNightEvent({
  id: "night-simply-sleeping",
  weight: 3,
  quality: "sheltered",
  texts: [
    (actor) =>
      `${actor.snapshot.name} finds the least threatening patch of ground available, lies down, ` +
      "and goes to sleep despite every instinct screaming that this is an objectively terrible idea.",
    (actor) =>
      `${actor.snapshot.name} wraps ${getTributePronouns(actor).reflexive} in whatever fabric is ` +
      'available and falls asleep almost immediately, deciding "if I die, I die," which ' +
      "somehow works and produces a perfectly decent night's sleep.",
  ],
});

const TELLING_STORIES_EVENT = createAlliedNightEvent({
  id: "night-telling-stories",
  count: 2,
  weight: 2,
  texts: [
    ([actor, target]) =>
      `${actor?.snapshot.name} and ${target?.snapshot.name} trade stories about their lives before ` +
      "the Games. Both laugh more loudly than they should and carefully avoid discussing what " +
      "happens if they are the final two.",
    ([actor, target]) =>
      `${actor?.snapshot.name} tells ${target?.snapshot.name} a story from home. ` +
      `${target?.snapshot.name} responds with one that is clearly exaggerated, forcing ` +
      `${actor?.snapshot.name} to exaggerate the next one even more.`,
  ],
});

const SLEEPING_SHIFTS_TWO_EVENT = createAlliedNightEvent({
  id: "night-sleeping-shifts-two",
  count: 2,
  weight: 2.5,
  statuses: ["alert"],
  texts: [
    ([actor, target]) =>
      `${actor?.snapshot.name} and ${target?.snapshot.name} agree to sleep in shifts. Each spends ` +
      "their watch repeatedly checking that the other is still breathing and not quietly stealing everything.",
    ([actor, target]) =>
      `${actor?.snapshot.name} takes the first watch while ${target?.snapshot.name} sleeps. Halfway ` +
      "through the night they trade places without either admitting how relieved they are that the other kept their promise.",
  ],
});

const SLEEPING_SHIFTS_THREE_EVENT = createAlliedNightEvent({
  id: "night-sleeping-shifts-three",
  count: 3,
  weight: 1.7,
  statuses: ["alert"],
  texts: [
    ([actor, target, ally]) =>
      `${actor?.snapshot.name}, ${target?.snapshot.name}, and ${ally?.snapshot.name} divide the night ` +
      "into watches. Two sleep while the third guards the camp, creating a schedule so complicated " +
      "that they spend several minutes arguing over whose turn it currently is.",
    ([actor, target, ally]) =>
      `${actor?.snapshot.name}, ${target?.snapshot.name}, and ${ally?.snapshot.name} sleep in shifts. ` +
      "Nobody gets much rest, but everyone becomes extremely familiar with the sound of the other two snoring.",
  ],
});

const SLEEPING_SHIFTS_FOUR_EVENT = createAlliedNightEvent({
  id: "night-sleeping-shifts-four",
  count: 4,
  weight: 1.2,
  statuses: ["alert"],
  texts: [
    ([actor, target, ally, bystander]) =>
      `${actor?.snapshot.name}, ${target?.snapshot.name}, ${ally?.snapshot.name}, and ` +
      `${bystander?.snapshot.name} surround their campsite and sleep in shifts. With four sets of ` +
      "eyes watching the woods, no one dares approach.",
    ([actor, target, ally, bystander]) =>
      `${actor?.snapshot.name}, ${target?.snapshot.name}, ${ally?.snapshot.name}, and ` +
      `${bystander?.snapshot.name} create an elaborate watch schedule, immediately lose track of it, ` +
      "and settle for waking whoever snores the loudest.",
  ],
});

const NATURAL_WOUND_TREATMENT_EVENT: EventDefinition = {
  id: "night-natural-wound-treatment",
  category: "survival",
  periods: ["night"],
  baseWeight: 2.5,
  tags: ["survival", "status"],
  recoveryProfile: {
    targets: [
      {
        kind: "status",
        roleId: "actor",
        statusIds: ["injured"],
      },
    ],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => hasStatus(tribute, "injured"),
    },
  ],
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    return {
      text:
        `${actor.snapshot.name} examines ${getTributePronouns(actor).possessiveAdjective} wounds by ` +
        "firelight, uses water to clean away the blood, and binds everything tightly with grass " +
        "to survive another day.",
      changes: createRestChanges(
        context,
        [{ tribute: actor, quality: "sheltered" }],
        [],
        createRemoveStatusChanges(actor, "injured"),
      ),
    };
  },
};

const SEEING_DISTANT_FIRE_EVENT = createStaticSoloNightEvent({
  id: "night-seeing-distant-fire",
  weight: 2,
  quality: "sheltered",
  statuses: ["hidden"],
  getWeight: (tribute) => getEffectiveStats(tribute).brains,
  texts: [
    (actor) =>
      `${actor.snapshot.name} sees firelight flickering between the trees and considers approaching. ` +
      `After imagining every possible person who might be sitting beside it, ${actor.snapshot.name} ` +
      "quietly backs away.",
    (actor) =>
      `${actor.snapshot.name} spots smoke rising above the trees. Warmth sounds nice, but not nice ` +
      `enough to introduce ${getTributePronouns(actor).reflexive} to whoever is confidently broadcasting a campsite's location.`,
  ],
});

const SCREAMING_FOR_HELP_EVENT = createStaticSoloNightEvent({
  id: "night-screaming-for-help",
  weight: 1,
  quality: "unsheltered",
  statuses: ["hunted"],
  tags: ["hazard"],
  texts: [
    (actor) =>
      `${actor.snapshot.name} sees something moving in the darkness and tries to attack, but loses ` +
      `${getTributePronouns(actor).possessiveAdjective} nerve and screams out in terror before running away.`,
    (actor) =>
      `${actor.snapshot.name} sees something moving in the darkness and calls out with an offer to ` +
      "share watch overnight. No one answers, but something large starts charging toward " +
      `${getTributePronouns(actor).object}. Terrified, ${actor.snapshot.name} runs in the opposite direction until collapsing from ` +
      "exhaustion as the sun starts to rise.",
  ],
});

const STAYING_AWAKE_EVENT = createStaticSoloNightEvent({
  id: "night-staying-awake",
  weight: 1.7,
  quality: "unsheltered",
  texts: [
    (actor) =>
      `${actor.snapshot.name} stays awake all night, reacting to every snapped twig, falling leaf, ` +
      "distant owl, and suspiciously aggressive cricket.",
    (actor) =>
      `${actor.snapshot.name} promises to close ${getTributePronouns(actor).possessiveAdjective} eyes for only a second, immediately hears ` +
      "something move nearby, and spends the rest of the night staring into the darkness with a weapon in hand.",
  ],
});

const PASSING_OUT_EXHAUSTED_EVENT = createStaticSoloNightEvent({
  id: "night-passing-out-exhausted",
  weight: 2.2,
  quality: "unsheltered",
  isEligible: (tribute) => hasStatus(tribute, "exhausted"),
  texts: [
    (actor) =>
      `${actor.snapshot.name} tries to find shelter but falls asleep while still walking, collapsing ` +
      `beneath the first tree that does not actively reject ${getTributePronouns(actor).object}.`,
    (actor) =>
      `${actor.snapshot.name} sits down for one moment to rest ${getTributePronouns(actor).possessiveAdjective} legs and wakes several hours ` +
      `later in exactly the same position, still holding a branch ${getTributePronouns(actor).subject} apparently mistook for a weapon.`,
  ],
});

const COOKING_PROVISIONS_EVENT: EventDefinition = {
  id: "night-cooking-provisions",
  category: "survival",
  periods: ["night"],
  baseWeight: 2.5,
  tags: ["survival", "deprivation", "item", "tool"],
  roles: [
    {
      id: "actor",
      count: 1,
      requiredItemDefinitionIds: FIRE_STARTER_ITEM_IDS,
      itemAccess: "owned",
      isEligible: (tribute) => hasOwnedItem(tribute, "cornucopia-provisions"),
    },
  ],
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const fireStarter = getSelectedRoleItem(context, "actor");

    if (!fireStarter) {
      throw new Error("Cooking Cornucopia provisions requires a selected fire starter.");
    }

    return {
      text: choose(context.random, [
        `${actor.snapshot.name} cooks ${getTributePronouns(actor).possessiveAdjective} food over a small fire, eats every piece that looks ` +
          "remotely edible, and buries the embers before sleeping.",
        `${actor.snapshot.name} carefully cooks ${getTributePronouns(actor).possessiveAdjective} food, burns one side, drops another piece into ` +
          "the fire, and declares the remaining portion a complete success.",
        `${actor.snapshot.name} cooks ${getTributePronouns(actor).possessiveAdjective} food slowly over hot stones, seasons it with herbs found ` +
          "nearby, and gives the meal a chef's kiss before chowing down.",
      ]),
      changes: createRestChanges(
        context,
        [{ tribute: actor, quality: "sheltered" }],
        [],
        [
          createItemUseChange(fireStarter.owner, fireStarter.item, "night-cooking-provisions"),
          {
            type: "satisfy-survival-need",
            tributeId: actor.id,
            need: "food",
          },
        ],
      ),
    };
  },
};

const NIGHT_TRUCE_EVENT: EventDefinition = {
  id: "night-truce",
  category: "survival",
  periods: ["night"],
  baseWeight: 1.8,
  tags: ["survival", "truce", "cooperative"],
  roles: untrucedPairRoles(),
  isEligible: ({ state, round, livingTributes }) =>
    canStandardTrucePersist(state, round) &&
    livingTributes.filter((tribute) => getActiveTruceForTribute(state, tribute.id) === null)
      .length >= 2,
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    return {
      text: choose(context.random, [
        `${actor.snapshot.name} and ${target.snapshot.name} encounter each other after dark. Neither ` +
          "can see well enough to feel confident about winning a fight, so they agree to share the " +
          "night in extremely suspicious peace.",
        `${actor.snapshot.name} and ${target.snapshot.name} raise their weapons at the same time, ` +
          "stare at one another for several uncomfortable seconds, and mutually decide that fighting " +
          "can wait until there is sunlight.",
      ]),
      changes: createRestChanges(
        context,
        [
          { tribute: actor, quality: "sheltered" },
          { tribute: target, quality: "sheltered" },
        ],
        [],
        [createStandardTruceChange(context.eventId, context.round, [actor.id, target.id])],
      ),
    };
  },
};

const DEFENDING_FIRE_EVENT: EventDefinition = {
  id: "night-defending-fire",
  category: "hazard",
  periods: ["night"],
  baseWeight: 0.8,
  tags: ["hazard", "combat", "cooperative", "truce", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      opposesRoleIds: ["approachers"],
      isEligible: (tribute, { state }) => getActiveTruceForTribute(state, tribute.id) === null,
      getWeight: (tribute) => getCombatScore(tribute),
    },
    {
      id: "approachers",
      count: 3,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
      isEligible: (tribute, { state, participantsByRole }) => {
        const selected = participantsByRole.approachers ?? [];

        if (selected.length === 0) {
          const truce = getActiveTruceForTribute(state, tribute.id);
          return truce !== null && getLivingTruceMembers(state, truce).length >= 3;
        }

        const first = selected[0];
        const truce = first ? getActiveTruceForTribute(state, first.id) : null;
        return truce?.tributeIds.includes(tribute.id) ?? false;
      },
    },
  ],
  isEligible: ({ state }) =>
    state.truces.some((truce) => getLivingTruceMembers(state, truce).length >= 3),
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const [target, ally, bystander] = requireParticipants(
      context.participantsByRole,
      "approachers",
    );

    if (!target || !ally || !bystander) {
      throw new Error("Defending a fire requires three approaching tributes.");
    }

    requireSameTruce(context.state, [target, ally, bystander]);
    const pronouns = getTributePronouns(actor);
    const outcome = resolveScoreCheck({
      score: getCombatScore(actor),
      difficulty: 4,
      random: context.random,
    });
    const opening =
      `${actor.snapshot.name} sits by ${pronouns.possessiveAdjective} fire, trying to get comfy when ` +
      `${target.snapshot.name}, ${ally.snapshot.name}, and ${bystander.snapshot.name} approach from ` +
      "the darkness. ";

    if (outcome === "critical-failure" || outcome === "failure") {
      return {
        text:
          opening +
          `${actor.snapshot.name} narrowly avoids being skewered while fleeing into the night and ` +
          "leaves the camp behind.",
        changes: createRestChanges(context, [
          { tribute: actor, quality: "unsheltered" },
          { tribute: target, quality: "sheltered" },
          { tribute: ally, quality: "sheltered" },
          { tribute: bystander, quality: "sheltered" },
        ]),
      };
    }

    if (outcome === "success") {
      return {
        text:
          opening +
          `${actor.snapshot.name} grabs a burning branch and swings it in wide circles, forcing the ` +
          "group away before anyone can surround them. Somehow, acting crazy convinces the group " +
          "that the fire is not worth the fight.",
        changes: createRestChanges(context, [
          { tribute: actor, quality: "sheltered" },
          { tribute: target, quality: "unsheltered" },
          { tribute: ally, quality: "unsheltered" },
          { tribute: bystander, quality: "unsheltered" },
        ]),
      };
    }

    return {
      text:
        opening +
        `${actor.snapshot.name} kicks burning logs across the clearing, disappears into the smoke, ` +
        "and strikes from a different side each time someone approaches. The group eventually " +
        `decides ${actor.snapshot.name} is best left alone and retreats into the darkness.`,
      changes: createRestChanges(
        context,
        [
          { tribute: actor, quality: "sheltered" },
          { tribute: target, quality: "unsheltered" },
          { tribute: ally, quality: "unsheltered" },
          { tribute: bystander, quality: "unsheltered" },
        ],
        [{ tribute: actor, statusId: "alert" }],
      ),
    };
  },
};

const DISCUSSING_MORNING_EVENT = createAlliedNightEvent({
  id: "night-discussing-morning",
  count: 3,
  weight: 1.5,
  statuses: ["alert"],
  texts: [
    ([actor, target, ally]) =>
      `${actor?.snapshot.name}, ${target?.snapshot.name}, and ${ally?.snapshot.name} whisper about ` +
      "what the Gamemakers might do in the morning. Their predictions become increasingly ridiculous " +
      "until someone suggests a second Cornucopia, but with bears.",
    ([actor, target, ally]) =>
      `${actor?.snapshot.name}, ${target?.snapshot.name}, and ${ally?.snapshot.name} discuss which ` +
      "direction to travel at sunrise, drawing a map in the dirt that becomes less accurate every " +
      "time someone contributes.",
  ],
});

const CRYING_TO_SLEEP_EVENT = createStaticSoloNightEvent({
  id: "night-crying-to-sleep",
  weight: 1,
  quality: "unsheltered",
  isEligible: (tribute) => !hasAnyOwnedItem(tribute, NO_SHELTER_ITEM_IDS),
  texts: [
    (actor) =>
      `${actor.snapshot.name} fluffs leaves into a pillow shape, then falls asleep crying as quietly ` +
      `as possible, drying ${getTributePronouns(actor).possessiveAdjective} cheeks with pillow-leaves.`,
  ],
});

const DISCUSSING_SURVIVORS_EVENT: EventDefinition = {
  id: "night-discussing-survivors",
  category: "survival",
  periods: ["night"],
  baseWeight: 1.5,
  tags: ["survival", "cooperative", "truce"],
  roles: [alliedGroupRole(2)],
  isEligible: ({ livingTributes }) => livingTributes.length >= 3,
  resolve(context): EventResolution {
    const [actor, target] = requireParticipants(context.participantsByRole, "tributes");

    if (!actor || !target) {
      throw new Error("Discussing the surviving tributes requires two allies.");
    }

    requireSameTruce(context.state, [actor, target]);
    const bystanderCandidates = context.livingTributes.filter(
      (tribute) => tribute.id !== actor.id && tribute.id !== target.id,
    );
    const bystander = choose(context.random, bystanderCandidates);

    return {
      text: choose(context.random, [
        `${actor.snapshot.name} and ${target.snapshot.name} gossip about the tributes that are still ` +
          `alive, disagreeing about whether ${bystander.snapshot.name} is hot or annoying.`,
        `${actor.snapshot.name} and ${target.snapshot.name} rank the surviving tributes from ` +
          '"probably harmless" to "absolutely do not approach," then confidently place each other ' +
          "somewhere near the top of the list.",
      ]),
      changes: createRestChanges(context, [
        { tribute: actor, quality: "sheltered" },
        { tribute: target, quality: "sheltered" },
      ]),
    };
  },
};

const NIGHTMARES_EVENT = createStaticSoloNightEvent({
  id: "night-nightmares",
  weight: 1.8,
  quality: "unsheltered",
  texts: [
    (actor) =>
      `${actor.snapshot.name} repeatedly wakes from nightmares, each time taking several panicked ` +
      "seconds to realize that the arena is real and somehow worse.",
    (actor) =>
      `${actor.snapshot.name} dreams that ${getTributePronouns(actor).subject} ${getTributePronouns(actor).havePresent} escaped the arena, wakes smiling, and spends ` +
      "the next hour deeply offended by reality, unable to get back to sleep.",
  ],
});

function createHuddlingTruceChanges(
  context: EventResolutionContext,
  first: GameTribute,
  second: GameTribute,
): GameChange[] {
  const firstTruce = getActiveTruceForTribute(context.state, first.id);
  const secondTruce = getActiveTruceForTribute(context.state, second.id);

  if (!firstTruce && !secondTruce) {
    if (context.random() < 0.15) {
      return [createRomanticTruceChange(context.eventId, context.round, [first.id, second.id])];
    }

    return canStandardTrucePersist(context.state, context.round)
      ? [createStandardTruceChange(context.eventId, context.round, [first.id, second.id])]
      : [];
  }

  if (!firstTruce || firstTruce.id !== secondTruce?.id) {
    throw new Error("Huddling selected tributes with incompatible active truces.");
  }

  if (
    firstTruce.kind === "standard" &&
    firstTruce.tributeIds.length === 2 &&
    context.random() < 0.15
  ) {
    return [
      {
        type: "break-truce",
        truceId: firstTruce.id,
        reason: "amicable",
      },
      createRomanticTruceChange(context.eventId, context.round, [first.id, second.id]),
    ];
  }

  return [];
}

const HUDDLING_FOR_WARMTH_EVENT: EventDefinition = {
  id: "night-huddling-for-warmth",
  category: "survival",
  periods: ["night"],
  baseWeight: 1.8,
  tags: ["survival", "cooperative", "truce", "romantic"],
  roles: [compatiblePairRole()],
  resolve(context): EventResolution {
    const [actor, target] = requireParticipants(context.participantsByRole, "tributes");

    if (!actor || !target) {
      throw new Error("Huddling for warmth requires two tributes.");
    }

    return {
      text: choose(context.random, [
        `${actor.snapshot.name} and ${target.snapshot.name} huddle together for warmth, both ` +
          "insisting that this is an entirely practical arrangement while moving noticeably closer.",
        `${actor.snapshot.name} and ${target.snapshot.name} press back-to-back beneath the same ` +
          "blanket, stealing warmth from each other and pretending not to notice whenever their hands touch.",
      ]),
      changes: createRestChanges(
        context,
        [
          { tribute: actor, quality: "sheltered" },
          { tribute: target, quality: "sheltered" },
        ],
        [],
        createHuddlingTruceChanges(context, actor, target),
      ),
    };
  },
};

const THINKING_ABOUT_VICTORY_EVENT = createStaticSoloNightEvent({
  id: "night-thinking-about-victory",
  weight: 1.4,
  quality: "sheltered",
  statuses: ["inspired"],
  texts: [
    (actor) =>
      `${actor.snapshot.name} lies awake imagining the final cannon, the cheering crowd, and the ` +
      `extremely awkward interview that would presumably follow everything ${getTributePronouns(actor).subject} ${getTributePronouns(actor).havePresent} done.`,
    (actor) =>
      `${actor.snapshot.name} imagines returning home as victor, rehearses several possible victory ` +
      "speeches, and rejects all of them for not sounding cool enough.",
  ],
});

const GHOST_STORIES_EVENT = createAlliedNightEvent({
  id: "night-ghost-stories",
  count: 4,
  weight: 0.8,
  texts: [
    ([actor, target, ally, bystander]) =>
      `${actor?.snapshot.name}, ${target?.snapshot.name}, ${ally?.snapshot.name}, and ` +
      `${bystander?.snapshot.name} tell ghost stories around the campfire to lighten the mood. This ` +
      `works until ${actor?.snapshot.name}'s story involves a tribute being murdered beside a campfire.`,
    ([actor, target, ally, bystander]) =>
      `${actor?.snapshot.name}, ${target?.snapshot.name}, ${ally?.snapshot.name}, and ` +
      `${bystander?.snapshot.name} compete to tell the scariest ghost story. After several rounds, ` +
      "nobody is willing to sleep closest to the trees.",
  ],
});

const LOOKING_AT_SKY_EVENT = createStaticSoloNightEvent({
  id: "night-looking-at-sky",
  weight: 1.4,
  quality: "sheltered",
  isEligible: (tribute) => tribute.snapshot.stats.brains <= 2,
  getWeight: (tribute) => Math.max(0.25, 4 - tribute.snapshot.stats.brains),
  texts: [
    (actor) =>
      `${actor.snapshot.name} watches the night sky through the branches, searching for familiar ` +
      "constellations and wondering which lights are real and which were placed there by the Gamemakers.",
    (actor) =>
      `${actor.snapshot.name} lies beneath the stars and quietly names several constellations ` +
      `incorrectly. There is nobody nearby to challenge ${getTributePronouns(actor).object}, so every answer becomes correct.`,
  ],
});

const SPARING_OPPONENT_EVENT: EventDefinition = {
  id: "night-sparing-opponent",
  category: "hazard",
  periods: ["night"],
  baseWeight: 1,
  tags: ["hazard", "combat", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      opposesRoleIds: ["target"],
      getWeight: (tribute) => getCombatScore(tribute),
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
    },
  ],
  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const outcome = resolveScoreCheck({
      score: getCombatScore(actor),
      difficulty: 3,
      random: context.random,
    });
    const injurySeverity = outcome === "exceptional-success" ? 2 : outcome === "success" ? 1 : null;
    const statuses: StatusApplication[] = injurySeverity
      ? [
          {
            tribute: target,
            statusId: "injured",
            severity: injurySeverity,
            sourceTributeId: actor.id,
          },
        ]
      : [];

    return {
      text: choose(context.random, [
        `${actor.snapshot.name} spots ${target.snapshot.name} in the dark and attacks, knocking ` +
          `${target.snapshot.name} to the ground. ${actor.snapshot.name} raises ` +
          `${actorPronouns.possessiveAdjective} weapon and, after a long pause, steps aside and tells ` +
          `${target.snapshot.name} to leave before ${actorPronouns.subject} ` +
          `${actorPronouns.subject === "they" ? "change" : "changes"} ` +
          `${actorPronouns.possessiveAdjective} mind.`,
        `${actor.snapshot.name} spots ${target.snapshot.name} in the darkness and pins ` +
          `${targetPronouns.object} beneath ${actorPronouns.possessiveAdjective} weapon. ` +
          `${target.snapshot.name} closes ${targetPronouns.possessiveAdjective} eyes, but ` +
          `${actor.snapshot.name} only steals the sleeping spot and tells ${targetPronouns.object} ` +
          "to get lost.",
      ]),
      changes: createRestChanges(
        context,
        [
          { tribute: actor, quality: "sheltered" },
          { tribute: target, quality: "unsheltered" },
        ],
        statuses,
      ),
    };
  },
};

const SHARING_SHELTER_EVENT: EventDefinition = {
  id: "night-sharing-shelter",
  category: "survival",
  periods: ["night"],
  baseWeight: 1.5,
  tags: ["survival", "cooperative", "truce", "item", "tool"],
  roles: [
    {
      id: "actor",
      count: 1,
      requiredItemDefinitionIds: SHELTER_ITEM_IDS,
      itemAccess: "owned",
      isEligible: (tribute, { state }) => getActiveTruceForTribute(state, tribute.id) === null,
    },
    {
      id: "target",
      count: 1,
      isEligible: (tribute, { state }) => getActiveTruceForTribute(state, tribute.id) === null,
    },
  ],
  isEligible: ({ state, round, livingTributes }) =>
    canStandardTrucePersist(state, round) &&
    livingTributes.filter((tribute) => getActiveTruceForTribute(state, tribute.id) === null)
      .length >= 2,

  resolve(context): EventResolution {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);
    const shelter = getSelectedRoleItem(context, "actor");

    if (!shelter) {
      throw new Error("Sharing a shelter requires a selected shelter item.");
    }

    const quality = getShelterQuality(shelter.item.definitionId);
    return {
      text: choose(context.random, [
        `${actor.snapshot.name} finds ${target.snapshot.name} shivering outside the shelter, stares ` +
          `at ${targetPronouns.object} through the entrance, and eventually moves aside with the ` +
          "exhausted expression of someone allowing a wet dog indoors.",
        `${actor.snapshot.name} spots ${target.snapshot.name} shivering outside the shelter. Against ` +
          `${getTributePronouns(actor).possessiveAdjective} better judgement, ${actor.snapshot.name} ` +
          `calls out and invites ${targetPronouns.object} to join, feeling a moment of generosity.`,
      ]),
      changes: createRestChanges(
        context,
        [
          { tribute: actor, quality },
          { tribute: target, quality },
        ],
        [],
        [
          createItemUseChange(shelter.owner, shelter.item, "night-sharing-shelter"),
          createStandardTruceChange(context.eventId, context.round, [actor.id, target.id]),
        ],
      ),
    };
  },
};

const SINGING_TO_SLEEP_EVENT = createStaticSoloNightEvent({
  id: "night-singing-to-sleep",
  weight: 1.4,
  quality: "sheltered",
  texts: [
    (actor) =>
      `${actor.snapshot.name} quietly sings to ${getTributePronouns(actor).reflexive} until the words ` +
      "become slurred, the melody falls apart, and sleep finally takes over.",
    (actor) =>
      `${actor.snapshot.name} tries singing ${getTributePronouns(actor).reflexive} to sleep, forgets ` +
      "half the lyrics, and replaces them with increasingly confident nonsense.",
  ],
});

const QUIET_HUMMING_EVENT = createStaticSoloNightEvent({
  id: "night-quiet-humming",
  weight: 1,
  quality: "sheltered",
  texts: [
    (actor) =>
      `${actor.snapshot.name} hums softly in the darkness, stopping whenever the forest makes a ` +
      `noise and restarting when nothing immediately attacks ${getTributePronouns(actor).object}. The routine feels comforting.`,
  ],
});

const SINGING_TOGETHER_EVENT = createAlliedNightEvent({
  id: "night-singing-together",
  count: 3,
  weight: 1,
  texts: [
    ([actor, target, ally]) =>
      `${actor?.snapshot.name}, ${target?.snapshot.name}, and ${ally?.snapshot.name} sing together ` +
      "beside the campfire. None of them knows all the words, but all three commit loudly enough " +
      "to overcome this problem, confident that no one will get murdered while singing Kumbaya.",
    ([actor, target, ally]) =>
      `${actor?.snapshot.name}, ${target?.snapshot.name}, and ${ally?.snapshot.name} begin singing ` +
      "the same song in three different keys and somehow become more enthusiastic as it gets worse. " +
      "Somehow, no one gets murdered.",
  ],
});

const SLEEPING_WITHOUT_FIRE_EVENT = createStaticSoloNightEvent({
  id: "night-sleeping-without-fire",
  weight: 1.6,
  quality: "unsheltered",
  texts: [
    (actor) =>
      `${actor.snapshot.name} fails to start a fire and spends the night curled into the smallest ` +
      "possible shape, angrily insisting through chattering teeth that they are perfectly warm.",
    (actor) =>
      `${actor.snapshot.name} produces several sparks, one promising puff of smoke, and absolutely ` +
      "no fire. They sleep beneath every layer they own and still wake up cold.",
  ],
});

const HOLDING_HANDS_EVENT = createAlliedNightEvent({
  id: "night-holding-hands",
  count: 2,
  weight: 1.2,
  tags: ["romantic"],
  texts: [
    ([actor, target]) =>
      `${actor?.snapshot.name} and ${target?.snapshot.name} lie awake holding hands, neither ` +
      "acknowledging how tightly they are gripping the other whenever something moves outside the shelter.",
    ([actor, target]) =>
      `${actor?.snapshot.name} reaches for ${target?.snapshot.name}'s hand in the darkness. ` +
      `${target?.snapshot.name} squeezes back, and neither tribute says anything that might make the ` +
      "moment more embarrassing.",
  ],
});

const SNUGGLING_EVENT: EventDefinition = {
  id: "night-snuggling",
  category: "survival",
  periods: ["night"],
  baseWeight: 0.7,
  tags: ["survival", "cooperative", "truce", "romantic"],
  roles: [
    {
      id: "tributes",
      count: 2,
      isEligible: (tribute, { state, participantsByRole }) => {
        const selected = participantsByRole.tributes ?? [];
        const truce = getActiveTruceForTribute(state, tribute.id);

        if (selected.length === 0) {
          return (
            truce?.kind === "standard" &&
            truce.tributeIds.length === 2 &&
            getLivingTruceMembers(state, truce).length === 2
          );
        }

        const first = selected[0];
        const firstTruce = first ? getActiveTruceForTribute(state, first.id) : null;
        return firstTruce?.kind === "standard" && firstTruce.tributeIds.includes(tribute.id);
      },
    },
  ],
  isEligible: ({ state }) =>
    state.truces.some(
      (truce) =>
        truce.kind === "standard" &&
        truce.tributeIds.length === 2 &&
        getLivingTruceMembers(state, truce).length === 2,
    ),
  resolve(context): EventResolution {
    const [actor, target] = requireParticipants(context.participantsByRole, "tributes");

    if (!actor || !target) {
      throw new Error("Snuggling requires an established pair.");
    }

    const truce = requireSameTruce(context.state, [actor, target], "standard");

    if (truce.tributeIds.length !== 2) {
      throw new Error("Snuggling can only convert a two-person standard truce.");
    }

    return {
      text: choose(context.random, [
        `${actor.snapshot.name} convinces ${target.snapshot.name} that sharing body heat is the most ` +
          "practical way to survive the cold. Neither explains why they continue snuggling long " +
          "after they are warm.",
        `${actor.snapshot.name} asks ${target.snapshot.name} to move closer for warmth. ` +
          `${target.snapshot.name} moves significantly closer than necessary, and ` +
          `${actor.snapshot.name} makes no effort to correct the misunderstanding.`,
      ]),
      changes: createRestChanges(
        context,
        [
          { tribute: actor, quality: "comfortable" },
          { tribute: target, quality: "comfortable" },
        ],
        [],
        [
          {
            type: "break-truce",
            truceId: truce.id,
            reason: "amicable",
          },
          createRomanticTruceChange(context.eventId, context.round, [actor.id, target.id]),
        ],
      ),
    };
  },
};

export const NIGHT_EVENTS = [
  STARTING_FIRE_EVENT,
  SETTING_UP_CAMP_EVENT,
  BECOMING_LOST_EVENT,
  SLEEPING_IN_TREE_EVENT,
  COMFORTABLE_BUSH_EVENT,
  SIMPLY_SLEEPING_EVENT,
  TELLING_STORIES_EVENT,
  SLEEPING_SHIFTS_TWO_EVENT,
  SLEEPING_SHIFTS_THREE_EVENT,
  SLEEPING_SHIFTS_FOUR_EVENT,
  NATURAL_WOUND_TREATMENT_EVENT,
  SEEING_DISTANT_FIRE_EVENT,
  SCREAMING_FOR_HELP_EVENT,
  STAYING_AWAKE_EVENT,
  PASSING_OUT_EXHAUSTED_EVENT,
  COOKING_PROVISIONS_EVENT,
  NIGHT_TRUCE_EVENT,
  DEFENDING_FIRE_EVENT,
  DISCUSSING_MORNING_EVENT,
  CRYING_TO_SLEEP_EVENT,
  DISCUSSING_SURVIVORS_EVENT,
  NIGHTMARES_EVENT,
  HUDDLING_FOR_WARMTH_EVENT,
  THINKING_ABOUT_VICTORY_EVENT,
  GHOST_STORIES_EVENT,
  LOOKING_AT_SKY_EVENT,
  SPARING_OPPONENT_EVENT,
  SHARING_SHELTER_EVENT,
  SINGING_TO_SLEEP_EVENT,
  QUIET_HUMMING_EVENT,
  SINGING_TOGETHER_EVENT,
  SLEEPING_WITHOUT_FIRE_EVENT,
  HOLDING_HANDS_EVENT,
  SNUGGLING_EVENT,
] satisfies readonly EventDefinition[];
