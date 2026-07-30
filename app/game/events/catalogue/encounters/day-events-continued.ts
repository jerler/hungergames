import { getEffectiveStats } from "~/game/engine/effective-stats";
import { getNextRound } from "~/game/engine/rounds";
import { selectWeightedItem } from "~/game/engine/random";
import {
  getAwarenessScore,
  getCombatScore,
  getForagingScore,
  getSurvivalScore,
} from "~/game/engine/stat-formulas";
import {
  createItemUseChange,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { resolveScoreCheck, type StatCheckOutcome } from "~/game/events/event-outcomes";
import { clampStatCheckDifficulty } from "~/game/events/event-resolution-helpers";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
  type EventSelectionContext,
  type ParticipantRoleDefinition,
} from "~/game/events/event-schema";
import {
  CORNUCOPIA_PROVISIONS_ITEM_ID,
  hasDeprivationProtection,
} from "~/game/items/deprivation-protection";
import { getItemDefinition, ITEM_CATALOGUE } from "~/game/items/item-catalogue";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import {
  areTributesInSameTruce,
  createTruceInstance,
  getActiveTruceForTribute,
  getLivingTruceMembers,
} from "~/game/truces/truce-engine";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameChange, GameTribute, InventoryItem } from "~/game/types/game-state";

const DEFAULT_DIFFICULTY = 3;

const ALL_ITEM_IDS = ITEM_CATALOGUE.map(
  (definition) => definition.id,
) satisfies readonly ItemDefinitionId[];

const POISONOUS_FORAGE_ITEM_IDS = [
  "poison-berries",
  "poison-mushrooms",
] as const satisfies readonly ItemDefinitionId[];

const HALLUCINOGENIC_FORAGE_ITEM_IDS = [
  "hallucinogenic-berries",
  "hallucinogenic-mushrooms",
] as const satisfies readonly ItemDefinitionId[];

const SUCCESS_OUTCOMES = new Set<StatCheckOutcome>(["success", "exceptional-success"]);

const FAILURE_OUTCOMES = new Set<StatCheckOutcome>(["critical-failure", "failure"]);

interface SoloOutcome {
  text: (actor: GameTribute) => string;
  effects?: (context: EventResolutionContext, actor: GameTribute) => readonly GameChange[];
}

interface SoloCheckedEventOptions {
  id: string;
  weight: number;
  category?: EventDefinition["category"];
  tags?: readonly EventDefinition["tags"][number][];
  score: (actor: GameTribute, context: EventResolutionContext) => number;
  outcomes: Readonly<Record<StatCheckOutcome, SoloOutcome>>;
  getWeight?: ParticipantRoleDefinition["getWeight"];
  isEligible?: ParticipantRoleDefinition["isEligible"];
}

interface ConditionedSoloEventOptions extends SoloCheckedEventOptions {
  acceptedOutcomes: ReadonlySet<StatCheckOutcome>;
}

function mergeTags(
  ...groups: readonly (readonly EventDefinition["tags"][number][])[]
): EventDefinition["tags"][number][] {
  return [...new Set(groups.flat())];
}

function choose<T>(random: EventResolutionContext["random"], values: readonly T[]): T {
  const index = Math.min(values.length - 1, Math.floor(random() * values.length));
  const value = values[index];

  if (value === undefined) {
    throw new Error("Cannot choose from an empty collection.");
  }

  return value;
}

function survivalNeedChange(tribute: GameTribute, need: "food" | "water"): GameChange {
  return {
    type: "satisfy-survival-need",
    tributeId: tribute.id,
    need,
  };
}

function statusChange(
  context: EventResolutionContext,
  tribute: GameTribute,
  statusId: StatusEffectId,
  severity: 1 | 2 | 3 = 1,
  sourceTributeId: string | null = null,
  durationRounds?: number,
): GameChange {
  return createStatusChange(
    context.eventId,
    tribute,
    statusId,
    severity,
    context.round,
    durationRounds,
    sourceTributeId,
  );
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

function reduceStatusSeverityChanges(
  context: EventResolutionContext,
  tribute: GameTribute,
  statusId: StatusEffectId,
  amount: number,
): GameChange[] {
  const existing = tribute.statuses.find((status) => status.definitionId === statusId);

  if (!existing) {
    return [];
  }

  const remainingSeverity = existing.severity - amount;
  const changes = removeStatusChanges(tribute, statusId);

  if (remainingSeverity <= 0) {
    return changes;
  }

  return [
    ...changes,
    statusChange(
      context,
      tribute,
      statusId,
      remainingSeverity as 1 | 2 | 3,
      existing.sourceTributeId,
      existing.remainingRounds ?? undefined,
    ),
  ];
}

function createTransferChange(
  item: InventoryItem,
  from: GameTribute,
  to: GameTribute,
  reason = "theft",
): GameChange {
  return {
    type: "transfer-item",
    itemInstanceId: item.id,
    fromTributeId: from.id,
    toTributeId: to.id,
    reason,
  };
}

function getSelectedRoleItem(context: EventResolutionContext, roleId: string): InventoryItem {
  const selection = context.itemsByRole?.[roleId]?.[0];

  if (!selection) {
    throw new Error(`Day event "${context.eventId}" is missing selected item role "${roleId}".`);
  }

  return selection.item;
}

function getItemLabel(item: InventoryItem): string {
  return getItemDefinition(item.definitionId).label.toLowerCase();
}

function hasOwnedWeapon(tribute: GameTribute): boolean {
  return tribute.inventory.some((item) =>
    (getItemDefinition(item.definitionId).tags as readonly string[]).includes("weapon"),
  );
}

function isUntruced(tribute: GameTribute, context: EventSelectionContext): boolean {
  return getActiveTruceForTribute(context.state, tribute.id) === null;
}

function createStandardTruceChange(
  context: EventResolutionContext,
  tributes: readonly [GameTribute, GameTribute],
): GameChange {
  return {
    type: "form-truce",
    truce: createTruceInstance(
      context.eventId,
      tributes.map((tribute) => tribute.id),
      context.round,
      getNextRound(context.round),
    ),
  };
}

function getBrainsAndLuckScore(tribute: GameTribute): number {
  const stats = getEffectiveStats(tribute);

  return (stats.brains + stats.luck) / 2;
}

function getBrainsAndAwarenessScore(tribute: GameTribute, context: EventResolutionContext): number {
  return (getEffectiveStats(tribute).brains + getAwarenessScore(tribute, context.round)) / 2;
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

function getWeightedOutcomes(score: number) {
  const advantage = score - DEFAULT_DIFFICULTY;

  return (["critical-failure", "failure", "success", "exceptional-success"] as const).map(
    (outcome) => ({
      outcome,
      weight: getOutcomeWeight(outcome, advantage),
    }),
  );
}

function getOutcomeGroupProbability(
  score: number,
  acceptedOutcomes: ReadonlySet<StatCheckOutcome>,
): number {
  const weighted = getWeightedOutcomes(score);
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const acceptedWeight = weighted.reduce(
    (sum, entry) => (acceptedOutcomes.has(entry.outcome) ? sum + entry.weight : sum),
    0,
  );

  return acceptedWeight / totalWeight;
}

function selectConditionalOutcome(
  score: number,
  acceptedOutcomes: ReadonlySet<StatCheckOutcome>,
  random: EventResolutionContext["random"],
): StatCheckOutcome {
  return selectWeightedItem(
    getWeightedOutcomes(score).filter(({ outcome }) => acceptedOutcomes.has(outcome)),
    ({ weight }) => weight,
    random,
  ).outcome;
}

function resolveSoloOutcome(
  context: EventResolutionContext,
  actor: GameTribute,
  outcome: SoloOutcome,
): EventResolution {
  return {
    text: outcome.text(actor),
    changes: [...(outcome.effects?.(context, actor) ?? []), ...createSurvivalChanges([actor])],
  };
}

function createSoloCheckedEvent({
  id,
  weight,
  category = "survival",
  tags = [],
  score,
  outcomes,
  getWeight,
  isEligible,
}: SoloCheckedEventOptions): EventDefinition {
  return {
    id,
    category,
    periods: ["day"],
    baseWeight: weight,
    tags: mergeTags([category], tags),
    roles: [
      {
        id: "actor",
        count: 1,
        getWeight,
        isEligible,
      },
    ],
    resolve(context) {
      const actor = requireSingleParticipant(context.participantsByRole, "actor");
      const outcome = resolveScoreCheck({
        score: score(actor, context),
        difficulty: DEFAULT_DIFFICULTY,
        random: context.random,
      });

      return resolveSoloOutcome(context, actor, outcomes[outcome]);
    },
  };
}

function createConditionedSoloEvent({
  id,
  weight,
  category = "survival",
  tags = [],
  score,
  outcomes,
  acceptedOutcomes,
  isEligible,
}: ConditionedSoloEventOptions): EventDefinition {
  const probabilityFor = (tribute: GameTribute, round: EventSelectionContext["round"]) =>
    getOutcomeGroupProbability(
      score(tribute, {
        eventId: "conditioned-day-preview",
        state: {} as EventResolutionContext["state"],
        round,
        livingTributes: [],
        random: () => 0.5,
        participantsByRole: {
          actor: [tribute],
        },
      }),
      acceptedOutcomes,
    );

  return {
    id,
    category,
    periods: ["day"],
    baseWeight: weight,
    tags: mergeTags([category], tags),
    getWeightMultiplier(context) {
      const eligible = context.livingTributes.filter(
        (tribute) =>
          isEligible?.(tribute, {
            ...context,
            participantsByRole: {
              actor: [],
            },
          }) ?? true,
      );

      if (eligible.length === 0) {
        return 0;
      }

      return (
        eligible.reduce((sum, tribute) => sum + probabilityFor(tribute, context.round), 0) /
        eligible.length
      );
    },
    roles: [
      {
        id: "actor",
        count: 1,
        isEligible,
        getWeight: (tribute, context) => Math.max(0.01, probabilityFor(tribute, context.round)),
      },
    ],
    resolve(context) {
      const actor = requireSingleParticipant(context.participantsByRole, "actor");
      const outcome = selectConditionalOutcome(
        score(actor, context),
        acceptedOutcomes,
        context.random,
      );

      return resolveSoloOutcome(context, actor, outcomes[outcome]);
    },
  };
}

function alliedPairRole(): ParticipantRoleDefinition {
  return {
    id: "tributes",
    count: 2,
    isEligible: (tribute, { state, participantsByRole }) => {
      const selected = participantsByRole.tributes ?? [];

      if (selected.length === 0) {
        const truce = getActiveTruceForTribute(state, tribute.id);

        return truce !== null && getLivingTruceMembers(state, truce).length >= 2;
      }

      const first = selected[0];
      const truce = first ? getActiveTruceForTribute(state, first.id) : null;

      return truce?.tributeIds.includes(tribute.id) ?? false;
    },
  };
}

const SCARING_OFF_ANOTHER_TRIBUTE = createSoloCheckedEvent({
  id: "day-scaring-off-another-tribute",
  weight: 4,
  category: "hazard",
  tags: ["status", "resource"],
  score: (actor) => getCombatScore(actor),
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} spots a human shape through the trees but cannot make out who it is. ` +
          `Regardless, ${pronouns.subject} picks up a large rock and hurls it toward the shape. ` +
          "The rock lands several metres off target, and the shape immediately begins running " +
          `toward ${pronouns.object}, causing ${actor.snapshot.name} to sprint in the opposite direction.`
        );
      },
      effects: (context, actor) => [statusChange(context, actor, "hunted")],
    },
    failure: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} spots a human shape through the trees but cannot make out who it is. ` +
          `${pronouns.Subject} hurls a large rock toward the shape, misses by several metres, ` +
          "and watches it flee into the forest anyway."
        );
      },
    },
    success: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} spots a human shape through the trees but cannot make out who it is. ` +
          `${pronouns.Subject} hurls a large rock and lands a glancing hit, sending the shape ` +
          "running back into the forest."
        );
      },
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} lands a rock squarely on a distant human shape and gives chase. ` +
        "The stranger disappears into the forest, but abandons enough food to make the effort worthwhile.",
      effects: (_context, actor) => [survivalNeedChange(actor, "food")],
    },
  },
});

const CREATING_A_DIVERSION: EventDefinition = {
  id: "day-creating-diversion-and-escaping",
  category: "hazard",
  periods: ["day"],
  baseWeight: 4,
  tags: ["hazard", "combat", "ambush", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => !hasOwnedWeapon(tribute),
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
    const outcome = resolveScoreCheck({
      score: getBrainsAndLuckScore(actor),
      difficulty: DEFAULT_DIFFICULTY,
      random: context.random,
    });

    switch (outcome) {
      case "critical-failure":
        return {
          text:
            `${actor.snapshot.name} spots ${target.snapshot.name} through the trees and grabs a sharp rock, ` +
            `ready to sneak up on ${targetPronouns.object}. At the last second, ${target.snapshot.name} turns ` +
            `and traps ${actor.snapshot.name} in a chokehold. ${actor.snapshot.name} strikes ` +
            `${target.snapshot.name} in the shin and escapes with ${target.snapshot.name} hot on ` +
            `${actorPronouns.possessiveAdjective} trail.`,
          changes: [
            statusChange(context, actor, "hunted", 1, target.id),
            ...createSurvivalChanges([actor, target]),
          ],
        };
      case "failure":
        return {
          text:
            `${actor.snapshot.name} spots ${target.snapshot.name} through the trees and grabs a sharp rock. ` +
            `${target.snapshot.name} turns before the ambush and lunges, but ${actor.snapshot.name} strikes ` +
            `${target.snapshot.name} in the shin and runs until no footsteps remain behind ` +
            `${actorPronouns.object}.`,
          changes: createSurvivalChanges([actor, target]),
        };
      case "success":
        return {
          text:
            `${actor.snapshot.name} searches the bushes for food before spotting ${target.snapshot.name} ` +
            "wandering dangerously close. Without a weapon, " +
            `${actor.snapshot.name} throws a stone into the brush behind ${target.snapshot.name} ` +
            "and slips away while the distraction holds.",
          changes: createSurvivalChanges([actor, target]),
        };
      case "exceptional-success":
        return {
          text:
            `${actor.snapshot.name} spots ${target.snapshot.name} wandering dangerously close. ` +
            `Without a proper weapon, ${actor.snapshot.name} waits with a sharp rock until ` +
            `${targetPronouns.subject} ${targetPronouns.bePresent} within striking distance, ` +
            `then cuts a large gash into ${target.snapshot.name}'s side and escapes.`,
          changes: [
            statusChange(context, target, "bleeding", 1, actor.id),
            ...createSurvivalChanges([actor, target]),
          ],
        };
    }
  },
};

const STALKING_ANOTHER_TRIBUTE: EventDefinition = {
  id: "day-stalking-another-tribute",
  category: "hazard",
  periods: ["day"],
  baseWeight: 4,
  tags: ["hazard", "ambush", "resource", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
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
    const outcome = resolveScoreCheck({
      score: getBrainsAndAwarenessScore(actor, context),
      difficulty: DEFAULT_DIFFICULTY,
      random: context.random,
    });

    switch (outcome) {
      case "critical-failure":
        return {
          text:
            `${actor.snapshot.name} follows ${target.snapshot.name} through the forest for several hours, ` +
            `until ${actorPronouns.subject} realizes ${target.snapshot.name} is clearly lost and has been ` +
            "leading them both in a circle.",
          changes: [
            statusChange(context, actor, "disoriented"),
            statusChange(context, target, "disoriented"),
            ...createSurvivalChanges([actor, target]),
          ],
        };
      case "failure":
        return {
          text:
            `${actor.snapshot.name} stalks ${target.snapshot.name} through the trees, hoping for an opening ` +
            `to strike, but loses ${targetPronouns.object} when the ground becomes too rocky to hold tracks.`,
          changes: createSurvivalChanges([actor, target]),
        };
      case "success":
        return {
          text:
            `${actor.snapshot.name} follows ${target.snapshot.name} from a careful distance, but loses ` +
            `${targetPronouns.object} when the tracks cross a stream. ${actor.snapshot.name} loses the ` +
            `tribute, but at least gets a cool drink of water for ${actorPronouns.possessiveAdjective} efforts.`,
          changes: [survivalNeedChange(actor, "water"), ...createSurvivalChanges([actor, target])],
        };
      case "exceptional-success":
        return {
          text:
            `${actor.snapshot.name} follows ${target.snapshot.name} from a careful distance, but loses ` +
            `${targetPronouns.object} where the tracks cross a stream bordered by berry bushes. ` +
            `${actor.snapshot.name} loses the tribute, but finds food and water instead.`,
          changes: [
            survivalNeedChange(actor, "food"),
            survivalNeedChange(actor, "water"),
            ...createSurvivalChanges([actor, target]),
          ],
        };
    }
  },
};

const FISHING: EventDefinition = {
  id: "day-fishing",
  category: "survival",
  periods: ["day"],
  baseWeight: 5,
  tags: ["survival", "resource", "item", "tool"],
  roles: [
    {
      id: "actor",
      count: 1,
      itemAccess: "owned",
      requiredItemDefinitionIds: ["fishing-gear"],
      getWeight: (tribute) => Math.max(getForagingScore(tribute), getSurvivalScore(tribute)),
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const gear = getSelectedRoleItem(context, "actor");
    const outcome = resolveScoreCheck({
      score: Math.max(getForagingScore(actor), getSurvivalScore(actor)),
      difficulty: DEFAULT_DIFFICULTY,
      random: context.random,
    });
    const useChange = createItemUseChange(actor, gear, "day-fishing");

    switch (outcome) {
      case "critical-failure":
        return {
          text:
            `${actor.snapshot.name} finds a moment of peace fishing in the lake. After several hours, ` +
            `${pronouns.subject} hooks something powerful enough to pull ${pronouns.object} into the water, ` +
            `soaking ${actor.snapshot.name} to the bone. The fish ${pronouns.subject} eventually lands ` +
            "still makes it worthwhile.",
          changes: [
            useChange,
            survivalNeedChange(actor, "food"),
            ...createSurvivalChanges([actor]),
          ],
        };
      case "failure":
        return {
          text:
            `${actor.snapshot.name} takes a quiet moment to fish with ` +
            `${pronouns.possessiveAdjective} fancy fishing gear. Several hours and thoroughly soaked socks ` +
            `later, ${pronouns.subject} catches enough to quiet ${pronouns.possessiveAdjective} stomach.`,
          changes: [
            useChange,
            survivalNeedChange(actor, "food"),
            ...createSurvivalChanges([actor]),
          ],
        };
      case "success":
        return {
          text:
            `${actor.snapshot.name} uses ${pronouns.possessiveAdjective} fishing gear to catch a proper meal. ` +
            "Several patient hours later, after finding as much peace as possible in the arena, " +
            `${pronouns.subject} hooks a tasty fish and eats well.`,
          changes: [
            useChange,
            survivalNeedChange(actor, "food"),
            statusChange(context, actor, "well-fed"),
            ...createSurvivalChanges([actor]),
          ],
        };
      case "exceptional-success":
        return {
          text:
            `${actor.snapshot.name} has fished before, so bringing fishing gear to the lake proves fruitful. ` +
            `${pronouns.Subject} catches a large fish almost immediately, garnishes it with herbs and berries, ` +
            "and has a drink of water from the stream as well.",
          changes: [
            useChange,
            survivalNeedChange(actor, "food"),
            survivalNeedChange(actor, "water"),
            statusChange(context, actor, "well-fed"),
            ...createSurvivalChanges([actor]),
          ],
        };
    }
  },
};

const CAMOUFLAGING_IN_BUSHES = createConditionedSoloEvent({
  id: "day-camouflaging-in-bushes",
  weight: 4,
  category: "hazard",
  tags: ["status"],
  acceptedOutcomes: FAILURE_OUTCOMES,
  score: (actor) => getEffectiveStats(actor).luck,
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} hears something approaching while foraging and covers ` +
          `${pronouns.reflexive} in leaves and mud before diving into a bush. The noise came from a deer, ` +
          "and the bush is almost exclusively thorns. " +
          `${actor.snapshot.name} crawls back out scraped and deeply embarrassed.`
        );
      },
      effects: (context, actor) => [statusChange(context, actor, "injured")],
    },
    failure: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} hears something approaching and quickly camouflages ` +
          `${pronouns.reflexive} in leaves and mud. A deer leaps into view and disappears into the forest, ` +
          `leaving ${actor.snapshot.name} sitting in the mud and feeling fairly silly.`
        );
      },
    },
    success: {
      text: () => {
        throw new Error("The camouflaging-in-bushes event cannot resolve a success.");
      },
    },
    "exceptional-success": {
      text: () => {
        throw new Error("The camouflaging-in-bushes event cannot resolve an exceptional success.");
      },
    },
  },
});

const THEFT_WHILE_DISTRACTED: EventDefinition = {
  id: "day-theft-while-distracted",
  category: "hazard",
  periods: ["day"],
  baseWeight: 3,
  tags: ["hazard", "item", "ambush", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      getWeight: (tribute) => getBrainsAndLuckScore(tribute),
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
      itemAccess: "owned",
      requiredItemDefinitionIds: ALL_ITEM_IDS,
      requiredItemUsableByRoleId: "actor",
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const item = getSelectedRoleItem(context, "target");
    const itemLabel = getItemLabel(item);
    const outcome = resolveScoreCheck({
      score: getBrainsAndLuckScore(actor),
      difficulty: clampStatCheckDifficulty(
        Math.max(DEFAULT_DIFFICULTY, getAwarenessScore(target, context.round)),
      ),
      random: context.random,
    });

    if (outcome === "critical-failure" || outcome === "failure") {
      return {
        text:
          `${actor.snapshot.name} follows ${target.snapshot.name} through the woods, waiting for an opening. ` +
          `${target.snapshot.name} sets ${targetPronouns.possessiveAdjective} pack down with the ${itemLabel} ` +
          `sticking out. ${actor.snapshot.name} reaches for it, but ${target.snapshot.name} catches ` +
          `${actorPronouns.object} in the act. ${actor.snapshot.name} runs with ` +
          `${target.snapshot.name} chasing close behind.`,
        changes: [
          statusChange(context, actor, "hunted", 1, target.id),
          ...createSurvivalChanges([actor, target]),
        ],
      };
    }

    if (outcome === "success") {
      return {
        text:
          `${actor.snapshot.name} follows ${target.snapshot.name} through the woods until ` +
          `${target.snapshot.name} sets down a pack with the ${itemLabel} sticking out. ` +
          `${actor.snapshot.name} decides it is better to grab it than risk a fight and disappears ` +
          `before ${target.snapshot.name} notices.`,
        changes: [
          createTransferChange(item, target, actor),
          ...createSurvivalChanges([actor, target]),
        ],
      };
    }

    return {
      text:
        `${actor.snapshot.name} finds ${target.snapshot.name} beside the lake, attempting to catch fish ` +
        `with bare hands. ${actor.snapshot.name} removes the ${itemLabel}, rearranges the remaining supplies ` +
        `so nothing looks disturbed, and slips away with ${target.snapshot.name} none the wiser.`,
      changes: [
        createTransferChange(item, target, actor),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const DISCOVERING_CAVE_FAILURE = createConditionedSoloEvent({
  id: "day-discovering-cave-failure",
  weight: 4,
  category: "hazard",
  tags: ["environment", "status"],
  acceptedOutcomes: FAILURE_OUTCOMES,
  score: (actor, context) =>
    (getAwarenessScore(actor, context.round) + getSurvivalScore(actor)) / 2,
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} crawls into a narrow cave looking for a hiding spot, only for the unstable ` +
          `ceiling to collapse over ${pronouns.object}. It takes several hours for ` +
          `${actor.snapshot.name} to dig ${pronouns.reflexive} free.`
        );
      },
      effects: (context, actor) => [statusChange(context, actor, "injured")],
    },
    failure: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} crawls into a narrow cave looking for a hiding spot. It is dark, damp, ` +
          `and foul-smelling, and ${pronouns.subject} lasts only an hour before deciding the safety is not worth it.`
        );
      },
    },
    success: {
      text: () => {
        throw new Error("The cave-failure definition cannot resolve a success.");
      },
    },
    "exceptional-success": {
      text: () => {
        throw new Error("The cave-failure definition cannot resolve an exceptional success.");
      },
    },
  },
});

const DISCOVERING_CAVE_SHELTER = createConditionedSoloEvent({
  id: "day-discovering-cave-shelter",
  weight: 4,
  tags: ["environment", "status"],
  acceptedOutcomes: SUCCESS_OUTCOMES,
  score: (actor, context) =>
    (getAwarenessScore(actor, context.round) + getSurvivalScore(actor)) / 2,
  outcomes: {
    "critical-failure": {
      text: () => {
        throw new Error("The cave-shelter definition cannot resolve a critical failure.");
      },
    },
    failure: {
      text: () => {
        throw new Error("The cave-shelter definition cannot resolve a failure.");
      },
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} discovers a dry cave with a narrow entrance and marks it as a safe place ` +
        "to return after dark.",
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} discovers a dry cave hidden behind hanging vines, clears the entrance, ` +
        "and prepares a shelter nearly impossible to see from outside.",
      effects: (context, actor) => [statusChange(context, actor, "hidden")],
    },
  },
});

const ATTACKING_SOMEONE_WHO_ESCAPES: EventDefinition = {
  id: "day-attacking-someone-who-escapes",
  category: "hazard",
  periods: ["day"],
  baseWeight: 3,
  tags: ["hazard", "combat", "ambush", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
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
    const changes: GameChange[] = [];

    if (context.random() < 0.5) {
      changes.push(statusChange(context, target, "hidden"));
    }

    return {
      text:
        `${actor.snapshot.name} attacks ${target.snapshot.name}, but ${target.snapshot.name} slips past ` +
        "the first strike and disappears into terrain too dense to follow safely.",
      changes: [...changes, ...createSurvivalChanges([actor, target])],
    };
  },
};

const CHASING_ANOTHER_TRIBUTE: EventDefinition = {
  id: "day-chasing-another-tribute",
  category: "hazard",
  periods: ["day"],
  baseWeight: 4,
  tags: ["hazard", "combat", "resource", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      getWeight: (tribute) => Math.max(getCombatScore(tribute), getSurvivalScore(tribute)),
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
    const outcome = resolveScoreCheck({
      score: Math.max(getCombatScore(actor), getSurvivalScore(actor)),
      difficulty: clampStatCheckDifficulty(Math.max(DEFAULT_DIFFICULTY, getSurvivalScore(target))),
      random: context.random,
    });

    switch (outcome) {
      case "critical-failure":
        return {
          text:
            `${actor.snapshot.name} chases ${target.snapshot.name} through the trees, clears a large root, ` +
            `and immediately smacks ${actorPronouns.possessiveAdjective} head on a low branch. ` +
            `${actorPronouns.Subject} blacks out long enough for ${target.snapshot.name} to escape.`,
          changes: [
            statusChange(context, actor, "injured"),
            ...createSurvivalChanges([actor, target]),
          ],
        };
      case "failure":
        return {
          text:
            `${actor.snapshot.name} chases ${target.snapshot.name} across the arena but loses ` +
            `${targetPronouns.object} after the trail splits across rocky ground.`,
          changes: createSurvivalChanges([actor, target]),
        };
      case "success":
        return {
          text:
            `${actor.snapshot.name} spots ${target.snapshot.name} stealing eggs from a nest and startles ` +
            `${targetPronouns.object} out of the tree. ${target.snapshot.name} runs away, leaving ` +
            `${actor.snapshot.name} free to take the food.`,
          changes: [survivalNeedChange(actor, "food"), ...createSurvivalChanges([actor, target])],
        };
      case "exceptional-success":
        return {
          text:
            `${actor.snapshot.name} spots ${target.snapshot.name} stealing eggs from a nest and startles ` +
            `${targetPronouns.object} out of the tree. ${target.snapshot.name} strikes several branches on ` +
            `the way down and limps away, leaving ${actor.snapshot.name} free to take the food.`,
          changes: [
            survivalNeedChange(actor, "food"),
            statusChange(context, target, "injured", 1, actor.id),
            ...createSurvivalChanges([actor, target]),
          ],
        };
    }
  },
};

const SEARCHING_FOR_WATER = createSoloCheckedEvent({
  id: "day-searching-for-water",
  weight: 7,
  tags: ["resource", "status"],
  score: (actor) => Math.max(getForagingScore(actor), getSurvivalScore(actor)),
  getWeight: (actor) => Math.max(getForagingScore(actor), getSurvivalScore(actor)),
  isEligible: (tribute) =>
    !hasDeprivationProtection(tribute, "water") &&
    !tribute.inventory.some((item) => item.definitionId === CORNUCOPIA_PROVISIONS_ITEM_ID),
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} drinks from the first source of water ` +
          `${pronouns.subject} can find. Unfortunately, it is stagnant runoff, and ` +
          `${pronouns.subject} becomes violently ill before realizing the mistake.`
        );
      },
      effects: (context, actor) => [statusChange(context, actor, "poisoned")],
    },
    failure: {
      text: (actor) =>
        `${actor.snapshot.name} searches for water until sunset but finds only dry creek beds.`,
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} follows damp ground into a shaded hollow and finds clean water pooled between the rocks.`,
      effects: (_context, actor) => [survivalNeedChange(actor, "water")],
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} follows damp ground into a shaded hollow and finds clean water pooled between the rocks.`,
      effects: (_context, actor) => [survivalNeedChange(actor, "water")],
    },
  },
});

function untrucedCombatRoles(): readonly ParticipantRoleDefinition[] {
  return [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, context) => isUntruced(tribute, context) && !hasOwnedWeapon(tribute),
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
      isEligible: isUntruced,
    },
  ];
}

const DEFEATING_BUT_SPARING: EventDefinition = {
  id: "day-defeating-but-sparing",
  category: "hazard",
  periods: ["day"],
  baseWeight: 3,
  tags: ["hazard", "combat", "status"],
  roles: untrucedCombatRoles(),
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const outcome = resolveScoreCheck({
      score: getCombatScore(actor),
      difficulty: clampStatCheckDifficulty(Math.max(DEFAULT_DIFFICULTY, getCombatScore(target))),
      random: context.random,
    });

    switch (outcome) {
      case "critical-failure": {
        const text = choose(context.random, [
          `${actor.snapshot.name} flees through the woods with ${target.snapshot.name} close behind. ` +
            `${actorPronouns.Subject} trips over a sharp rock, slicing open ${actorPronouns.possessiveAdjective} leg. ` +
            `Grabbing the bloodied stone, ${actorPronouns.subject} catches ${target.snapshot.name} in the forehead. ` +
            "They both collapse bleeding until the target slowly backs away.",
          `${actor.snapshot.name} trips over a fallen branch while fleeing ${target.snapshot.name}, tearing open ` +
            `${actorPronouns.possessiveAdjective} side. ${actor.snapshot.name} swings the branch wildly and catches ` +
            `${target.snapshot.name} across the face. They both collapse bloodied before separating.`,
          `${actor.snapshot.name} tumbles over a steep ledge while fleeing ${target.snapshot.name} and lands among ` +
            `sharp stones. When ${target.snapshot.name} peers down, ${actor.snapshot.name} hurls a rock into ` +
            `${targetPronouns.possessiveAdjective} forehead. Both tributes retreat bleeding.`,
        ]);

        return {
          text,
          changes: [
            statusChange(context, actor, "bleeding"),
            statusChange(context, target, "bleeding", 1, actor.id),
            ...createSurvivalChanges([actor, target]),
          ],
        };
      }
      case "failure": {
        const text = choose(context.random, [
          `${actor.snapshot.name} trips over a sharp rock while fleeing ${target.snapshot.name}, slicing open ` +
            `${actorPronouns.possessiveAdjective} leg. ${actor.snapshot.name} raises the bloodied stone with such ` +
            `desperation that ${target.snapshot.name} decides the chase is not worth finishing.`,
          `${actor.snapshot.name} crashes into a fallen branch while fleeing ${target.snapshot.name}. Bleeding and ` +
            `sprawled on the ground, ${actor.snapshot.name} swings the branch wildly until ${target.snapshot.name} retreats.`,
          `${actor.snapshot.name} tumbles down a steep ledge while fleeing ${target.snapshot.name}. When ` +
            `${target.snapshot.name} peers over the edge, ${actor.snapshot.name} hurls a loose stone upward and misses ` +
            "by inches. Unwilling to climb down after someone still fighting back, the target leaves.",
        ]);

        return {
          text,
          changes: [
            statusChange(context, actor, "bleeding"),
            ...createSurvivalChanges([actor, target]),
          ],
        };
      }
      case "success": {
        const text = choose(context.random, [
          `${actor.snapshot.name} snatches a sharp rock from the path and catches ${target.snapshot.name} squarely ` +
            `in the forehead. With ${target.snapshot.name} bleeding and disoriented, ${actor.snapshot.name} spares ` +
            `${targetPronouns.object} and escapes.`,
          `${actor.snapshot.name} grabs a fallen branch without slowing and swings it backward into ` +
            `${target.snapshot.name}'s face. With the target injured and struggling to rise, ` +
            `${actor.snapshot.name} decides to spare ${targetPronouns.object}.`,
          `${actor.snapshot.name} sidesteps at the edge of a cliff and sends ${target.snapshot.name} tumbling onto ` +
            `sharp rocks below. Hearing injured groans, ${actor.snapshot.name} backs away without finishing the fight.`,
        ]);

        return {
          text,
          changes: [
            statusChange(context, target, "bleeding", 1, actor.id),
            ...createSurvivalChanges([actor, target]),
          ],
        };
      }
      case "exceptional-success":
        return {
          text:
            `${actor.snapshot.name} flees from ${target.snapshot.name} toward a steep cliff and sidesteps at the ` +
            `last moment, sending ${target.snapshot.name} over the edge. ${actor.snapshot.name} peers down and finds ` +
            `${target.snapshot.name} clinging to a branch within reach. Against ` +
            `${actorPronouns.possessiveAdjective} better judgement, ${actor.snapshot.name} pulls ` +
            `${targetPronouns.object} to safety. Grateful, ${target.snapshot.name} agrees to a cautious truce.`,
          changes: [
            createStandardTruceChange(context, [actor, target]),
            ...createSurvivalChanges([actor, target]),
          ],
        };
    }
  },
};

const SLEEPING_THROUGH_DAY: EventDefinition = {
  id: "day-sleeping-through-day",
  category: "survival",
  periods: ["day"],
  baseWeight: 3,
  tags: ["survival", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      getWeight: (tribute, context) =>
        Math.max(0.25, 6 - getAwarenessScore(tribute, context.round)),
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} decides it is time to catch up on sleep, life-threatening blood-hungry ` +
        `tributes be damned. ${pronouns.Subject} finds a soft patch of grass and drifts into unconsciousness.`,
      changes: [
        ...reduceStatusSeverityChanges(context, actor, "exhausted", 1),
        ...removeStatusChanges(actor, "alert"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const RAIDING_UNATTENDED_CAMP: EventDefinition = {
  id: "day-raiding-unattended-camp",
  category: "hazard",
  periods: ["day"],
  baseWeight: 2,
  tags: ["hazard", "item", "ambush", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      getWeight: (tribute) => getBrainsAndLuckScore(tribute),
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
      itemAccess: "owned",
      requiredItemDefinitionIds: ALL_ITEM_IDS,
      requiredItemUsableByRoleId: "actor",
      isEligible: (tribute, { state, participantsByRole }) => {
        const actor = participantsByRole.actor?.[0];
        const truce = getActiveTruceForTribute(state, tribute.id);

        return (
          actor !== undefined &&
          truce !== null &&
          getLivingTruceMembers(state, truce).length >= 2 &&
          !truce.tributeIds.includes(actor.id)
        );
      },
    },
    {
      id: "ally",
      count: 1,
      isEligible: (tribute, { state, participantsByRole }) => {
        const target = participantsByRole.target?.[0];
        const actor = participantsByRole.actor?.[0];

        return (
          target !== undefined &&
          actor !== undefined &&
          areTributesInSameTruce(state, target.id, tribute.id) &&
          !areTributesInSameTruce(state, actor.id, tribute.id)
        );
      },
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const ally = requireSingleParticipant(context.participantsByRole, "ally");
    const actorPronouns = getTributePronouns(actor);
    const item = getSelectedRoleItem(context, "target");
    const itemLabel = getItemLabel(item);
    const outcome = resolveScoreCheck({
      score: getBrainsAndLuckScore(actor),
      difficulty: DEFAULT_DIFFICULTY,
      random: context.random,
    });

    if (outcome === "critical-failure") {
      return {
        text:
          `${actor.snapshot.name} spies ${target.snapshot.name} and ${ally.snapshot.name}'s unattended camp ` +
          `and approaches carefully. ${actorPronouns.Subject} triggers a simple net trap and barely escapes ` +
          `as the pair appears through the trees.`,
        changes: [
          statusChange(context, actor, "hunted"),
          ...createSurvivalChanges([actor, target, ally]),
        ],
      };
    }

    if (outcome === "failure") {
      return {
        text:
          `${actor.snapshot.name} spies ${target.snapshot.name} and ${ally.snapshot.name}'s unattended camp, ` +
          `but triggers a simple net trap while searching it. ${actorPronouns.Subject} escapes before anyone returns.`,
        changes: createSurvivalChanges([actor, target, ally]),
      };
    }

    return {
      text:
        `${actor.snapshot.name} spies ${target.snapshot.name} and ${ally.snapshot.name}'s unattended camp, ` +
        `plucks the ${itemLabel} from a backpack, and slips away before anyone returns.`,
      changes: [
        createTransferChange(item, target, actor),
        ...createSurvivalChanges([actor, target, ally]),
      ],
    };
  },
};

function createFoodSubstitutionEvent(
  id: string,
  itemIds: readonly ItemDefinitionId[],
  statusId: "poisoned" | "disoriented",
  weight: number,
): EventDefinition {
  return {
    id,
    category: "hazard",
    periods: ["day"],
    baseWeight: weight,
    tags: ["hazard", "item", "ambush", "resource", "status"],
    getWeightMultiplier(context) {
      const eligibleActors = context.livingTributes.filter((tribute) =>
        tribute.inventory.some((item) => itemIds.includes(item.definitionId)),
      );

      if (eligibleActors.length === 0) {
        return 0;
      }

      return (
        eligibleActors.reduce(
          (sum, tribute) =>
            sum + getOutcomeGroupProbability(getEffectiveStats(tribute).brains, SUCCESS_OUTCOMES),
          0,
        ) / eligibleActors.length
      );
    },
    roles: [
      {
        id: "actor",
        count: 1,
        itemAccess: "owned",
        requiredItemDefinitionIds: itemIds,
        getWeight: (tribute) =>
          getOutcomeGroupProbability(getEffectiveStats(tribute).brains, SUCCESS_OUTCOMES),
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
      const item = getSelectedRoleItem(context, "actor");
      const itemLabel = getItemLabel(item);

      selectConditionalOutcome(getEffectiveStats(actor).brains, SUCCESS_OUTCOMES, context.random);

      return {
        text:
          `${actor.snapshot.name} spies ${target.snapshot.name} washing food by the river. ` +
          `${actor.snapshot.name} steals and eats the good food, replacing it with ${itemLabel} ` +
          `without ${target.snapshot.name} noticing, then remains hidden long enough to watch ` +
          `${targetPronouns.object} eat every last morsel.`,
        changes: [
          createItemUseChange(actor, item, id),
          survivalNeedChange(actor, "food"),
          survivalNeedChange(target, "food"),
          statusChange(context, target, statusId, 1, actor.id),
          ...createSurvivalChanges([actor, target]),
        ],
      };
    },
  };
}

const POISON_A_TRIBUTE = createFoodSubstitutionEvent(
  "day-poison-a-tribute",
  POISONOUS_FORAGE_ITEM_IDS,
  "poisoned",
  1.5,
);

const SPEARFISHING: EventDefinition = {
  id: "day-spearfishing",
  category: "survival",
  periods: ["day"],
  baseWeight: 4,
  tags: ["survival", "resource", "item", "weapon", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      itemAccess: "owned",
      requiredItemDefinitionIds: ["trident", "spear"],
      getWeight: (tribute) => getEffectiveStats(tribute).brawn,
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const weapon = getSelectedRoleItem(context, "actor");
    const weaponLabel = getItemLabel(weapon);
    const outcome = resolveScoreCheck({
      score: getEffectiveStats(actor).brawn,
      difficulty: DEFAULT_DIFFICULTY,
      random: context.random,
    });
    const useChange = createItemUseChange(actor, weapon, "day-spearfishing");

    switch (outcome) {
      case "critical-failure":
        return {
          text:
            `${actor.snapshot.name} takes ${pronouns.possessiveAdjective} ${weaponLabel} to the river ` +
            `and tries to catch fish. River rocks are slipperier than expected, and ` +
            `${actor.snapshot.name} leaves after several bruising hours with no fish.`,
          changes: [
            useChange,
            statusChange(context, actor, "injured"),
            ...createSurvivalChanges([actor]),
          ],
        };
      case "failure":
        return {
          text:
            `${actor.snapshot.name} takes ${pronouns.possessiveAdjective} ${weaponLabel} to the river. ` +
            `After several miserable hours on slippery rocks, ${actor.snapshot.name} leaves with several ` +
            "bruises and, thankfully, an equal number of fish.",
          changes: [
            useChange,
            statusChange(context, actor, "injured"),
            survivalNeedChange(actor, "food"),
            ...createSurvivalChanges([actor]),
          ],
        };
      case "success":
        return {
          text:
            `${actor.snapshot.name} takes ${pronouns.possessiveAdjective} ${weaponLabel} to the river. ` +
            "It is not easy, but the effort produces a good meal and thoroughly soaked clothes.",
          changes: [
            useChange,
            survivalNeedChange(actor, "food"),
            ...createSurvivalChanges([actor]),
          ],
        };
      case "exceptional-success":
        return {
          text:
            `${actor.snapshot.name} takes ${pronouns.possessiveAdjective} ${weaponLabel} to the river ` +
            `and discovers ${pronouns.subject} is a natural, catching more than enough food for one meal.`,
          changes: [
            useChange,
            survivalNeedChange(actor, "food"),
            statusChange(context, actor, "well-fed"),
            ...createSurvivalChanges([actor]),
          ],
        };
    }
  },
};

const SPLITTING_UP_TO_SEARCH: EventDefinition = {
  id: "day-splitting-up-to-search",
  category: "survival",
  periods: ["day"],
  baseWeight: 3,
  tags: ["survival", "cooperative", "truce", "resource"],
  roles: [alliedPairRole()],
  resolve(context) {
    const tributes = requireParticipants(context.participantsByRole, "tributes");

    if (tributes.length !== 2) {
      throw new Error("Splitting up to search requires two allied tributes.");
    }

    const [actor, target] = tributes;

    if (!actor || !target) {
      throw new Error("Splitting up to search is missing a tribute.");
    }

    return {
      text:
        `${actor.snapshot.name} and ${target.snapshot.name} agree to split up while searching for resources, ` +
        "marking a place to meet again before nightfall. Both return with enough food and water.",
      changes: [
        survivalNeedChange(actor, "food"),
        survivalNeedChange(actor, "water"),
        survivalNeedChange(target, "food"),
        survivalNeedChange(target, "water"),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const HALLUCINATE_A_TRIBUTE = createFoodSubstitutionEvent(
  "day-hallucinate-a-tribute",
  HALLUCINOGENIC_FORAGE_ITEM_IDS,
  "disoriented",
  1.5,
);

const SNEAKING_A_NAP = createSoloCheckedEvent({
  id: "day-sneaking-a-nap",
  weight: 5,
  tags: ["status"],
  score: (actor) => getEffectiveStats(actor).luck,
  getWeight: (actor) => getEffectiveStats(actor).luck,
  isEligible: (tribute) =>
    tribute.statuses.some((status) => status.definitionId === "exhausted" && status.severity >= 2),
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} is so tired that ${pronouns.subject} searches for somewhere quiet to rest. ` +
          "The sounds of fighting make sleep impossible, and before long " +
          `${actor.snapshot.name} returns to running through the woods.`
        );
      },
    },
    failure: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} is so tired that ${pronouns.subject} searches for somewhere quiet to rest. ` +
          "The sounds of fighting make sleep impossible, and before long " +
          `${actor.snapshot.name} returns to running through the woods.`
        );
      },
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} finds somewhere quiet to rest. Somehow no one discovers the snoring, ` +
        `and the nap leaves ${getTributePronouns(actor).object} renewed.`,
      effects: (context, actor) => reduceStatusSeverityChanges(context, actor, "exhausted", 2),
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} finds somewhere quiet to rest. Somehow no one discovers the snoring, ` +
        `and the nap leaves ${getTributePronouns(actor).object} remarkably well rested.`,
      effects: (context, actor) => [
        ...removeStatusChanges(actor, "exhausted"),
        statusChange(context, actor, "well-rested"),
      ],
    },
  },
});

export const DAY_EVENTS_16_33 = [
  SCARING_OFF_ANOTHER_TRIBUTE,
  CREATING_A_DIVERSION,
  STALKING_ANOTHER_TRIBUTE,
  FISHING,
  CAMOUFLAGING_IN_BUSHES,
  THEFT_WHILE_DISTRACTED,
  DISCOVERING_CAVE_FAILURE,
  DISCOVERING_CAVE_SHELTER,
  ATTACKING_SOMEONE_WHO_ESCAPES,
  CHASING_ANOTHER_TRIBUTE,
  SEARCHING_FOR_WATER,
  DEFEATING_BUT_SPARING,
  SLEEPING_THROUGH_DAY,
  RAIDING_UNATTENDED_CAMP,
  POISON_A_TRIBUTE,
  SPEARFISHING,
  SPLITTING_UP_TO_SEARCH,
  HALLUCINATE_A_TRIBUTE,
  SNEAKING_A_NAP,
] satisfies readonly EventDefinition[];
