import {
  createFatalChanges,
  createItemAcquisitionAndSurvivalChanges,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { getItemLabel } from "~/game/events/event-resolution-helpers";
import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";
import {
  hasUsableCornucopiaContestedDirectWeapon,
  hasUsableCornucopiaPackItem,
  selectCornucopiaContestedDirectWeapon,
  selectCornucopiaPackItem,
  selectDistinctCornucopiaPackItems,
} from "~/game/events/catalogue/bloodbath/cornucopia-item-pool";
import {
  chooseTextVariant,
  isHighBrains,
  isHighBrawn,
  isLowBrawn,
  statSelectionProfile,
} from "~/game/events/catalogue/stat-gated/stat-gated-helpers";
import { canFormStandardTruce } from "~/game/truces/truce-lifecycle";
import {
  createTruceInstance,
  getActiveTruceForTribute,
  getTruceFormationPopulationMultiplier,
  STANDARD_TRUCE_EXPIRY_ROUND,
} from "~/game/truces/truce-engine";
import { getTributePronouns } from "~/game/tributes/pronouns";

import type { CornucopiaFatalTargetProfile } from "./cornucopia-fatal-events";

const LOW_BRAWN_DRAGGING_LOOT: EventDefinition = {
  id: "cornucopia-low-brawn-dragging-loot",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.4,
  tags: ["hazard"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: isLowBrawn,
    },
  ],
  resolve({ random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const pronouns = getTributePronouns(actor);
    const text = chooseTextVariant(random, [
      `${actor.snapshot.name} sprints for the Cornucopia, quickly becomes out of breath, and wishes ${pronouns.subject} had gone to the gym more often. ` +
        `Arriving last has its perks, though, and ${pronouns.subject} avoids most of the chaos while grabbing a small backpack.`,
      `${actor.snapshot.name} spots a large backpack stuffed with supplies. ${pronouns.Subject} loops ${pronouns.possessiveAdjective} arms through the straps, ` +
        `takes one step, and lands on ${pronouns.possessiveAdjective} back like a turtle. Unable to get up, ${pronouns.subject} abandons the pack, ` +
        `grabs a small bag of food instead, and runs into the woods ashamed.`,
    ]);

    return {
      text,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const SMARTER_NOT_HARDER: EventDefinition = {
  id: "cornucopia-smarter-not-harder",
  category: "hazard",
  periods: ["day"],
  baseWeight: 2.4,
  tags: ["hazard", "item", "resource"],
  selectionProfile: statSelectionProfile(4, ["item-requirement"]),
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: (tribute) =>
        isLowBrawn(tribute) && isHighBrains(tribute) && hasUsableCornucopiaPackItem(tribute),
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const pronouns = getTributePronouns(actor);
    const itemId = selectCornucopiaPackItem(actor, random);

    return {
      text:
        `${actor.snapshot.name} tries to grab supplies but cannot carry much with ${pronouns.possessiveAdjective} tiny muscles. ` +
        `Luckily, ${pronouns.subject} works smarter rather than harder, piles ${getItemLabel(itemId)} onto a shield, ` +
        `and rides it down the hill to safety.`,
      changes: createItemAcquisitionAndSurvivalChanges(
        eventId,
        actor,
        [itemId],
        round,
        "cornucopia",
      ),
    };
  },
};

const HIGH_BRAWN_FIRST: EventDefinition = {
  id: "cornucopia-high-brawn-first",
  category: "survival",
  periods: ["day"],
  baseWeight: 2,
  tags: ["survival", "weapon", "item", "resource"],
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
  },
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: (tribute) =>
        isHighBrawn(tribute) &&
        hasUsableCornucopiaPackItem(tribute) &&
        hasUsableCornucopiaContestedDirectWeapon(tribute),
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const pronouns = getTributePronouns(actor);
    const itemId = selectCornucopiaPackItem(actor, random);
    const weaponId = selectCornucopiaContestedDirectWeapon(actor, random);

    return {
      text:
        `${actor.snapshot.name} flexes ${pronouns.possessiveAdjective} athletic prowess and reaches the Cornucopia before anyone else, ` +
        `getting ${pronouns.possessiveAdjective} full pick of the supplies before taking off into the woods.`,
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

const HIGH_BRAWN_MORE_THAN_YOUR_SHARE: EventDefinition = {
  id: "cornucopia-high-brawn-more-than-your-share",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.6,
  tags: ["survival", "weapon", "item", "resource"],
  selectionProfile: statSelectionProfile(6, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
  },
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: (tribute) =>
        tribute.snapshot.stats.brawn === 5 &&
        hasUsableCornucopiaPackItem(tribute) &&
        hasUsableCornucopiaContestedDirectWeapon(tribute),
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const pronouns = getTributePronouns(actor);
    const itemIds = selectDistinctCornucopiaPackItems(actor, 2, random);
    const weaponId = selectCornucopiaContestedDirectWeapon(actor, random);

    if (itemIds.length !== 2) {
      throw new Error("More Than Your Share could not select two distinct supplies.");
    }

    return {
      text: chooseTextVariant(random, [
        `${actor.snapshot.name} bulldozes into the Cornucopia, quickly wrestles two very large boxes out of the chaos, and ploughs into the woods with ${pronouns.possessiveAdjective} muscles shimmering in the morning light.`,
        `${actor.snapshot.name} bursts through the chaos of the Cornucopia, tributes bouncing off ${pronouns.object} like flies. With a great heave, ${pronouns.subject} throws an entire oversized box over ${pronouns.possessiveAdjective} shoulder and leaves to find shelter.`,
        `${actor.snapshot.name} reaches the Cornucopia and gathers an enormous armful of weapons, supplies, and backpacks. Very much resembling someone refusing to make two trips with groceries on principle, ${actor.snapshot.name} staggers into the woods carrying well over ${pronouns.possessiveAdjective} fair share of the loot.`,
        `${actor.snapshot.name} rushes towards the Cornucopia, pushing tributes out of ${pronouns.possessiveAdjective} way with ease. ${pronouns.Subject} grabs a weapon out of someone's hand, brushes them off like a fly, hooks a backpack over each arm, and heads into the woods.`,
      ]),
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

const HIGH_BRAWN_BAG_OF_CHIPS: EventDefinition = {
  id: "cornucopia-high-brawn-bag-of-chips",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.5,
  tags: ["hazard", "item", "resource"],
  selectionProfile: statSelectionProfile(4, ["item-requirement"]),
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: (tribute) => isHighBrawn(tribute) && hasUsableCornucopiaPackItem(tribute),
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const itemId = selectCornucopiaPackItem(actor, random);

    return {
      text:
        `${actor.snapshot.name} finds a supply crate sealed with a heavy lock. Rather than waste time searching for a key, ` +
        `${actor.snapshot.name} grabs both sides of the crate and tears it open like a bag of chips.`,
      changes: createItemAcquisitionAndSurvivalChanges(
        eventId,
        actor,
        [itemId],
        round,
        "cornucopia",
      ),
    };
  },
};

const HIGH_BRAWN_EMERGENCY_EXIT: EventDefinition = {
  id: "cornucopia-high-brawn-emergency-exit",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.4,
  tags: ["survival", "combat"],
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: isHighBrawn,
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `After grabbing ${pronouns.possessiveAdjective} fill of supplies, ${actor.snapshot.name} finds the path away from the Cornucopia blocked by fighting tributes. ` +
        `Rather than wait for an opening, ${pronouns.subject} bulldozes straight through, sending several tributes flying into the air.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const SHOOTING_FISH_IN_A_BARREL: EventDefinition = {
  id: "cornucopia-low-brawn-shooting-fish-in-a-barrel",
  category: "fatal",
  periods: ["day"],
  baseWeight: 1.5,
  tags: ["fatal", "combat"],
  selectionProfile: statSelectionProfile(3),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrawn,
    },
    {
      id: "target",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brawn >= 3,
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const pronouns = getTributePronouns(actor);
    const text =
      `${actor.snapshot.name} attempts to grab a sword but is pinned beneath toppled crates. ` +
      `Unable to free ${pronouns.reflexive} with ${pronouns.possessiveAdjective} noodle arms, ${actor.snapshot.name} waits helplessly ` +
      `until ${target.snapshot.name} picks up the sword and ends the humiliation.`;

    return {
      text,
      changes: [
        ...createFatalChanges(
          actor,
          "cornucopia-low-brawn-crate-pinning",
          "Killed while pinned beneath crates",
          `${actor.snapshot.name} is killed by ${target.snapshot.name} while trapped beneath Cornucopia crates.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const HIGH_BRAWN_HUMAN_BULLDOZER: EventDefinition = {
  id: "cornucopia-high-brawn-human-bulldozer",
  category: "fatal",
  periods: ["day"],
  baseWeight: 1.4,
  tags: ["fatal", "combat"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(3),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      isEligible: (tribute) => tribute.snapshot.stats.brawn <= 3,
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${actor.snapshot.name} charges toward the Cornucopia, ploughing directly through ${target.snapshot.name} without slowing down—or, frankly, even noticing. ` +
        `${target.snapshot.name} disappears beneath the stampede, ending ${targetPronouns.possessiveAdjective} Games early.`,
      changes: [
        ...createFatalChanges(
          target,
          "cornucopia-high-brawn-bulldozer",
          "Trampled at the Cornucopia",
          `${target.snapshot.name} is trampled by ${actor.snapshot.name} during the charge to the Cornucopia.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const HIGH_BRAWN_PERFECT_WEAPON: EventDefinition = {
  id: "cornucopia-high-brawn-perfect-weapon",
  category: "fatal",
  periods: ["day"],
  baseWeight: 1.3,
  tags: ["fatal", "combat", "weapon", "environment"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrawn,
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
        `Spotting the perfect weapon buried beneath a pile of crates, ${actor.snapshot.name} reaches in and yanks it free with tremendous force. ` +
        `The entire pile topples over onto ${target.snapshot.name}, crushing ${targetPronouns.object} beneath several hundred pounds of supplies.`,
      changes: [
        ...createFatalChanges(
          target,
          "cornucopia-high-brawn-toppled-crates",
          "Crushed beneath Cornucopia crates",
          `${target.snapshot.name} is crushed beneath crates toppled by ${actor.snapshot.name}.`,
          actor,
        ),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const HIGH_BRAWN_YOINK: EventDefinition = {
  id: "cornucopia-high-brawn-yoink",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.5,
  tags: ["hazard", "combat", "weapon", "item", "resource"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(6, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
    provisionRoleIds: ["actor"],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) =>
        isHighBrawn(tribute) &&
        hasUsableCornucopiaPackItem(tribute) &&
        hasUsableCornucopiaContestedDirectWeapon(tribute),
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      isEligible: isLowBrawn,
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);
    const itemId = selectCornucopiaPackItem(actor, random);
    const weaponId = selectCornucopiaContestedDirectWeapon(actor, random);

    return {
      text:
        `${target.snapshot.name} begins running from the Cornucopia with ${getItemLabel(weaponId)} in hand and a backpack flung over ${targetPronouns.possessiveAdjective} shoulder ` +
        `when ${targetPronouns.subject} suddenly rises into the air, legs kicking. ${actor.snapshot.name} strips ${target.snapshot.name} of the weapon and supplies, ` +
        `balls ${targetPronouns.object} up, and chucks ${targetPronouns.object} into the forest empty-handed.`,
      changes: [
        ...createItemAcquisitionAndSurvivalChanges(
          eventId,
          actor,
          [itemId, weaponId],
          round,
          "cornucopia",
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const RUN_FASTER: EventDefinition = {
  id: "bloodbath-flee-low-brawn-run-faster",
  category: "survival",
  periods: ["day"],
  baseWeight: 0.45,
  tags: ["survival", "fatal", "combat"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrawn,
    },
    {
      id: "target",
      count: 1,
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const pronouns = getTributePronouns(actor);
    const text =
      `${actor.snapshot.name} knows ${pronouns.subject} does not stand a chance at the Cornucopia and runs for the hills. ` +
      `In a show of pitiful athleticism, ${pronouns.subject} is quickly overtaken and trampled by ${target.snapshot.name} in the stampede.`;

    return {
      text,
      changes: [
        ...createFatalChanges(
          actor,
          "bloodbath-flee-trampled",
          "Trampled while fleeing",
          `${actor.snapshot.name} is trampled by ${target.snapshot.name} while fleeing the Cornucopia.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const HIGH_BRAWN_GENTLE_GIANT_FLEE: EventDefinition = {
  id: "bloodbath-flee-high-brawn-gentle-giant",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.2,
  tags: ["survival", "truce", "cooperative"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4, ["truce-requirement", "custom-eligibility"]),
  isEligible: ({ state, livingTributes }) =>
    canFormStandardTruce(2, state.tributes.filter((tribute) => tribute.isAlive).length) &&
    livingTributes.some(
      (tribute) => isHighBrawn(tribute) && !getActiveTruceForTribute(state, tribute.id),
    ) &&
    livingTributes.some(
      (tribute) => isLowBrawn(tribute) && !getActiveTruceForTribute(state, tribute.id),
    ),
  getWeightMultiplier: ({ state, round }) => getTruceFormationPopulationMultiplier(state, round),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isHighBrawn(tribute) && !getActiveTruceForTribute(state, tribute.id),
    },
    {
      id: "target",
      count: 1,
      isEligible: (tribute, { state }) =>
        isLowBrawn(tribute) && !getActiveTruceForTribute(state, tribute.id),
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");

    return {
      text:
        `${actor.snapshot.name} runs into the woods and finds ${target.snapshot.name} struggling to move a fallen branch off the path. ` +
        `After watching for several increasingly painful seconds, ${actor.snapshot.name} lifts the branch aside and decides ${target.snapshot.name} probably shouldn't be left alone in the arena.`,
      changes: [
        {
          type: "form-truce",
          truce: createTruceInstance(
            eventId,
            [actor.id, target.id],
            round,
            STANDARD_TRUCE_EXPIRY_ROUND,
          ),
        },
        ...createSurvivalChanges([actor, target]),
      ],
    };
  },
};

export const STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS = [
  LOW_BRAWN_DRAGGING_LOOT,
  SMARTER_NOT_HARDER,
  HIGH_BRAWN_FIRST,
  HIGH_BRAWN_MORE_THAN_YOUR_SHARE,
  HIGH_BRAWN_BAG_OF_CHIPS,
  HIGH_BRAWN_EMERGENCY_EXIT,
] satisfies readonly EventDefinition[];

export const STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES = [
  {
    definition: SHOOTING_FISH_IN_A_BARREL,
    minImmediateEliminations: 1,
    maxImmediateEliminations: 1,
  },
  {
    definition: HIGH_BRAWN_HUMAN_BULLDOZER,
    minImmediateEliminations: 1,
    maxImmediateEliminations: 1,
  },
  {
    definition: HIGH_BRAWN_PERFECT_WEAPON,
    minImmediateEliminations: 1,
    maxImmediateEliminations: 1,
  },
] satisfies readonly CornucopiaFatalTargetProfile[];

export const STAT_GATED_CORNUCOPIA_NONFATAL_PAIR_EVENTS = [
  HIGH_BRAWN_YOINK,
] satisfies readonly EventDefinition[];

export const STAT_GATED_FLEE_EVENTS = [
  RUN_FASTER,
  HIGH_BRAWN_GENTLE_GIANT_FLEE,
] satisfies readonly EventDefinition[];

export const STAT_GATED_BLOODBATH_EVENTS = [
  ...STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
  ...STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES.map(({ definition }) => definition),
  ...STAT_GATED_CORNUCOPIA_NONFATAL_PAIR_EVENTS,
  ...STAT_GATED_FLEE_EVENTS,
] satisfies readonly EventDefinition[];
