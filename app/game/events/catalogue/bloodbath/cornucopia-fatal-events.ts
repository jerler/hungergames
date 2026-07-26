import { getEffectiveStats } from "~/game/engine/effective-stats";
import { selectRandomItem, type RandomSource } from "~/game/engine/random";
import { getNextRound } from "~/game/engine/rounds";
import {
  getAwarenessScore,
  getCombatScore,
  getVulnerabilityWeight,
} from "~/game/engine/stat-formulas";
import { resolveScoreCheck } from "~/game/events/event-outcomes";
import {
  createAttemptedKillChange,
  createEliminationChange,
  createFatalChanges,
  createItemAcquisitionAndSurvivalChanges,
  createKillCreditChange,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { getItemLabel, resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import {
  hasUsableCornucopiaPackItem,
  selectCornucopiaContestedDirectWeapon,
  selectCornucopiaPackItem,
  selectDistinctCornucopiaPackItems,
} from "~/game/events/catalogue/bloodbath/cornucopia-item-pool";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { isItemDefinitionUsableBy } from "~/game/items/item-usability";
import { createTruceInstance } from "~/game/truces/truce-engine";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameChange, GameTribute } from "~/game/types/game-state";

/*
 * Bloodbath-only scene props
 * --------------------------
 *
 * The opening Bloodbath may mention temporary objects and circumstances
 * that never enter persistent game state: throwing knives, a lasso, a
 * blueshell, cherry bombs, a second sword, improvised hiding, and so on.
 *
 * Only consequences that survive the scene are represented mechanically:
 * acquired equipment, backpack contents, lasting statuses, truces, deaths,
 * and kill credit. The Bloodbath sequencer separately grants ordinary
 * Cornucopia provisions to every surviving participant.
 */

const SWORD_ITEM_IDS = [
  "short-sword",
  "rapier",
  "longsword",
  "greatsword",
] as const satisfies readonly ItemDefinitionId[];

const STABBING_ITEM_IDS = [
  "knife",
  "short-sword",
  "rapier",
  "spear",
  "trident",
] as const satisfies readonly ItemDefinitionId[];

function getCombatWeight(tribute: GameTribute): number {
  return Math.max(0.25, getCombatScore(tribute));
}

function getVulnerableWeight(tribute: GameTribute): number {
  return Math.max(0.25, getVulnerabilityWeight(tribute));
}

function hasUsableItem(tribute: GameTribute, itemId: ItemDefinitionId): boolean {
  return isItemDefinitionUsableBy(tribute, itemId);
}

function getUsableItems(
  tribute: GameTribute,
  itemIds: readonly ItemDefinitionId[],
): ItemDefinitionId[] {
  return itemIds.filter((itemId) => hasUsableItem(tribute, itemId));
}

function hasUsableItemFrom(tribute: GameTribute, itemIds: readonly ItemDefinitionId[]): boolean {
  return getUsableItems(tribute, itemIds).length > 0;
}

function selectUsableItem(
  tribute: GameTribute,
  itemIds: readonly ItemDefinitionId[],
  random: RandomSource,
  label: string,
): ItemDefinitionId {
  const usableItemIds = getUsableItems(tribute, itemIds);

  if (usableItemIds.length === 0) {
    throw new Error(`${label} could not select a usable item for "${tribute.id}".`);
  }

  return selectRandomItem(usableItemIds, random);
}

function requireSelectedItem(
  itemIds: readonly ItemDefinitionId[],
  eventId: string,
): ItemDefinitionId {
  const itemId = itemIds[0];

  if (!itemId) {
    throw new Error(`Event "${eventId}" did not select its required item.`);
  }

  return itemId;
}

function formatIndefiniteItem(itemId: ItemDefinitionId): string {
  const label = getItemLabel(itemId);
  const article = /^[aeiou]/i.test(label) ? "an" : "a";

  return `${article} ${label}`;
}

function createHostilePairRoles(
  actorIsEligible?: (tribute: GameTribute) => boolean,
): EventDefinition["roles"] {
  return [
    {
      id: "actor",
      count: 1,
      isEligible: actorIsEligible,
      getWeight: getCombatWeight,
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      getWeight: getVulnerableWeight,
      opposesRoleIds: ["actor"],
    },
  ];
}

interface PairFatalEventOptions {
  id: string;
  baseWeight?: number;
  tags?: EventDefinition["tags"];
  causeLabel?: string;
  actorIsEligible?: (tribute: GameTribute) => boolean;
  selectItemIds?: (actor: GameTribute, random: RandomSource) => readonly ItemDefinitionId[];
  getText: (
    actor: GameTribute,
    target: GameTribute,
    itemIds: readonly ItemDefinitionId[],
  ) => string;
  getAdditionalChanges?: (
    eventId: string,
    round: Parameters<typeof createStatusChange>[4],
    actor: GameTribute,
    target: GameTribute,
  ) => readonly GameChange[];
}

function createPairFatalEvent({
  id,
  baseWeight = 3,
  tags = ["fatal", "combat"],
  causeLabel = "Killed at the Cornucopia",
  actorIsEligible,
  selectItemIds,
  getText,
  getAdditionalChanges,
}: PairFatalEventOptions): EventDefinition {
  return {
    id,
    category: "fatal",
    tags,
    periods: ["day"],
    baseWeight,
    roles: createHostilePairRoles(actorIsEligible),
    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const target = requireSingleParticipant(participantsByRole, "target");
      const itemIds = selectItemIds?.(actor, random) ?? [];
      const text = getText(actor, target, itemIds);
      const survivorChanges =
        itemIds.length > 0
          ? createItemAcquisitionAndSurvivalChanges(eventId, actor, itemIds, round, "cornucopia")
          : createSurvivalChanges([actor]);

      return {
        text,
        changes: [
          ...createFatalChanges(target, id, causeLabel, text, actor),
          ...survivorChanges,
          ...(getAdditionalChanges?.(eventId, round, actor, target) ?? []),
        ],
      };
    },
  };
}

interface SoloFatalEventOptions {
  id: string;
  text: (actor: GameTribute) => string;
  baseWeight?: number;
  causeLabel: string;
}

function createSoloFatalEvent({
  id,
  text: getText,
  baseWeight = 1.5,
  causeLabel,
}: SoloFatalEventOptions): EventDefinition {
  return {
    id,
    category: "fatal",
    tags: ["fatal", "environment"],
    periods: ["day"],
    baseWeight,
    roles: [
      {
        id: "actor",
        count: 1,
        getWeight: getVulnerableWeight,
      },
    ],
    resolve({ participantsByRole }): EventResolution {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const text = getText(actor);

      return {
        text,
        changes: createFatalChanges(actor, id, causeLabel, text),
      };
    },
  };
}

function createSharedFatalChanges(
  victims: readonly GameTribute[],
  killers: readonly GameTribute[],
  causeId: string,
  causeLabel: string,
  text: string,
): GameChange[] {
  const killerTributeIds = killers.map((killer) => killer.id);
  const changes: GameChange[] = [];

  for (const victim of victims) {
    changes.push(createEliminationChange(victim, causeId, causeLabel, text, killerTributeIds));

    for (const killer of killers) {
      changes.push(createAttemptedKillChange(killer), createKillCreditChange(killer));
    }
  }

  return changes;
}

function createTemporaryTruceChange(
  eventId: string,
  round: Parameters<typeof createTruceInstance>[2],
  tributes: readonly GameTribute[],
): GameChange {
  return {
    type: "form-truce",
    truce: createTruceInstance(
      eventId,
      tributes.map((tribute) => tribute.id),
      round,
      getNextRound(round),
    ),
  };
}

const PODIUM_DETONATION_BITS_EVENT = createSoloFatalEvent({
  id: "cornucopia-fatal-podium-detonation-bits",
  causeLabel: "Podium mine detonation",
  text: (actor) =>
    `${actor.snapshot.name} steps off the podium before the countdown ends. ` +
    `The mine beneath it detonates before ${getTributePronouns(actor).subject} ` +
    `can reach the ground, sending bits of ${actor.snapshot.name} flying through the air.`,
});

const PODIUM_DETONATION_BALLOON_EVENT = createSoloFatalEvent({
  id: "cornucopia-fatal-podium-detonation-balloon",
  causeLabel: "Podium mine detonation",
  text: (actor) =>
    `${actor.snapshot.name} panics at the last second and faints, falling off the ` +
    "podium before the countdown ends. The mine beneath it detonates before " +
    `${getTributePronouns(actor).subject} can reach the ground, popping ` +
    `${actor.snapshot.name} like a balloon.`,
});

const FALLING_INTO_PIT_EVENT = createSoloFatalEvent({
  id: "cornucopia-fatal-spiked-pit",
  causeLabel: "Fell into a spiked pit",
  text: (actor) =>
    `${actor.snapshot.name} gets scared by the chaos and backs away from the fighting ` +
    `without looking behind ${getTributePronouns(actor).object}, falling directly into ` +
    "a spiked pit.",
});

const THROWN_KNIFE_HEAD_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-thrown-knife-head",
  baseWeight: 3.2,
  getText: (actor, target) => {
    const targetPronouns = getTributePronouns(target);

    return (
      `${actor.snapshot.name} sees a throwing knife shine nearby. Quickly, ` +
      `${actor.snapshot.name} grabs it and chucks it into the chaos of tributes. ` +
      `The knife strikes ${target.snapshot.name} in the head before ` +
      `${targetPronouns.subject} can turn.`
    );
  },
});

const THROWN_KNIFE_CHEST_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-thrown-knife-chest",
  baseWeight: 3.5,
  getText: (actor, target) => {
    const targetPronouns = getTributePronouns(target);

    return (
      `${actor.snapshot.name} sees ${target.snapshot.name} looking cocky from across ` +
      `the Cornucopia. ${actor.snapshot.name} pulls out one of ` +
      `${getTributePronouns(actor).possessiveAdjective} gathered throwing knives and ` +
      `hurls it toward ${targetPronouns.object}, successfully striking ` +
      `${target.snapshot.name}'s chest.`
    );
  },
});

const ARROW_THROUGH_HEAD_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-arrow-through-head",
  baseWeight: 3.4,
  tags: ["fatal", "combat", "weapon", "item"],
  actorIsEligible: (actor) => hasUsableItem(actor, "bow"),
  selectItemIds: () => ["bow"],
  getText: (actor, target) =>
    `${actor.snapshot.name} lunges for a bow, quickly spins around, and shoots at the ` +
    `first person ${actor.snapshot.name} sees. The arrow strikes ` +
    `${target.snapshot.name} through the head.`,
});

const FISTFIGHT_STRANGULATION_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-fistfight-strangulation",
  baseWeight: 3.5,
  getText: (actor, target) =>
    `${actor.snapshot.name} and ${target.snapshot.name} begin a fistfight before either ` +
    `can grab a weapon. ${target.snapshot.name} knocks ${actor.snapshot.name} to the ` +
    `ground, but ${actor.snapshot.name} fakes being dead. When ${target.snapshot.name} ` +
    `turns away, ${actor.snapshot.name} jumps up and strangles ` +
    `${getTributePronouns(target).object}.`,
});

const HEAD_AGAINST_ROCK_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-head-against-rock",
  baseWeight: 3.3,
  getText: (actor, target) =>
    `${actor.snapshot.name} tackles ${target.snapshot.name} beside a jutting rock and ` +
    `slams ${getTributePronouns(target).possessiveAdjective} head against it until ` +
    `${target.snapshot.name} stops moving.`,
});

const SILENT_NECK_BREAK_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-silent-neck-break",
  baseWeight: 3,
  tags: ["fatal", "combat", "ambush"],
  getText: (actor, target) =>
    `${actor.snapshot.name} approaches without making a sound, catches ` +
    `${target.snapshot.name} from behind, and snaps ` +
    `${getTributePronouns(target).possessiveAdjective} neck before ` +
    `${getTributePronouns(target).subject} can say, "Hey, wait!"`,
});

function selectSword(actor: GameTribute, random: RandomSource): ItemDefinitionId {
  return selectUsableItem(actor, SWORD_ITEM_IDS, random, "Sword duel");
}

const SWORD_DECAPITATION_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-sword-decapitation",
  baseWeight: 4,
  tags: ["fatal", "combat", "weapon", "item"],
  actorIsEligible: (actor) => hasUsableItemFrom(actor, SWORD_ITEM_IDS),
  selectItemIds: (actor, random) => [selectSword(actor, random)],
  getText: (actor, target, itemIds) => {
    const itemId = requireSelectedItem(itemIds, "cornucopia-fatal-sword-decapitation");

    return (
      `${actor.snapshot.name} and ${target.snapshot.name} both grab swords and begin an ` +
      `epic duel. ${target.snapshot.name} lunges sloppily forward while ` +
      `${actor.snapshot.name} swings ${getTributePronouns(actor).possessiveAdjective} ` +
      `${getItemLabel(itemId)} in a clean arc, bisecting ${target.snapshot.name} ` +
      "hamburger-style."
    );
  },
});

const SWORD_BODY_STRIKE_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-sword-body-strike",
  baseWeight: 4,
  tags: ["fatal", "combat", "weapon", "item"],
  actorIsEligible: (actor) => hasUsableItemFrom(actor, SWORD_ITEM_IDS),
  selectItemIds: (actor, random) => [selectSword(actor, random)],
  getText: (actor, target, itemIds) => {
    const itemId = requireSelectedItem(itemIds, "cornucopia-fatal-sword-body-strike");

    return (
      `${actor.snapshot.name} and ${target.snapshot.name} both grab swords and begin an ` +
      `epic duel. ${target.snapshot.name} lunges sloppily forward while ` +
      `${actor.snapshot.name} holds back, striking cleanly with the ` +
      `${getItemLabel(itemId)}, clearly having studied the blade. ` +
      `${target.snapshot.name} collapses with fatal wounds across ` +
      `${getTributePronouns(target).possessiveAdjective} chest.`
    );
  },
});

const SPEAR_ABDOMEN_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-spear-abdomen",
  baseWeight: 3.7,
  tags: ["fatal", "combat", "weapon", "item"],
  actorIsEligible: (actor) => hasUsableItem(actor, "spear"),
  selectItemIds: () => ["spear"],
  getText: (actor, target) =>
    `${actor.snapshot.name} sees ${target.snapshot.name} running directly at ` +
    `${getTributePronouns(actor).object} across the Cornucopia. Thinking quickly, ` +
    `${actor.snapshot.name} grabs a spear and braces it against the ground, driving ` +
    `its point into ${target.snapshot.name}'s abdomen as ` +
    `${target.snapshot.name} charges.`,
});

const CHERRY_BOMB_ATTACK_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-cherry-bomb-attack",
  baseWeight: 3.2,
  tags: ["fatal", "combat"],
  getText: (actor, target) =>
    `${actor.snapshot.name} finds a cherry bomb at the bottom of a supply box beside a ` +
    `single match. Without thinking, ${actor.snapshot.name} lights the bomb and throws ` +
    `it backward into the chaos. Flames engulf a patch of supplies, catching ` +
    `${target.snapshot.name} in the blast.`,
});

function selectStabbingWeapon(
  actor: GameTribute,
  random: RandomSource,
  label: string,
): ItemDefinitionId {
  return selectUsableItem(actor, STABBING_ITEM_IDS, random, label);
}

const STABBED_WHILE_DISTRACTED_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-stabbed-while-distracted",
  baseWeight: 3.4,
  tags: ["fatal", "combat", "weapon", "item", "ambush"],
  actorIsEligible: (actor) => hasUsableItemFrom(actor, STABBING_ITEM_IDS),
  selectItemIds: (actor, random) => [selectStabbingWeapon(actor, random, "Distracted stabbing")],
  getText: (actor, target, itemIds) => {
    const itemId = requireSelectedItem(itemIds, "cornucopia-fatal-stabbed-while-distracted");

    return (
      `${actor.snapshot.name} runs forward and grabs ${formatIndefiniteItem(itemId)} ` +
      `before hiding behind a supply crate. A few minutes pass before ` +
      `${target.snapshot.name} appears, causing ${actor.snapshot.name} to jump out and ` +
      `drive the ${getItemLabel(itemId)} into ${target.snapshot.name}'s chest.`
    );
  },
});

const MERCY_KILLING_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-mercy-killing",
  baseWeight: 3.1,
  tags: ["fatal", "combat", "weapon", "item", "resource"],
  actorIsEligible: (actor) => hasUsableItem(actor, "knife"),
  selectItemIds: () => ["knife"],
  getText: (actor, target) =>
    `${actor.snapshot.name} and ${target.snapshot.name} begin fighting over a ` +
    `Costco-sized box of Cheerios. ${actor.snapshot.name} reaches a knife first and ` +
    `leaves ${target.snapshot.name} critically wounded. After one brief hesitation, ` +
    `${actor.snapshot.name} ends ${getTributePronouns(target).possessiveAdjective} ` +
    `suffering rather than leaving ${getTributePronouns(target).object} to the Bloodbath.`,
  getAdditionalChanges: (eventId, round, actor) => [
    createStatusChange(eventId, actor, "well-fed", 1, round),
  ],
});

const CLIFFSIDE_KNIFE_FIGHT_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-cliffside-knife-fight",
  baseWeight: 3.2,
  tags: ["fatal", "combat", "weapon", "item", "environment"],
  actorIsEligible: (actor) => hasUsableItem(actor, "knife"),
  selectItemIds: () => ["knife"],
  getText: (actor, target) =>
    `${actor.snapshot.name} drives ${target.snapshot.name} backward during a knife ` +
    `fight, sweeps ${getTributePronouns(target).possessiveAdjective} legs at the ` +
    `cliff's edge, and sends ${getTributePronouns(target).object} plummeting into the ` +
    "ravine below.",
});

const OWN_WEAPON_REVERSAL_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-own-weapon-reversal",
  baseWeight: 3.4,
  tags: ["fatal", "combat", "weapon", "item"],
  actorIsEligible: (actor) =>
    hasUsableItemFrom(actor, [
      "knife",
      "short-sword",
      "rapier",
      "longsword",
      "greatsword",
      "spear",
      "trident",
      "bow",
      "hand-axe",
      "axe",
      "club",
      "warhammer",
      "crossbow",
    ]),
  selectItemIds: (actor, random) => [selectCornucopiaContestedDirectWeapon(actor, random)],
  getText: (actor, target, itemIds) => {
    const itemId = requireSelectedItem(itemIds, "cornucopia-fatal-own-weapon-reversal");
    const targetPronouns = getTributePronouns(target);

    return (
      `${actor.snapshot.name} spots ${target.snapshot.name} picking up a deadly ` +
      `${getItemLabel(itemId)} from the supply crates. Thinking quickly, ` +
      `${actor.snapshot.name} lassos ${target.snapshot.name}'s weapon arm, tears the ` +
      `${getItemLabel(itemId)} from ${targetPronouns.possessiveAdjective} grip, and ` +
      `kills ${targetPronouns.object} with it before ${targetPronouns.subject} can react.`
    );
  },
});

const KILLED_WHILE_FLEEING_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-killed-while-fleeing",
  baseWeight: 3.5,
  getText: (actor, target) =>
    `${target.snapshot.name} quickly grabs as many supplies as ` +
    `${getTributePronouns(target).subject} can before sprinting away from the ` +
    `Cornucopia. ${actor.snapshot.name} chucks a blueshell at ` +
    `${getTributePronouns(target).object}, catching ${getTributePronouns(target).object} ` +
    `before ${getTributePronouns(target).subject} can reach the tree line and killing ` +
    `${getTributePronouns(target).object} within sight of the Cornucopia.`,
});

const KILLING_FOR_SUPPLIES_EVENT: EventDefinition = {
  id: "cornucopia-fatal-killing-for-supplies",
  category: "fatal",
  tags: ["fatal", "combat", "item", "resource"],
  periods: ["day"],
  baseWeight: 3.4,
  roles: createHostilePairRoles(hasUsableCornucopiaPackItem),
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);
    const itemIds = selectDistinctCornucopiaPackItems(actor, 2, random);

    if (itemIds.length !== 2) {
      throw new Error("Killing for supplies could not select two backpack items.");
    }

    const text =
      `${actor.snapshot.name} sees ${target.snapshot.name} running away from the ` +
      `Cornucopia carrying a huge backpack. Thinking fast, ${actor.snapshot.name} ` +
      `knocks over several stacked crates, which fall directly on ` +
      `${target.snapshot.name}, crushing ${targetPronouns.object} but leaving ` +
      `${targetPronouns.possessiveAdjective} backpack free for the taking.`;

    return {
      text,
      changes: [
        ...createFatalChanges(
          target,
          KILLING_FOR_SUPPLIES_EVENT.id,
          "Crushed beneath Cornucopia crates",
          text,
          actor,
        ),
        ...createItemAcquisitionAndSurvivalChanges(eventId, actor, itemIds, round, "cornucopia"),
      ],
    };
  },
};

const IMPROVISED_BRANCH_STABBING_EVENT = createPairFatalEvent({
  id: "cornucopia-fatal-improvised-branch-stabbing",
  baseWeight: 3.1,
  getText: (actor, target) =>
    `${actor.snapshot.name} and ${target.snapshot.name} race toward a broadsword. ` +
    `${target.snapshot.name} is faster, but ${actor.snapshot.name} tears a jagged ` +
    `branch from the ground and drives it into ${target.snapshot.name}'s chest before ` +
    `${getTributePronouns(target).subject} can raise the weapon.`,
});

const DISCOVERING_HIDDEN_TRIBUTE_EVENT: EventDefinition = {
  id: "cornucopia-fatal-discovering-hidden-tribute",
  category: "fatal",
  tags: ["fatal", "combat", "ambush"],
  periods: ["day"],
  baseWeight: 3,
  roles: createHostilePairRoles(),
  resolve({ random, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const score = 3 + getAwarenessScore(actor) - getAwarenessScore(target);
    const outcome = resolveScoreCheck({ score, difficulty: 3, random });

    if (outcome === "success" || outcome === "exceptional-success") {
      const text =
        `${actor.snapshot.name} notices movement inside the Cornucopia, drags ` +
        `${target.snapshot.name} from hiding, and kills ` +
        `${getTributePronouns(target).object} among the supplies.`;

      return {
        text,
        changes: [
          ...createFatalChanges(
            target,
            DISCOVERING_HIDDEN_TRIBUTE_EVENT.id,
            "Discovered while hiding at the Cornucopia",
            text,
            actor,
          ),
          ...createSurvivalChanges([actor]),
        ],
      };
    }

    const text =
      `${actor.snapshot.name} discovers ${target.snapshot.name} hiding inside the ` +
      `Cornucopia, but ${target.snapshot.name} strikes first and kills ` +
      `${getTributePronouns(actor).object} in the cramped space.`;

    return {
      text,
      changes: [
        ...createFatalChanges(
          actor,
          DISCOVERING_HIDDEN_TRIBUTE_EVENT.id,
          "Killed by a hidden tribute at the Cornucopia",
          text,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const BAG_STRAP_STRANGULATION_EVENT: EventDefinition = {
  id: "cornucopia-fatal-bag-strap-strangulation",
  category: "fatal",
  tags: ["fatal", "combat", "item", "resource"],
  periods: ["day"],
  baseWeight: 3.3,
  roles: createHostilePairRoles(hasUsableCornucopiaPackItem),
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const itemId = selectCornucopiaPackItem(actor, random);
    const text =
      `${actor.snapshot.name} and ${target.snapshot.name} begin fighting over a large ` +
      `backpack filled with supplies. ${actor.snapshot.name} loops the bag's straps ` +
      `around ${target.snapshot.name}'s throat, strangles ` +
      `${getTributePronouns(target).object} during the struggle, and runs with the bag ` +
      "still in hand.";

    return {
      text,
      changes: [
        ...createFatalChanges(
          target,
          BAG_STRAP_STRANGULATION_EVENT.id,
          "Strangled with a supply-bag strap",
          text,
          actor,
        ),
        ...createItemAcquisitionAndSurvivalChanges(eventId, actor, [itemId], round, "cornucopia"),
      ],
    };
  },
};

const LEFT_BLEEDING_EVENT: EventDefinition = {
  id: "cornucopia-fatal-left-bleeding",
  category: "hazard",
  tags: ["hazard", "combat", "weapon", "item", "status"],
  periods: ["day"],
  baseWeight: 2.5,
  roles: createHostilePairRoles((actor) => hasUsableItemFrom(actor, STABBING_ITEM_IDS)),
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const itemId = selectStabbingWeapon(actor, random, "Left bleeding");
    const targetPronouns = getTributePronouns(target);
    const text =
      `${actor.snapshot.name} and ${target.snapshot.name} begin fighting over ` +
      `${formatIndefiniteItem(itemId)}. ${actor.snapshot.name} jumps on ` +
      `${target.snapshot.name}'s back and forces the weapon against ` +
      `${targetPronouns.object}, cutting a deep wound across ` +
      `${targetPronouns.possessiveAdjective} side. ${actor.snapshot.name} jumps off, ` +
      `flees with the ${getItemLabel(itemId)}, and leaves ${targetPronouns.object} ` +
      "bleeding among the abandoned supplies.";

    return {
      text,
      changes: [
        ...createItemAcquisitionAndSurvivalChanges(eventId, actor, [itemId], round, "cornucopia"),
        createAttemptedKillChange(actor),
        createStatusChange(eventId, target, "bleeding", 2, round, undefined, actor.id),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const POISONED_BLOW_DART_EVENT: EventDefinition = {
  id: "cornucopia-fatal-poisoned-blow-dart",
  category: "hazard",
  tags: ["hazard", "combat", "weapon", "item", "status"],
  periods: ["day"],
  baseWeight: 2.5,
  roles: createHostilePairRoles((actor) => hasUsableItem(actor, "blowgun")),
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const outcome = resolveLuckAdjustedStatCheck(actor, "brains", 3, random);

    if (outcome === "critical-failure" || outcome === "failure") {
      const text =
        `${actor.snapshot.name} spots a strange-looking straw. ${actor.snapshot.name} ` +
        `tries sucking through the straw and feels the prick of a poisoned dart stabbing ` +
        `${actorPronouns.possessiveAdjective} throat and landing in ` +
        `${actorPronouns.possessiveAdjective} stomach. ${target.snapshot.name} is ` +
        "nearby and looks on with amazement.";

      return {
        text,
        changes: [
          ...createItemAcquisitionAndSurvivalChanges(
            eventId,
            actor,
            ["blowgun"],
            round,
            "cornucopia",
          ),
          createStatusChange(
            eventId,
            actor,
            "poisoned",
            outcome === "critical-failure" ? 2 : 1,
            round,
          ),
          ...createSurvivalChanges([target]),
        ],
      };
    }

    const text =
      `${actor.snapshot.name} spots a strange-looking straw. Taking an educated guess, ` +
      `${actor.snapshot.name} waits for the nearby ${target.snapshot.name} to expose ` +
      `${targetPronouns.possessiveAdjective} neck, then blows through the straw, sending ` +
      "a poisoned dart into the opening.";

    return {
      text,
      changes: [
        ...createItemAcquisitionAndSurvivalChanges(
          eventId,
          actor,
          ["blowgun"],
          round,
          "cornucopia",
        ),
        createAttemptedKillChange(actor),
        createStatusChange(
          eventId,
          target,
          "poisoned",
          outcome === "exceptional-success" ? 2 : 1,
          round,
          undefined,
          actor.id,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const TEAM_DROWNING_EVENT: EventDefinition = {
  id: "cornucopia-fatal-team-drowning",
  category: "fatal",
  tags: ["fatal", "combat", "truce", "cooperative"],
  periods: ["day"],
  baseWeight: 2.7,
  roles: [
    {
      id: "actor",
      count: 1,
      getWeight: getCombatWeight,
      opposesRoleIds: ["target"],
    },
    {
      id: "ally",
      count: 1,
      getWeight: getCombatWeight,
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      getWeight: getVulnerableWeight,
      opposesRoleIds: ["actor", "ally"],
    },
  ],
  resolve({ eventId, round, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const ally = requireSingleParticipant(participantsByRole, "ally");
    const target = requireSingleParticipant(participantsByRole, "target");
    const text =
      `${actor.snapshot.name} and ${ally.snapshot.name} both lunge toward ` +
      `${target.snapshot.name} at the same time. They bond as they drown ` +
      `${target.snapshot.name} in an oversized barrel of Kool-Aid and agree to work ` +
      "together for a while.";

    return {
      text,
      changes: [
        ...createSharedFatalChanges(
          [target],
          [actor, ally],
          TEAM_DROWNING_EVENT.id,
          "Drowned at the Cornucopia",
          text,
        ),
        createTemporaryTruceChange(eventId, round, [actor, ally]),
        ...createSurvivalChanges([actor, ally]),
      ],
    };
  },
};

function createProtectiveInterventionEvent(
  id: string,
  baseWeight: number,
  getText: (actor: GameTribute, target: GameTribute, protector: GameTribute) => string,
): EventDefinition {
  return {
    id,
    category: "fatal",
    tags: ["fatal", "combat", "truce", "cooperative"],
    periods: ["day"],
    baseWeight,
    roles: [
      {
        id: "actor",
        count: 1,
        getWeight: getCombatWeight,
        opposesRoleIds: ["target", "protector"],
      },
      {
        id: "target",
        count: 1,
        targeting: "hostile",
        getWeight: getVulnerableWeight,
        opposesRoleIds: ["actor"],
      },
      {
        id: "protector",
        count: 1,
        getWeight: getCombatWeight,
        opposesRoleIds: ["actor"],
      },
    ],
    resolve({ eventId, round, participantsByRole }): EventResolution {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const target = requireSingleParticipant(participantsByRole, "target");
      const protector = requireSingleParticipant(participantsByRole, "protector");
      const text = getText(actor, target, protector);

      return {
        text,
        changes: [
          ...createFatalChanges(
            actor,
            id,
            "Killed during a protective intervention",
            text,
            protector,
          ),
          createTemporaryTruceChange(eventId, round, [target, protector]),
          ...createSurvivalChanges([target, protector]),
        ],
      };
    },
  };
}

const PROTECTIVE_SPEAR_EVENT = createProtectiveInterventionEvent(
  "cornucopia-fatal-protective-spear-intervention",
  1.8,
  (actor, target, protector) =>
    `${actor.snapshot.name} grabs a spear and throws it at ${target.snapshot.name}, ` +
    `but ${protector.snapshot.name} leaps into the air, grabs the spear, and deflects ` +
    `it directly back at ${actor.snapshot.name} before ` +
    `${getTributePronouns(actor).subject} can strike again.`,
);

const PROTECTIVE_CHERRY_BOMB_EVENT = createProtectiveInterventionEvent(
  "cornucopia-fatal-protective-cherry-bomb-intervention",
  1.8,
  (actor, target, protector) =>
    `${actor.snapshot.name} grabs a cherry bomb and throws it at ` +
    `${target.snapshot.name}, but ${protector.snapshot.name} leaps into the air and ` +
    `spikes it back down volleyball-style, blowing up ${actor.snapshot.name}, who ` +
    "stood dumbfounded.",
);

const ACCIDENTAL_ARROW_EVENT: EventDefinition = {
  id: "cornucopia-fatal-accidental-arrow",
  category: "fatal",
  tags: ["fatal", "combat", "weapon", "item"],
  periods: ["day"],
  baseWeight: 2.7,
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (actor) => hasUsableItem(actor, "bow"),
      getWeight: getCombatWeight,
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      getWeight: getVulnerableWeight,
      opposesRoleIds: ["actor"],
    },
    {
      id: "bystander",
      count: 1,
      getWeight: getVulnerableWeight,
    },
  ],
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const bystander = requireSingleParticipant(participantsByRole, "bystander");
    const targetPronouns = getTributePronouns(target);
    const score = (getCombatScore(actor) + getAwarenessScore(actor, round)) / 2;
    const outcome = resolveScoreCheck({ score, difficulty: 3, random });
    const opening =
      `${target.snapshot.name} grabs a handful of throwing knives and starts hurling ` +
      `them toward ${actor.snapshot.name}. Ducking behind a crate, ` +
      `${actor.snapshot.name} finds a bow with a quiver filled with arrows. `;

    switch (outcome) {
      case "critical-failure": {
        const text =
          opening +
          `${actor.snapshot.name} tries to shoot ${target.snapshot.name} from safety, ` +
          `but the arrow misses, nearly hitting ${bystander.snapshot.name}. ` +
          `${actor.snapshot.name} drops the bow and runs before ` +
          `${bystander.snapshot.name} and ${target.snapshot.name} can retaliate.`;

        return {
          text,
          changes: createSurvivalChanges([actor, target, bystander]),
        };
      }

      case "failure": {
        const text =
          opening +
          `${actor.snapshot.name} tries to shoot ${target.snapshot.name} from safety, ` +
          `but the arrow misses, instead landing in ${bystander.snapshot.name}'s chest. ` +
          `${actor.snapshot.name} runs away with the bow in the confusion.`;

        return {
          text,
          changes: [
            ...createFatalChanges(
              bystander,
              ACCIDENTAL_ARROW_EVENT.id,
              "Killed by a stray Bloodbath arrow",
              text,
              actor,
            ),
            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              actor,
              ["bow"],
              round,
              "cornucopia",
            ),
            ...createSurvivalChanges([target]),
          ],
        };
      }

      case "success": {
        const text =
          `${target.snapshot.name} grabs a handful of throwing knives and starts hurling ` +
          `them toward ${actor.snapshot.name}. Ducking behind a barrel, ` +
          `${actor.snapshot.name} finds a bow with a quiver filled with arrows. ` +
          `${actor.snapshot.name} snipes ${target.snapshot.name} from safety, piercing ` +
          `${targetPronouns.object} through the eye. ${actor.snapshot.name} tries to ` +
          `take another shot at ${bystander.snapshot.name} but misses.`;

        return {
          text,
          changes: [
            ...createFatalChanges(
              target,
              ACCIDENTAL_ARROW_EVENT.id,
              "Killed by a Bloodbath arrow",
              text,
              actor,
            ),
            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              actor,
              ["bow"],
              round,
              "cornucopia",
            ),
            ...createSurvivalChanges([bystander]),
          ],
        };
      }

      case "exceptional-success": {
        const text =
          `${target.snapshot.name} grabs a handful of throwing knives and starts hurling ` +
          `them toward ${actor.snapshot.name}. Ducking behind a barrel, ` +
          `${actor.snapshot.name} finds a bow with a quiver filled with arrows. ` +
          `${actor.snapshot.name} snipes ${target.snapshot.name} from safety, hitting ` +
          `${targetPronouns.object} so perfectly that the arrow flies through ` +
          `${bystander.snapshot.name}, who was standing behind ${targetPronouns.object}.`;

        return {
          text,
          changes: [
            ...createFatalChanges(
              target,
              ACCIDENTAL_ARROW_EVENT.id,
              "Killed by a Bloodbath arrow",
              text,
              actor,
            ),
            ...createFatalChanges(
              bystander,
              ACCIDENTAL_ARROW_EVENT.id,
              "Killed by a Bloodbath arrow",
              text,
              actor,
            ),
            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              actor,
              ["bow"],
              round,
              "cornucopia",
            ),
          ],
        };
      }
    }
  },
};

const THREE_WAY_FIGHT_EVENT: EventDefinition = {
  id: "cornucopia-fatal-three-way-fight",
  category: "fatal",
  tags: ["fatal", "combat", "weapon"],
  periods: ["day"],
  baseWeight: 0.65,
  roles: [
    {
      id: "actor",
      count: 1,
      getWeight: (tribute) => Math.max(0.25, getCombatScore(tribute) ** 2),
      opposesRoleIds: ["target", "bystander"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      getWeight: getVulnerableWeight,
      opposesRoleIds: ["actor", "bystander"],
    },
    {
      id: "bystander",
      count: 1,
      targeting: "hostile",
      getWeight: getVulnerableWeight,
      opposesRoleIds: ["actor", "target"],
    },
  ],
  resolve({ participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const bystander = requireSingleParticipant(participantsByRole, "bystander");
    const text =
      `${actor.snapshot.name} and ${target.snapshot.name} begin fighting with weapons ` +
      `from the Cornucopia. The clash collides with ${bystander.snapshot.name}, and all ` +
      `three fight to the death, leaving only ${actor.snapshot.name} alive.`;

    return {
      text,
      changes: [
        ...createSharedFatalChanges(
          [target, bystander],
          [actor],
          THREE_WAY_FIGHT_EVENT.id,
          "Killed in a three-way Cornucopia fight",
          text,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const DOUBLE_CHERRY_BOMB_EVENT: EventDefinition = {
  id: "cornucopia-fatal-double-cherry-bomb",
  category: "fatal",
  tags: ["fatal", "combat"],
  periods: ["day"],
  baseWeight: 1.6,
  roles: [
    {
      id: "actor",
      count: 1,
      getWeight: getCombatWeight,
      opposesRoleIds: ["target", "bystander"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      getWeight: getVulnerableWeight,
      opposesRoleIds: ["actor"],
    },
    {
      id: "bystander",
      count: 1,
      targeting: "hostile",
      getWeight: getVulnerableWeight,
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const bystander = requireSingleParticipant(participantsByRole, "bystander");
    const text =
      `${actor.snapshot.name} waits until ${target.snapshot.name} and ` +
      `${bystander.snapshot.name} converge beside the supplies, then throws a cherry ` +
      "bomb between them. Neither escapes the blast.";

    return {
      text,
      changes: [
        ...createSharedFatalChanges(
          [target, bystander],
          [actor],
          DOUBLE_CHERRY_BOMB_EVENT.id,
          "Killed by a cherry-bomb blast",
          text,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const TWO_AGAINST_TWO_EVENT: EventDefinition = {
  id: "cornucopia-fatal-two-against-two",
  category: "fatal",
  tags: ["fatal", "combat", "item", "resource", "cooperative"],
  periods: ["day"],
  baseWeight: 2.2,
  roles: [
    {
      id: "actor",
      count: 1,
      getWeight: getCombatWeight,
      opposesRoleIds: ["target", "bystander"],
    },
    {
      id: "ally",
      count: 1,
      getWeight: getCombatWeight,
      opposesRoleIds: ["target", "bystander"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      getWeight: getCombatWeight,
      opposesRoleIds: ["actor", "ally"],
    },
    {
      id: "bystander",
      count: 1,
      targeting: "hostile",
      getWeight: getCombatWeight,
      opposesRoleIds: ["actor", "ally"],
    },
  ],
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const ally = requireSingleParticipant(participantsByRole, "ally");
    const target = requireSingleParticipant(participantsByRole, "target");
    const bystander = requireSingleParticipant(participantsByRole, "bystander");
    const actorSideStats = getEffectiveStats(actor).brawn + getEffectiveStats(ally).brawn;
    const targetSideStats = getEffectiveStats(target).brawn + getEffectiveStats(bystander).brawn;
    const outcome = resolveScoreCheck({
      score: 3 + (actorSideStats - targetSideStats) / 2,
      difficulty: 3,
      random,
    });

    const actorSideWins = outcome === "success" || outcome === "exceptional-success";
    const formsTruce = outcome === "critical-failure" || outcome === "exceptional-success";
    const winners = actorSideWins ? [actor, ally] : [target, bystander];
    const victims = actorSideWins ? [target, bystander] : [actor, ally];
    const candy =
      outcome === "critical-failure"
        ? "chocolate almonds"
        : outcome === "failure"
          ? "Smarties"
          : outcome === "success"
            ? "peanuts"
            : "chocolate loonies";
    const text =
      `${actor.snapshot.name} tries grabbing a fistful of ${candy} from within ` +
      `a supply box when ${target.snapshot.name} appears and attacks from behind. ` +
      `${ally.snapshot.name} punches ${target.snapshot.name} for taking such a cheap ` +
      `shot, and ${bystander.snapshot.name} kicks ${ally.snapshot.name} in response. ` +
      `A fight breaks out, leaving only ${winners[0]?.snapshot.name} and ` +
      `${winners[1]?.snapshot.name} standing victorious. ` +
      (formsTruce
        ? "They agree to travel together for a while."
        : "They give each other a nod and then part ways.");

    return {
      text,
      changes: [
        ...createSharedFatalChanges(
          victims,
          winners,
          TWO_AGAINST_TWO_EVENT.id,
          "Killed in a two-against-two Cornucopia fight",
          text,
        ),
        ...(formsTruce ? [createTemporaryTruceChange(eventId, round, winners)] : []),
        ...winners.flatMap((winner) =>
          createItemAcquisitionAndSurvivalChanges(
            eventId,
            winner,
            [selectCornucopiaPackItem(winner, random)],
            round,
            "cornucopia",
          ),
        ),
      ],
    };
  },
};

export interface CornucopiaFatalTargetProfile {
  definition: EventDefinition;
  minImmediateEliminations: 0 | 1 | 2;
  maxImmediateEliminations: 1 | 2;
}

function oneDeath(definition: EventDefinition): CornucopiaFatalTargetProfile {
  return {
    definition,
    minImmediateEliminations: 1,
    maxImmediateEliminations: 1,
  };
}

function twoDeaths(definition: EventDefinition): CornucopiaFatalTargetProfile {
  return {
    definition,
    minImmediateEliminations: 2,
    maxImmediateEliminations: 2,
  };
}

export const CORNUCOPIA_FATAL_TARGET_PROFILES = [
  oneDeath(PODIUM_DETONATION_BITS_EVENT),
  oneDeath(PODIUM_DETONATION_BALLOON_EVENT),
  oneDeath(FALLING_INTO_PIT_EVENT),
  oneDeath(THROWN_KNIFE_HEAD_EVENT),
  oneDeath(THROWN_KNIFE_CHEST_EVENT),
  oneDeath(ARROW_THROUGH_HEAD_EVENT),
  oneDeath(FISTFIGHT_STRANGULATION_EVENT),
  oneDeath(HEAD_AGAINST_ROCK_EVENT),
  oneDeath(SILENT_NECK_BREAK_EVENT),
  oneDeath(SWORD_DECAPITATION_EVENT),
  oneDeath(SWORD_BODY_STRIKE_EVENT),
  oneDeath(SPEAR_ABDOMEN_EVENT),
  oneDeath(CHERRY_BOMB_ATTACK_EVENT),
  oneDeath(STABBED_WHILE_DISTRACTED_EVENT),
  oneDeath(MERCY_KILLING_EVENT),
  oneDeath(CLIFFSIDE_KNIFE_FIGHT_EVENT),
  oneDeath(OWN_WEAPON_REVERSAL_EVENT),
  oneDeath(KILLED_WHILE_FLEEING_EVENT),
  oneDeath(KILLING_FOR_SUPPLIES_EVENT),
  oneDeath(IMPROVISED_BRANCH_STABBING_EVENT),
  oneDeath(DISCOVERING_HIDDEN_TRIBUTE_EVENT),
  oneDeath(BAG_STRAP_STRANGULATION_EVENT),
  oneDeath(TEAM_DROWNING_EVENT),
  oneDeath(PROTECTIVE_SPEAR_EVENT),
  oneDeath(PROTECTIVE_CHERRY_BOMB_EVENT),
  {
    definition: ACCIDENTAL_ARROW_EVENT,
    minImmediateEliminations: 0,
    maxImmediateEliminations: 2,
  },
  twoDeaths(THREE_WAY_FIGHT_EVENT),
  twoDeaths(DOUBLE_CHERRY_BOMB_EVENT),
  twoDeaths(TWO_AGAINST_TWO_EVENT),
] satisfies readonly CornucopiaFatalTargetProfile[];

export const CORNUCOPIA_FATAL_DELAYED_EVENTS = [
  LEFT_BLEEDING_EVENT,
  POISONED_BLOW_DART_EVENT,
] satisfies readonly EventDefinition[];

export const CORNUCOPIA_FATAL_BLOODBATH_EVENTS = [
  ...CORNUCOPIA_FATAL_TARGET_PROFILES.map(({ definition }) => definition),
  ...CORNUCOPIA_FATAL_DELAYED_EVENTS,
] as const;
