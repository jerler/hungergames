import {
  createAttemptedKillChange,
  createEliminationChange,
  createFatalChanges,
  createItemAcquisitionAndSurvivalChanges,
  createKillCreditChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { getItemLabel } from "~/game/events/event-resolution-helpers";
import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";
import { CORNUCOPIA_PROVISIONS_ITEM_ID } from "~/game/items/deprivation-protection";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameChange, GameTribute } from "~/game/types/game-state";

import {
  hasUsableCornucopiaContestedDirectWeapon,
  hasUsableCornucopiaPackItem,
  selectCornucopiaContestedDirectWeapon,
  selectCornucopiaPackItem,
  selectDistinctCornucopiaPackItems,
} from "./cornucopia-item-pool";
import type { CornucopiaFatalTargetProfile } from "./cornucopia-fatal-events";
import { chooseTextVariant, statSelectionProfile } from "../stat-gated/stat-gated-helpers";

function isHighLuck(tribute: GameTribute): boolean {
  return tribute.snapshot.stats.luck >= 4;
}

function isMaximumLuck(tribute: GameTribute): boolean {
  return tribute.snapshot.stats.luck === 5;
}

function canReceiveStandardCornucopiaHaul(tribute: GameTribute): boolean {
  return (
    isHighLuck(tribute) &&
    hasUsableCornucopiaPackItem(tribute) &&
    hasUsableCornucopiaContestedDirectWeapon(tribute)
  );
}

function requireTwoDistinctPackItems(
  actor: GameTribute,
  random: Parameters<typeof selectDistinctCornucopiaPackItems>[2],
) {
  const itemIds = selectDistinctCornucopiaPackItems(actor, 2, random);

  if (itemIds.length !== 2) {
    throw new Error(
      `High-Luck opening event could not select two distinct pack items for "${actor.id}".`,
    );
  }

  return itemIds;
}

function createSatisfyNeedChange(tribute: GameTribute, need: "food" | "water"): GameChange {
  return {
    type: "satisfy-survival-need",
    tributeId: tribute.id,
    need,
  };
}

const RAINING_SUPPLIES: EventDefinition = {
  id: "cornucopia-high-luck-raining-supplies",
  category: "survival",
  periods: ["day"],
  baseWeight: 0.85,
  tags: ["survival", "item", "weapon", "resource"],
  selectionProfile: statSelectionProfile(6, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
    provisionRoleIds: ["tribute"],
  },
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: canReceiveStandardCornucopiaHaul,
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const pronouns = getTributePronouns(actor);
    const itemIds = requireTwoDistinctPackItems(actor, random);
    const weaponId = selectCornucopiaContestedDirectWeapon(actor, random);

    return {
      text:
        `${actor.snapshot.name} runs toward the Cornucopia but gets scared by the chaos. ` +
        `Changing ${pronouns.possessiveAdjective} mind, ${pronouns.subject} heads for the woods, but not before a full backpack is thrown into the back of ${pronouns.possessiveAdjective} head, filled to the brim with supplies.`,
      changes: createItemAcquisitionAndSurvivalChanges(
        eventId,
        actor,
        [...itemIds, weaponId],
        round,
        "cornucopia",
      ),
    };
  },
};

const TRIP_TO_VICTORY: EventDefinition = {
  id: "cornucopia-high-luck-trip-to-victory",
  category: "survival",
  periods: ["day"],
  baseWeight: 0.9,
  tags: ["survival", "item", "weapon", "resource"],
  selectionProfile: statSelectionProfile(6, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
    provisionRoleIds: ["tribute"],
  },
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: canReceiveStandardCornucopiaHaul,
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const pronouns = getTributePronouns(actor);
    const itemId = selectCornucopiaPackItem(actor, random);
    const weaponId = selectCornucopiaContestedDirectWeapon(actor, random);

    return {
      text:
        `${actor.snapshot.name} trips while running toward the Cornucopia, slides beneath several fighting tributes, and crashes directly into a pile of supplies. ` +
        `A backpack becomes tangled around ${pronouns.possessiveAdjective} shoulders and ${getItemLabel(weaponId)} lands in ${pronouns.possessiveAdjective} lap. ` +
        `${pronouns.Subject} scrambles into the woods before ${pronouns.subject} runs out of good luck.`,
      changes: createItemAcquisitionAndSurvivalChanges(
        eventId,
        actor,
        [itemId, weaponId],
        round,
        "cornucopia",
      ),
    };
  },
};

const BUTTERFINGERS_FORTUNATE: EventDefinition = {
  id: "cornucopia-high-luck-butterfingers-fortunate",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.5,
  tags: ["fatal", "combat", "weapon", "item"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(3),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
    provisionRoleIds: ["actor"],
  },
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
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} reaches for a knife but drops it immediately. ` +
        `The weapon bounces off a crate and lands right between the eyes of ${target.snapshot.name}, who was running up behind ${actorPronouns.object} and winding up to strike. ` +
        `${actor.snapshot.name} pulls the knife out of ${target.snapshot.name}'s skull and books it away from the chaos.`,
      changes: [
        ...createFatalChanges(
          target,
          "cornucopia-high-luck-butterfingers",
          "Killed by a fortunate ricochet",
          `${target.snapshot.name} is killed when ${actor.snapshot.name}'s dropped knife ricochets into their skull.`,
          actor,
        ),
        ...createItemAcquisitionAndSurvivalChanges(eventId, actor, ["knife"], round, "cornucopia"),
      ],
    };
  },
};

const PERFECTLY_TIMED_SNEEZE_FORTUNATE: EventDefinition = {
  id: "cornucopia-high-luck-perfectly-timed-sneeze-fortunate",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.4,
  tags: ["fatal", "combat", "weapon"],
  participantShape: "trio",
  selectionProfile: statSelectionProfile(3),
  cornucopiaAcquisitionPolicy: {
    provisionRoleIds: ["actor"],
  },
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
      opposesRoleIds: ["actor", "bystander"],
    },
    {
      id: "bystander",
      count: 1,
      opposesRoleIds: ["target"],
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const bystander = requireSingleParticipant(participantsByRole, "bystander");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${actor.snapshot.name} arrives late to the Cornucopia and cannot grab a weapon before ${target.snapshot.name} raises ${targetPronouns.possessiveAdjective} weapon to strike. ` +
        `At that exact moment, ${actor.snapshot.name} releases an enormous sneeze and doubles over, causing the attack to sail harmlessly over ${actorPronouns.object} and bury itself in ${bystander.snapshot.name} instead.`,
      changes: [
        ...createFatalChanges(
          bystander,
          "cornucopia-high-luck-sneeze-redirection",
          "Killed by a redirected Cornucopia attack",
          `${bystander.snapshot.name} is accidentally killed by ${target.snapshot.name} when ${actor.snapshot.name} sneezes beneath the attack.`,
          target,
        ),
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

const CRATE_ESCAPE: EventDefinition = {
  id: "cornucopia-high-luck-crate-escape",
  category: "survival",
  periods: ["day"],
  baseWeight: 0.9,
  tags: ["survival", "item", "weapon", "resource", "environment"],
  selectionProfile: statSelectionProfile(6, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
    provisionRoleIds: ["tribute"],
  },
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: canReceiveStandardCornucopiaHaul,
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const pronouns = getTributePronouns(actor);
    const itemId = selectCornucopiaPackItem(actor, random);
    const weaponId = selectCornucopiaContestedDirectWeapon(actor, random);

    return {
      text:
        `${actor.snapshot.name} takes cover behind a stack of crates as weapons fly through the Cornucopia. ` +
        `The crates collapse around ${pronouns.object}, somehow forming a wooden tunnel leading directly into the woods with enough supplies pouring from it to give ${actor.snapshot.name} a decent stockpile.`,
      changes: createItemAcquisitionAndSurvivalChanges(
        eventId,
        actor,
        [itemId, weaponId],
        round,
        "cornucopia",
      ),
    };
  },
};

const FRIENDLY_FIRE_FRIENDLIER: EventDefinition = {
  id: "cornucopia-high-luck-friendly-fire",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.25,
  tags: ["fatal", "combat", "weapon"],
  participantShape: "trio",
  selectionProfile: statSelectionProfile(3),
  cornucopiaAcquisitionPolicy: {
    provisionRoleIds: ["actor"],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighLuck,
      opposesRoleIds: ["target", "bystander"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor", "bystander"],
    },
    {
      id: "bystander",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor", "target"],
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const bystander = requireSingleParticipant(participantsByRole, "bystander");
    const actorPronouns = getTributePronouns(actor);

    return {
      text:
        `${target.snapshot.name} and ${bystander.snapshot.name} both fire at ${actor.snapshot.name}, who slips on loose rope at the exact moment the projectiles fly overhead. ` +
        `The shots pass over ${actorPronouns.object} and strike ${target.snapshot.name} and ${bystander.snapshot.name} instead.`,
      changes: [
        createEliminationChange(
          target,
          "cornucopia-high-luck-friendly-fire",
          "Killed by friendly fire",
          `${target.snapshot.name} is killed by ${bystander.snapshot.name}'s redirected shot.`,
          [bystander.id],
        ),
        createAttemptedKillChange(bystander),
        createKillCreditChange(bystander),
        createEliminationChange(
          bystander,
          "cornucopia-high-luck-friendly-fire",
          "Killed by friendly fire",
          `${bystander.snapshot.name} is killed by ${target.snapshot.name}'s redirected shot.`,
          [target.id],
        ),
        createAttemptedKillChange(target),
        createKillCreditChange(target),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const FALLING_INVENTORY: EventDefinition = {
  id: "cornucopia-high-luck-falling-inventory",
  category: "survival",
  periods: ["day"],
  baseWeight: 0.6,
  tags: ["survival", "item", "weapon", "resource"],
  selectionProfile: statSelectionProfile(7, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
    provisionRoleIds: ["tribute"],
  },
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: (tribute) =>
        isMaximumLuck(tribute) &&
        hasUsableCornucopiaPackItem(tribute) &&
        hasUsableCornucopiaContestedDirectWeapon(tribute),
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const pronouns = getTributePronouns(actor);
    const itemIds = requireTwoDistinctPackItems(actor, random);
    const weaponId = selectCornucopiaContestedDirectWeapon(actor, random);

    return {
      text:
        `${actor.snapshot.name} reaches the Cornucopia just as a fight on top of the supply pile sends several backpacks tumbling through the air. ` +
        `One lands perfectly over each of ${pronouns.possessiveAdjective} shoulders while ${getItemLabel(weaponId)} slides to a stop between ${pronouns.possessiveAdjective} feet.`,
      changes: createItemAcquisitionAndSurvivalChanges(
        eventId,
        actor,
        [...itemIds, weaponId],
        round,
        "cornucopia",
      ),
    };
  },
};

const ACCIDENTAL_BODYGUARD: EventDefinition = {
  id: "cornucopia-high-luck-accidental-bodyguard",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.35,
  tags: ["fatal", "combat", "weapon"],
  participantShape: "trio",
  selectionProfile: statSelectionProfile(5, ["custom-eligibility"]),
  cornucopiaAcquisitionPolicy: {
    provisionRoleIds: ["actor"],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isHighLuck(tribute) && tribute.snapshot.stats.brawn <= 3,
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      isEligible: (tribute) => tribute.snapshot.stats.brawn <= 3,
      opposesRoleIds: ["actor", "bystander"],
    },
    {
      id: "bystander",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brawn >= 4,
      opposesRoleIds: ["target"],
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const bystander = requireSingleParticipant(participantsByRole, "bystander");

    return {
      text:
        `${actor.snapshot.name} stumbles backward while fleeing from ${target.snapshot.name} and crashes into ${bystander.snapshot.name}. ` +
        `Mistaking ${target.snapshot.name}'s raised weapon as an attack on them, the larger tribute immediately turns around and removes the problem for ${actor.snapshot.name}.`,
      changes: [
        ...createFatalChanges(
          target,
          "cornucopia-high-luck-accidental-bodyguard",
          "Killed by an accidental bodyguard",
          `${target.snapshot.name} is killed by ${bystander.snapshot.name} after threatening ${actor.snapshot.name}.`,
          bystander,
        ),
        ...createSurvivalChanges([actor, bystander]),
      ],
    };
  },
};

const SHOELACE_ASSASSIN: EventDefinition = {
  id: "bloodbath-flee-high-luck-shoelace-assassin",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.1,
  tags: ["fatal", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(2),
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
  resolve({ random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const pronouns = getTributePronouns(actor);

    return {
      text: chooseTextVariant(random, [
        `${actor.snapshot.name} barely makes it past the treeline before ${pronouns.possessiveAdjective} shoelaces tangle and send ${pronouns.object} tumbling. ${target.snapshot.name} leaps over ${pronouns.object}, lands on slick rocks, and pitches headfirst into a tree with a fatal crack.`,
        `${actor.snapshot.name}'s shoelaces knot together during the escape, dropping ${pronouns.object} flat onto the forest floor. ${target.snapshot.name} tries to vault over the fallen tribute, slips on wet moss, and breaks their neck against a tree.`,
        `${actor.snapshot.name} trips over ${pronouns.possessiveAdjective} own laces just beyond the Cornucopia. ${target.snapshot.name} swerves to avoid ${pronouns.object}, catches a boot beneath a root, and strikes a tree headfirst.`,
        `${actor.snapshot.name} tumbles across the treeline after stepping on an untied lace. ${target.snapshot.name} confidently jumps over ${pronouns.object}, lands on a patch of polished stone, and slides skull-first into a trunk.`,
      ]),
      changes: [
        ...createFatalChanges(
          target,
          "bloodbath-flee-high-luck-shoelace-assassin",
          "Killed while leaping over a fallen tribute",
          `${target.snapshot.name} is accidentally killed while pursuing ${actor.snapshot.name} into the woods.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const DRAMATIC_GETAWAY_SUCCESSFUL: EventDefinition = {
  id: "bloodbath-flee-high-luck-dramatic-getaway",
  category: "survival",
  periods: ["day"],
  baseWeight: 0.75,
  tags: ["survival", "item", "resource"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighLuck,
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text: chooseTextVariant(random, [
        `${actor.snapshot.name} decides ${pronouns.subject} would not fare well in the Cornucopia struggle and heads for the trees. Just before the treeline, a backpack flung from the chaos lands directly in ${pronouns.possessiveAdjective} path, filled to the brim with provisions.`,
        `${actor.snapshot.name} turns away from the Bloodbath moments before a supply bag sails over the Cornucopia and lands at ${pronouns.possessiveAdjective} feet. ${pronouns.Subject} grabs it and keeps running.`,
        `${actor.snapshot.name} flees for the woods empty-handed until a tumbling backpack somehow keeps pace down the hill and stops beside ${pronouns.object}. It is packed with provisions.`,
        `${actor.snapshot.name} abandons the Cornucopia and nearly reaches the trees when an airborne backpack lands upright in front of ${pronouns.object}, conveniently stocked with enough provisions to justify the detour.`,
      ]),
      changes: [
        ...createItemAcquisitionAndSurvivalChanges(
          eventId,
          actor,
          [CORNUCOPIA_PROVISIONS_ITEM_ID],
          round,
          "cornucopia",
        ),
        createSatisfyNeedChange(actor, "food"),
        createSatisfyNeedChange(actor, "water"),
      ],
    };
  },
};

export const HIGH_LUCK_CORNUCOPIA_FLAVOUR_EVENTS = [
  RAINING_SUPPLIES,
  TRIP_TO_VICTORY,
  CRATE_ESCAPE,
  FALLING_INVENTORY,
] satisfies readonly EventDefinition[];

export const HIGH_LUCK_CORNUCOPIA_FATAL_TARGET_PROFILES = [
  {
    definition: BUTTERFINGERS_FORTUNATE,
    minImmediateEliminations: 1,
    maxImmediateEliminations: 1,
  },
  {
    definition: PERFECTLY_TIMED_SNEEZE_FORTUNATE,
    minImmediateEliminations: 1,
    maxImmediateEliminations: 1,
  },
  {
    definition: FRIENDLY_FIRE_FRIENDLIER,
    minImmediateEliminations: 2,
    maxImmediateEliminations: 2,
  },
  {
    definition: ACCIDENTAL_BODYGUARD,
    minImmediateEliminations: 1,
    maxImmediateEliminations: 1,
  },
] satisfies readonly CornucopiaFatalTargetProfile[];

export const HIGH_LUCK_FLEE_EVENTS = [
  SHOELACE_ASSASSIN,
  DRAMATIC_GETAWAY_SUCCESSFUL,
] satisfies readonly EventDefinition[];

export const HIGH_LUCK_OPENING_EVENTS = [
  ...HIGH_LUCK_CORNUCOPIA_FLAVOUR_EVENTS,
  ...HIGH_LUCK_CORNUCOPIA_FATAL_TARGET_PROFILES.map((profile) => profile.definition),
  ...HIGH_LUCK_FLEE_EVENTS,
] satisfies readonly EventDefinition[];
