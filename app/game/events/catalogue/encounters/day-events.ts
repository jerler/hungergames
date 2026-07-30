import { getEffectiveStats } from "~/game/engine/effective-stats";
import { getAwarenessScore, getForagingScore, getSurvivalScore } from "~/game/engine/stat-formulas";
import { selectWeightedItem } from "~/game/engine/random";
import {
  createItemAcquisitionAndSurvivalChanges,
  createItemUseChange,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { resolveScoreCheck, type StatCheckOutcome } from "~/game/events/event-outcomes";
import {
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
import {
  createTruceInstance,
  getActiveTruceForTribute,
  getLivingTruceMembers,
  canStandardTrucePersist,
  STANDARD_TRUCE_EXPIRY_ROUND,
} from "~/game/truces/truce-engine";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameChange, GameTribute } from "~/game/types/game-state";

const DEFAULT_DIFFICULTY = 3;

const REUSABLE_WEAPON_IDS = ITEM_CATALOGUE.flatMap((definition) =>
  (definition.tags as readonly string[]).includes("weapon") && definition.maxUses === undefined
    ? [definition.id]
    : [],
);

interface WeightedOutcome {
  outcome: StatCheckOutcome;
  weight: number;
}

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

interface StaticSoloEventOptions {
  id: string;
  weight: number;
  category?: EventDefinition["category"];
  tags?: readonly EventDefinition["tags"][number][];
  text: (actor: GameTribute) => string;
  effects?: (context: EventResolutionContext, actor: GameTribute) => readonly GameChange[];
  getWeight?: ParticipantRoleDefinition["getWeight"];
  isEligible?: ParticipantRoleDefinition["isEligible"];
}

function mergeTags(
  ...tagGroups: readonly (readonly EventDefinition["tags"][number][])[]
): EventDefinition["tags"][number][] {
  return [...new Set(tagGroups.flat())];
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
  statusId: "alert" | "hidden" | "well-fed" | "inspired" | "disoriented" | "injured",
  severity: 1 | 2 | 3 = 1,
): GameChange {
  return createStatusChange(context.eventId, tribute, statusId, severity, context.round);
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

function createStaticSoloEvent({
  id,
  weight,
  category = "survival",
  tags = [],
  text,
  effects,
  getWeight,
  isEligible,
}: StaticSoloEventOptions): EventDefinition {
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

      return {
        text: text(actor),
        changes: [...(effects?.(context, actor) ?? []), ...createSurvivalChanges([actor])],
      };
    },
  };
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

function getWeightedOutcomes(score: number): WeightedOutcome[] {
  const advantage = score - DEFAULT_DIFFICULTY;

  return ["critical-failure", "failure", "success", "exceptional-success"].map((outcome) => ({
    outcome: outcome as StatCheckOutcome,
    weight: getOutcomeWeight(outcome as StatCheckOutcome, advantage),
  }));
}

function getOutcomeGroupProbability(
  score: number,
  acceptedOutcomes: ReadonlySet<StatCheckOutcome>,
): number {
  const weightedOutcomes = getWeightedOutcomes(score);
  const totalWeight = weightedOutcomes.reduce((sum, entry) => sum + entry.weight, 0);
  const acceptedWeight = weightedOutcomes.reduce(
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
  const candidates = getWeightedOutcomes(score).filter(({ outcome }) =>
    acceptedOutcomes.has(outcome),
  );

  return selectWeightedItem(candidates, ({ weight }) => weight, random).outcome;
}

/**
 * A conditioned event is mathematically equivalent to selecting a
 * normal four-result check and discarding the event when the result
 * falls outside the accepted group:
 *
 * - the event's catalogue weight is multiplied by the average chance
 *   that an eligible tribute reaches the accepted outcome group;
 * - participant weighting favours tributes most likely to produce it;
 * - resolution samples only within the accepted group.
 *
 * This preserves the intended reroll behaviour without making
 * EventDefinition.resolve nullable or changing the sequencer contract.
 */
function createConditionedSoloEvent({
  id,
  weight,
  category = "survival",
  tags = [],
  acceptedOutcomes,
  score,
  outcomes,
}: SoloCheckedEventOptions & {
  acceptedOutcomes: ReadonlySet<StatCheckOutcome>;
}): EventDefinition {
  const getProbability = (
    tribute: GameTribute,
    context: EventSelectionContext | EventResolutionContext,
  ): number =>
    getOutcomeGroupProbability(
      score(tribute, {
        ...context,
        eventId: "conditioned-weight-preview",
        random: () => 0.5,
        participantsByRole: {
          actor: [tribute],
        },
      } as EventResolutionContext),
      acceptedOutcomes,
    );

  return {
    id,
    category,
    periods: ["day"],
    baseWeight: weight,
    tags: mergeTags([category], tags),
    getWeightMultiplier(context) {
      if (context.livingTributes.length === 0) {
        return 0;
      }

      return (
        context.livingTributes.reduce((sum, tribute) => sum + getProbability(tribute, context), 0) /
        context.livingTributes.length
      );
    },
    roles: [
      {
        id: "actor",
        count: 1,
        getWeight: (tribute, context) => Math.max(0.01, getProbability(tribute, context)),
      },
    ],
    resolve(context) {
      const actor = requireSingleParticipant(context.participantsByRole, "actor");
      const actorScore = score(actor, context);
      const outcome = selectConditionalOutcome(actorScore, acceptedOutcomes, context.random);

      return resolveSoloOutcome(context, actor, outcomes[outcome]);
    },
  };
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
      STANDARD_TRUCE_EXPIRY_ROUND,
    ),
  };
}

function getSelectedItem(context: EventResolutionContext, roleId: string) {
  const selection = context.itemsByRole?.[roleId]?.[0];

  if (!selection) {
    throw new Error(`Day event "${context.eventId}" is missing selected item role "${roleId}".`);
  }

  return selection;
}

const EXPLORING_ARENA = createSoloCheckedEvent({
  id: "day-exploring-arena",
  weight: 7,
  tags: ["status"],
  score: (actor) => getEffectiveStats(actor).brains,
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} spends the day exploring the arena, ` +
          "but the trees all look identical, leaving " +
          `${pronouns.object} less certain of ` +
          `${pronouns.possessiveAdjective} location than when ` +
          `${pronouns.subject} started.`
        );
      },
      effects: (context, actor) => [statusChange(context, actor, "disoriented")],
    },
    failure: {
      text: (actor) =>
        `${actor.snapshot.name} spends the day exploring the arena, ` +
        "but the trees all look identical and the search ends with " +
        "nothing to show for it except the relief of still being alive.",
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} spends the day exploring the arena carefully, ` +
        "memorizing landmarks and potential ambush zones.",
      effects: (context, actor) => [statusChange(context, actor, "alert")],
    },
    "exceptional-success": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} spends the day exploring the arena carefully, ` +
          `mapping the safest routes in ${pronouns.possessiveAdjective} head ` +
          "and identifying several places to hide."
        );
      },
      effects: (context, actor) => [
        statusChange(context, actor, "alert"),
        statusChange(context, actor, "hidden"),
      ],
    },
  },
});

const COLLECTING_FRUIT = createSoloCheckedEvent({
  id: "day-collecting-fruit",
  weight: 8,
  tags: ["resource", "status"],
  score: (actor) => getForagingScore(actor),
  getWeight: (actor) => getForagingScore(actor),
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} spends several hours searching through ` +
          "bushes for berries, but has only scrapes and splinters to show " +
          `for ${pronouns.possessiveAdjective} efforts.`
        );
      },
    },
    failure: {
      text: (actor) =>
        `${actor.snapshot.name} spends several hours searching through ` +
        "bushes for berries, but finds that the birds reached everything edible first.",
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} climbs a fruit tree and returns with ` +
        `enough food to quiet ${getTributePronouns(actor).possessiveAdjective} hunger.`,
      effects: (_context, actor) => [survivalNeedChange(actor, "food")],
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} finds a tree heavy with ripe fruit ` + "and eats until full.",
      effects: (context, actor) => [
        survivalNeedChange(actor, "food"),
        statusChange(context, actor, "well-fed"),
      ],
    },
  },
});

const WORKING_TOGETHER: EventDefinition = {
  id: "day-working-together",
  category: "survival",
  periods: ["day"],
  baseWeight: 3,
  tags: ["survival", "cooperative", "truce", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isUntruced,
    },
    {
      id: "target",
      count: 1,
      isEligible: isUntruced,
    },
  ],
  isEligible: ({ state, round }) => canStandardTrucePersist(state, round),

  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} spends the day searching for food. ` +
        `${actorPronouns.Subject} digs through bushes until ` +
        `${actorPronouns.subject} is surprised by ${target.snapshot.name} ` +
        "using one as a hiding spot. After a brief pause, " +
        `${actor.snapshot.name} and ${target.snapshot.name} agree that ` +
        "surviving will be easier together. They travel side by side, " +
        "watching opposite directions.",
      changes: [
        createStandardTruceChange(context, [actor, target]),
        statusChange(context, actor, "alert"),
        statusChange(context, target, "alert"),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

function overhearingPairRole(id: "target" | "bystander"): ParticipantRoleDefinition {
  return {
    id,
    count: 1,
    isEligible: (tribute, { state, participantsByRole }) => {
      const target = participantsByRole.target?.[0];

      if (id === "target") {
        const truce = getActiveTruceForTribute(state, tribute.id);

        return truce !== null && getLivingTruceMembers(state, truce).length >= 2;
      }

      if (!target) {
        return false;
      }

      const targetTruce = getActiveTruceForTribute(state, target.id);

      return targetTruce?.tributeIds.includes(tribute.id) ?? false;
    },
  };
}

const OVERHEARING_A_CONVERSATION: EventDefinition = {
  id: "day-overhearing-conversation",
  category: "survival",
  periods: ["day"],
  baseWeight: 2,
  tags: ["survival", "ambush", "resource", "status"],
  roles: [
    overhearingPairRole("target"),
    overhearingPairRole("bystander"),
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state, participantsByRole }) => {
        const target = participantsByRole.target?.[0];

        return (
          target !== undefined &&
          getActiveTruceForTribute(state, target.id)?.tributeIds.includes(tribute.id) !== true
        );
      },
      getWeight: (tribute, context) => getAwarenessScore(tribute, context.round),
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const target = requireSingleParticipant(context.participantsByRole, "target");
    const bystander = requireSingleParticipant(context.participantsByRole, "bystander");
    const pronouns = getTributePronouns(actor);
    const outcome = resolveScoreCheck({
      score: getAwarenessScore(actor, context.round),
      difficulty: DEFAULT_DIFFICULTY,
      random: context.random,
    });

    switch (outcome) {
      case "critical-failure":
      case "failure":
        return {
          text:
            `${actor.snapshot.name} spends the day searching for other tributes. ` +
            `After a few hours, ${pronouns.subject} hears voices in the distance ` +
            "but cannot pinpoint their location and eventually loses track of them.",
          changes: createSurvivalChanges([actor, target, bystander]),
        };
      case "success":
        return {
          text:
            `${actor.snapshot.name} spends the day searching for other tributes. ` +
            `After a few hours, ${pronouns.subject} hears ` +
            `${target.snapshot.name} and ${bystander.snapshot.name} talking nearby, ` +
            "learning which direction they plan to travel. " +
            `${actor.snapshot.name} decides to try to ambush them later and backs away quietly.`,
          changes: [
            statusChange(context, actor, "alert"),
            ...createSurvivalChanges([actor, target, bystander]),
          ],
        };
      case "exceptional-success":
        return {
          text:
            `${actor.snapshot.name} spends the day searching for other tributes. ` +
            `After a few hours, ${pronouns.subject} hears ` +
            `${target.snapshot.name} and ${bystander.snapshot.name} discussing ` +
            "where they believe food can be found. " +
            `${actor.snapshot.name} slips away, reaches it first, and eats before the pair arrives.`,
          changes: [
            survivalNeedChange(actor, "food"),
            ...createSurvivalChanges([actor, target, bystander]),
          ],
        };
    }
  },
};

const PRACTISING_WEAPONRY: EventDefinition = {
  id: "day-practising-weaponry",
  category: "survival",
  periods: ["day"],
  baseWeight: 3,
  tags: ["survival", "item", "weapon", "status"],
  roles: [
    {
      id: "actor",
      count: 1,
      itemAccess: "owned",
      requiredItemDefinitionIds: REUSABLE_WEAPON_IDS,
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const selection = getSelectedItem(context, "actor");
    const weaponLabel = getItemDefinition(selection.item.definitionId).label.toLowerCase();
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} spends the afternoon practising with ` +
        `${pronouns.possessiveAdjective} ${weaponLabel}, adjusting ` +
        `${pronouns.possessiveAdjective} technique to deadly accuracy.`,
      changes: [
        createItemUseChange(selection.owner, selection.item, "day-practising-weaponry"),
        statusChange(context, actor, "inspired"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const THINKING_ABOUT_HOME = createStaticSoloEvent({
  id: "day-thinking-about-home",
  weight: 2,
  text: (actor) => `${actor.snapshot.name} spends the day feeling homesick.`,
});

const PRICKED_BY_THORNS = createStaticSoloEvent({
  id: "day-pricked-by-thorns",
  weight: 3,
  category: "hazard",
  tags: ["resource", "status"],
  getWeight: (actor) => getForagingScore(actor),
  text: (actor) =>
    `${actor.snapshot.name} reaches too deeply into a thorned berry bush ` +
    "and emerges scratched, irritated, and holding fewer berries than expected.",
  effects: (context, actor) => [
    statusChange(context, actor, "injured"),
    survivalNeedChange(actor, "food"),
  ],
});

const SEARCHING_FOR_FIREWOOD: EventDefinition = {
  id: "day-searching-for-firewood",
  category: "survival",
  periods: ["day"],
  baseWeight: 5,
  tags: ["survival", "resource", "item", "tool"],
  roles: [
    {
      id: "actor",
      count: 1,
      getWeight: (actor) => getForagingScore(actor),
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");

    return {
      text:
        `${actor.snapshot.name} spends hours gathering dry firewood, ` +
        "hoping for a warm night's sleep that evening.",
      changes: createItemAcquisitionAndSurvivalChanges(
        context.eventId,
        actor,
        ["kindling"],
        context.round,
        "natural-foraging",
      ),
    };
  },
};

const PICKING_FLOWERS = createStaticSoloEvent({
  id: "day-picking-flowers",
  weight: 2,
  text: (actor) =>
    `${actor.snapshot.name} rejects the institution of the Hunger Games ` +
    "by spending the day picking handfuls of wildflowers.",
});

const IGNORING_DISTANT_SMOKE = createStaticSoloEvent({
  id: "day-ignoring-distant-smoke",
  weight: 3,
  tags: ["status"],
  getWeight: (actor, context) =>
    Math.max(getEffectiveStats(actor).brains, getAwarenessScore(actor, context.round)),
  text: (actor) =>
    `${actor.snapshot.name} sees smoke rising above the trees, ` +
    "considers investigating, and decides that anyone advertising " +
    "their location is too dangerous to approach.",
  effects: (context, actor) => [statusChange(context, actor, "alert")],
});

const REACHING_HIGHER_GROUND = createSoloCheckedEvent({
  id: "day-reaching-higher-ground",
  weight: 5,
  tags: ["status"],
  score: (actor) => getEffectiveStats(actor).brains,
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} climbs toward higher ground to look for other tributes. ` +
          `After a difficult ascent, ${pronouns.subject} discovers that the only ` +
          `thing ${pronouns.subject} can see is leaves.`
        );
      },
    },
    failure: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} climbs toward higher ground to look for other tributes. ` +
          `After a difficult ascent, ${pronouns.subject} discovers that the only ` +
          `thing ${pronouns.subject} can see is leaves.`
        );
      },
    },
    success: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} climbs toward higher ground to look for other tributes. ` +
          `From the top, ${pronouns.subject} has a clear view of the forest ` +
          "and would be able to spot anyone approaching."
        );
      },
      effects: (context, actor) => [statusChange(context, actor, "alert")],
    },
    "exceptional-success": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} climbs toward higher ground to look for other tributes. ` +
          `From the top, ${pronouns.subject} has a clear view of the forest ` +
          "while remaining well hidden by the leaves."
        );
      },
      effects: (context, actor) => [
        statusChange(context, actor, "alert"),
        statusChange(context, actor, "hidden"),
      ],
    },
  },
});

const SUCCESS_OUTCOMES = new Set<StatCheckOutcome>(["success", "exceptional-success"]);

const DISCOVERING_A_RIVER = createConditionedSoloEvent({
  id: "day-discovering-river",
  weight: 7,
  tags: ["resource"],
  acceptedOutcomes: SUCCESS_OUTCOMES,
  score: (actor, context) => getAwarenessScore(actor, context.round),
  outcomes: {
    "critical-failure": {
      text: () => {
        throw new Error("The discovering-river event cannot resolve a critical failure.");
      },
    },
    failure: {
      text: () => {
        throw new Error("The discovering-river event cannot resolve a failure.");
      },
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} follows the sound of moving water ` +
        "and discovers a clear river cutting through the arena.",
      effects: (_context, actor) => [survivalNeedChange(actor, "water")],
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} discovers a clear river, drinks deeply, ` +
        "and chows down on berries growing nearby.",
      effects: (_context, actor) => [
        survivalNeedChange(actor, "water"),
        survivalNeedChange(actor, "food"),
      ],
    },
  },
});

const QUESTIONING_SANITY = createStaticSoloEvent({
  id: "day-questioning-sanity",
  weight: 2,
  category: "hazard",
  tags: ["status"],
  getWeight: (actor) => Math.max(0.25, 6 - getEffectiveStats(actor).luck),
  text: (actor) =>
    `${actor.snapshot.name} becomes convinced that the same crow has ` +
    "been following them for hours and begins questioning whether " +
    "they are losing their mind.",
  effects: (context, actor) => [statusChange(context, actor, "disoriented")],
});

const HUNTING_FOR_FOOD: EventDefinition = {
  id: "day-hunting-for-food",
  category: "survival",
  periods: ["day"],
  baseWeight: 6,
  tags: ["survival", "resource", "item", "weapon"],
  roles: [
    {
      id: "actor",
      count: 1,
      itemAccess: "owned",
      requiredItemTags: ["weapon"],
      isEligible: (tribute) =>
        !hasDeprivationProtection(tribute, "food") &&
        !tribute.inventory.some((item) => item.definitionId === CORNUCOPIA_PROVISIONS_ITEM_ID),
      getWeight: (tribute) => Math.max(getForagingScore(tribute), getSurvivalScore(tribute)),
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const selection = getSelectedItem(context, "actor");
    const weaponLabel = getItemDefinition(selection.item.definitionId).label.toLowerCase();
    const outcome = resolveScoreCheck({
      score: Math.max(getForagingScore(actor), getSurvivalScore(actor)),
      difficulty: DEFAULT_DIFFICULTY,
      random: context.random,
    });
    const itemChange = createItemUseChange(selection.owner, selection.item, "day-hunting-for-food");

    switch (outcome) {
      case "critical-failure":
        return {
          text:
            `${actor.snapshot.name} spends the day hunting for food. ` +
            `Late in the afternoon, ${pronouns.subject} tracks a deer into dense brush, ` +
            "loses sight of it, and is knocked hard to the ground when it charges back out.",
          changes: [
            itemChange,
            statusChange(context, actor, "injured"),
            ...createSurvivalChanges([actor]),
          ],
        };
      case "failure":
        return {
          text:
            `${actor.snapshot.name} spends the day hunting for food. ` +
            `${pronouns.Subject} follows fresh deer tracks until they reach a stream. ` +
            `There is no food in sight, but at least ${pronouns.subject} has ` +
            `fresh water to show for ${pronouns.possessiveAdjective} efforts.`,
          changes: [
            itemChange,
            survivalNeedChange(actor, "water"),
            ...createSurvivalChanges([actor]),
          ],
        };
      case "success":
        return {
          text:
            `${actor.snapshot.name} spends the day hunting for food. ` +
            `In the afternoon, ${pronouns.subject} finds a bird watching from a low branch. ` +
            `Carefully approaching, ${actor.snapshot.name} strikes it with ` +
            `${pronouns.possessiveAdjective} ${weaponLabel} and gets enough food ` +
            "to hush their stomach.",
          changes: [
            itemChange,
            survivalNeedChange(actor, "food"),
            ...createSurvivalChanges([actor]),
          ],
        };
      case "exceptional-success":
        return {
          text:
            `${actor.snapshot.name} spends the day hunting for food and gets a lucky break ` +
            "upon finding several squirrels drinking from a stream. " +
            `${actor.snapshot.name} walks away with more food than they can eat ` +
            "and a well-earned drink of water.",
          changes: [
            itemChange,
            survivalNeedChange(actor, "food"),
            survivalNeedChange(actor, "water"),
            statusChange(context, actor, "well-fed"),
            ...createSurvivalChanges([actor]),
          ],
        };
    }
  },
};

const FAILURE_OUTCOMES = new Set<StatCheckOutcome>(["critical-failure", "failure"]);

const ACCIDENTAL_SELF_INJURY = createConditionedSoloEvent({
  id: "day-accidental-self-injury",
  weight: 3,
  category: "hazard",
  tags: ["status"],
  acceptedOutcomes: FAILURE_OUTCOMES,
  score: (actor) => getEffectiveStats(actor).luck,
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} spots a tribute in the distance and runs away. ` +
          `In ${pronouns.possessiveAdjective} haste, ${pronouns.subject} misjudges ` +
          `a steep slope, tumbles through the undergrowth, and breaks ` +
          `${pronouns.possessiveAdjective} fall by landing on ` +
          `${pronouns.possessiveAdjective} head.`
        );
      },
      effects: (context, actor) => [statusChange(context, actor, "injured")],
    },
    failure: {
      text: (actor) =>
        `${actor.snapshot.name} catches a foot between two roots and ` +
        "spends the next hour limping angrily through the arena.",
      effects: (context, actor) => [statusChange(context, actor, "injured")],
    },
    success: {
      text: () => {
        throw new Error("The accidental-self-injury event cannot resolve a success.");
      },
    },
    "exceptional-success": {
      text: () => {
        throw new Error("The accidental-self-injury event cannot resolve an exceptional success.");
      },
    },
  },
});

export const DAY_EVENTS = [
  EXPLORING_ARENA,
  COLLECTING_FRUIT,
  WORKING_TOGETHER,
  OVERHEARING_A_CONVERSATION,
  PRACTISING_WEAPONRY,
  THINKING_ABOUT_HOME,
  PRICKED_BY_THORNS,
  SEARCHING_FOR_FIREWOOD,
  PICKING_FLOWERS,
  IGNORING_DISTANT_SMOKE,
  REACHING_HIGHER_GROUND,
  DISCOVERING_A_RIVER,
  QUESTIONING_SANITY,
  HUNTING_FOR_FOOD,
  ACCIDENTAL_SELF_INJURY,
] satisfies readonly EventDefinition[];
