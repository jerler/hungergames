import {
  createFatalChanges,
  createItemAcquisitionAndSurvivalChanges,
  createSurvivalChanges,
  createStatusChange,
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
  isLowBrains,
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

const LOW_BRAINS_OOH_SHINY: EventDefinition = {
  id: "cornucopia-low-brains-ooh-shiny",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.5,
  tags: ["hazard"],
  selectionProfile: statSelectionProfile(2),
  cornucopiaAcquisitionPolicy: {
    provisionRoleIds: [],
  },
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: isLowBrains,
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} rushes into the Cornucopia surrounded by weapons, backpacks, and lifesaving supplies. ` +
        `Distracted by something shiny at the bottom of an empty crate, confident that it will be ${pronouns.possessiveAdjective} key to survival, ` +
        `${actor.snapshot.name} spends the entire Bloodbath trying to pry it loose before finding out it was just a mirror, ` +
        `allowing ${pronouns.object} to take a good long look at ${pronouns.possessiveAdjective} life choices.`,
      changes: createSurvivalChanges([actor]),
    };
  },
};

const LOW_BRAINS_POINTY_END: EventDefinition = {
  id: "cornucopia-low-brains-pointy-end",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.4,
  tags: ["hazard", "status", "item", "weapon"],
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
  },
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: (tribute) =>
        tribute.snapshot.stats.brains === 1 && hasUsableCornucopiaContestedDirectWeapon(tribute),
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const pronouns = getTributePronouns(actor);
    const weaponId = selectCornucopiaContestedDirectWeapon(actor, random);
    const weaponLabel = getItemLabel(weaponId).toLowerCase();
    const weaponWithArticle = /^[aeiou]/i.test(weaponLabel)
      ? `an ${weaponLabel}`
      : `a ${weaponLabel}`;

    return {
      text:
        `${actor.snapshot.name} grabs ${weaponWithArticle} from the Cornucopia and immediately holds it by the wrong end. ` +
        `After painfully correcting ${pronouns.possessiveAdjective} grip, ${pronouns.subject} escapes into the woods bleeding but thankfully at least slightly better informed.`,
      changes: [
        ...createItemAcquisitionAndSurvivalChanges(eventId, actor, [weaponId], round, "cornucopia"),
        createStatusChange(eventId, actor, "injured", 1, round),
      ],
    };
  },
};

const LOW_BRAINS_JUST_ONE_MORE_THING: EventDefinition = {
  id: "cornucopia-low-brains-just-one-more-thing",
  category: "fatal",
  periods: ["day"],
  baseWeight: 1,
  tags: ["fatal", "combat", "ambush"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrains,
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
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} manages to grab a small backpack and run into the woods without injury. ` +
        `Once safely among the trees, ${actor.snapshot.name} opens the bag and decides ${pronouns.subject} did not get enough supplies. ` +
        `${actor.snapshot.name} is struck with several arrows as ${pronouns.subject} tries to run back to the Cornucopia.`,
      changes: [
        ...createFatalChanges(
          actor,
          "cornucopia-low-brains-returned-for-more",
          "Shot while returning to the Cornucopia",
          `${actor.snapshot.name} is shot by ${target.snapshot.name} after returning to the Cornucopia for more supplies.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const LOW_BRAINS_NOT_A_BOX: EventDefinition = {
  id: "cornucopia-low-brains-not-a-box",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.8,
  tags: ["fatal", "environment"],
  selectionProfile: statSelectionProfile(3),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => tribute.snapshot.stats.brains === 1,
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} grabs a hand-sized metal container within the Cornucopia and cannot figure out how to open it. ` +
        `Finally, ${pronouns.subject} finds a pin-shaped key and pulls it out, hoping the container will swing open, only to have the grenade explode in ${pronouns.possessiveAdjective} hands.`,
      changes: createFatalChanges(
        actor,
        "cornucopia-low-brains-grenade",
        "Killed by an exploding grenade",
        `${actor.snapshot.name} is killed after pulling the pin from a grenade at the Cornucopia.`,
      ),
    };
  },
};

const LOW_BRAINS_FOLLOW_THAT_TRIBUTE: EventDefinition = {
  id: "bloodbath-flee-low-brains-follow-that-tribute",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.2,
  tags: ["survival", "truce", "cooperative"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4, ["truce-requirement", "custom-eligibility"]),
  isEligible: ({ state, livingTributes }) =>
    canFormStandardTruce(2, state.tributes.filter((tribute) => tribute.isAlive).length) &&
    livingTributes.some(
      (tribute) => isLowBrains(tribute) && !getActiveTruceForTribute(state, tribute.id),
    ) &&
    livingTributes.some((tribute) => !getActiveTruceForTribute(state, tribute.id)),
  getWeightMultiplier: ({ state, round }) => getTruceFormationPopulationMultiplier(state, round),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isLowBrains(tribute) && !getActiveTruceForTribute(state, tribute.id),
    },
    {
      id: "target",
      count: 1,
      isEligible: (tribute, { state }) => !getActiveTruceForTribute(state, tribute.id),
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${actor.snapshot.name} has no idea where to go and decides ${target.snapshot.name} looks like someone with a plan. ` +
        `${actor.snapshot.name} follows ${target.snapshot.name} deep into the woods until ${targetPronouns.subject} finally notices the unexpected addition to ${targetPronouns.possessiveAdjective} group.`,
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

const HIGH_BRAINS_SHOPPING_LIST: EventDefinition = {
  id: "cornucopia-high-brains-shopping-list",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.7,
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
        isHighBrains(tribute) &&
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
      throw new Error("Shopping List could not select two distinct supplies.");
    }

    return {
      text:
        `${actor.snapshot.name} studies the Cornucopia before the cannon fires, memorizing exactly where the most useful supplies appear to be stored. ` +
        `While everyone else grabs whatever they can reach, ${pronouns.subject} follows a carefully planned route and disappears into the woods with everything ${pronouns.subject} wanted.`,
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

const HIGH_BRAINS_PRIORITIES: EventDefinition = {
  id: "cornucopia-high-brains-priorities",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.4,
  tags: ["survival", "item", "resource"],
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
  },
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: isHighBrains,
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");

    return {
      text:
        `${actor.snapshot.name} ignores the enormous weapon pile and grabs the smaller supplies everyone else overlooked. ` +
        `By the time the other tributes realize medicine and fire-starters might also be useful, ${actor.snapshot.name} is already safely inside the woods.`,
      changes: createItemAcquisitionAndSurvivalChanges(
        eventId,
        actor,
        ["poison-vial", "med-kit", "energy-drink", "lighter"],
        round,
        "cornucopia",
      ),
    };
  },
};

const HIGH_BRAINS_LET_THEM_FIGHT: EventDefinition = {
  id: "cornucopia-high-brains-let-them-fight",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.2,
  tags: ["hazard", "combat", "status"],
  participantShape: "trio",
  selectionProfile: statSelectionProfile(2),
  cornucopiaAcquisitionPolicy: {
    provisionRoleIds: ["actor"],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
    },
    {
      id: "target",
      count: 1,
    },
    {
      id: "bystander",
      count: 1,
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const bystander = requireSingleParticipant(participantsByRole, "bystander");
    const pronouns = getTributePronouns(actor);

    return {
      text:
        `${actor.snapshot.name} waits patiently while ${target.snapshot.name} and ${bystander.snapshot.name} fight over a backpack. ` +
        `Once they are sufficiently distracted by each other, ${pronouns.subject} grabs the bag and runs to safety.`,
      changes: [
        createStatusChange(eventId, target, "injured", 1, round),
        createStatusChange(eventId, bystander, "injured", 1, round),
        ...createSurvivalChanges([actor, target, bystander]),
      ],
    };
  },
};

const HIGH_BRAINS_THINKING_OUTSIDE_THE_BOX: EventDefinition = {
  id: "cornucopia-high-brains-thinking-outside-the-box",
  category: "hazard",
  periods: ["day"],
  baseWeight: 1.3,
  tags: ["hazard", "combat", "weapon", "item", "resource"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(5, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
    provisionRoleIds: ["actor"],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) =>
        isHighBrains(tribute) && hasUsableCornucopiaContestedDirectWeapon(tribute),
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const weaponId = selectCornucopiaContestedDirectWeapon(actor, random);
    const weaponLabel = getItemLabel(weaponId).toLowerCase();

    return {
      text:
        `Not wanting to risk getting injured in the fight for the weaponry, ${actor.snapshot.name} waits beside a teetering tower of boxes until ${target.snapshot.name} runs into view holding a shiny ${weaponLabel}. ` +
        `${actor.snapshot.name} sends the boxes flying onto ${target.snapshot.name}, steals the ${weaponLabel}, and runs to safety.`,
      changes: [
        ...createItemAcquisitionAndSurvivalChanges(eventId, actor, [weaponId], round, "cornucopia"),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const HIGH_BRAINS_INVENTORY_MANAGEMENT: EventDefinition = {
  id: "cornucopia-high-brains-inventory-management",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.75,
  tags: ["fatal", "combat", "item", "resource"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
    provisionRoleIds: ["actor"],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute) => isHighBrains(tribute) && hasUsableCornucopiaPackItem(tribute),
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const pronouns = getTributePronouns(actor);

    if (random() < 0.5) {
      return {
        text:
          `${actor.snapshot.name} opens several backpacks inside the Cornucopia, removes the useless weight, and combines the best supplies into one manageable bag. ` +
          `${pronouns.Subject} escapes while everyone else is still struggling with whatever they grabbed first.`,
        changes: [
          ...createItemAcquisitionAndSurvivalChanges(
            eventId,
            actor,
            ["lighter", "med-kit", "energy-drink"],
            round,
            "cornucopia",
          ),
          ...createSurvivalChanges([target]),
        ],
      };
    }

    return {
      text:
        `${actor.snapshot.name} opens several backpacks inside the Cornucopia, removes the useless weight, and combines the best supplies into one manageable bag. ` +
        `Unfortunately, ${pronouns.subject} spends too long on the task and is rewarded with an arrow to the skull.`,
      changes: [
        ...createFatalChanges(
          actor,
          "cornucopia-high-brains-inventory-management",
          "Shot while reorganizing supplies",
          `${actor.snapshot.name} is shot by ${target.snapshot.name} after spending too long reorganizing Cornucopia supplies.`,
          target,
        ),
        ...createSurvivalChanges([target]),
      ],
    };
  },
};

const HIGH_BRAINS_CALCULATED_LOSS: EventDefinition = {
  id: "cornucopia-high-brains-calculated-loss",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.2,
  tags: ["survival", "item", "resource"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(4, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
    provisionRoleIds: ["actor"],
  },
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      isEligible: hasUsableCornucopiaPackItem,
      opposesRoleIds: ["actor"],
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const itemId = selectCornucopiaPackItem(target, random);

    return {
      text:
        `${actor.snapshot.name} grabs a bag from the Cornucopia and runs for the woods, only to realize that ${target.snapshot.name} is racing after ${actorPronouns.object}. ` +
        `Thinking fast, ${actor.snapshot.name} drops the least useful item from the bag, causing ${target.snapshot.name} to stop and collect it while ${actor.snapshot.name} escapes with everything that actually matters.`,
      changes: [
        ...createItemAcquisitionAndSurvivalChanges(eventId, target, [itemId], round, "cornucopia"),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

const HIGH_BRAINS_NOT_MY_PROBLEM: EventDefinition = {
  id: "bloodbath-flee-high-brains-not-my-problem",
  category: "fatal",
  periods: ["day"],
  baseWeight: 0.35,
  tags: ["fatal", "combat"],
  participantShape: "trio",
  selectionProfile: statSelectionProfile(2),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isHighBrains,
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["killer"],
    },
    {
      id: "killer",
      count: 1,
      opposesRoleIds: ["target"],
    },
  ],
  resolve({ participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const killer = requireSingleParticipant(participantsByRole, "killer");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);

    return {
      text:
        `${target.snapshot.name} and ${actor.snapshot.name} run into the woods at the same time, with several tributes hot in pursuit. ` +
        `${target.snapshot.name} begs ${actor.snapshot.name} to slow down so they can help each other escape together. ` +
        `${actor.snapshot.name} glances back at the approaching tributes, apologizes with complete insincerity, and continues running. ` +
        `${killer.snapshot.name} catches ${target.snapshot.name} moments later and kills ${targetPronouns.object} while ${actorPronouns.subject} disappears into the woods.`,
      changes: [
        ...createFatalChanges(
          target,
          "bloodbath-flee-high-brains-not-my-problem",
          "Abandoned during the escape",
          `${target.snapshot.name} is abandoned by ${actor.snapshot.name} and killed by ${killer.snapshot.name}.`,
          killer,
        ),
        ...createSurvivalChanges([actor, killer]),
      ],
    };
  },
};

const HIGH_BRAINS_MUTUAL_INTEREST: EventDefinition = {
  id: "bloodbath-flee-high-brains-mutual-interest",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.15,
  tags: ["survival", "truce", "cooperative"],
  participantShape: "pair",
  selectionProfile: statSelectionProfile(5, ["truce-requirement", "custom-eligibility"]),
  isEligible: ({ state, livingTributes }) =>
    canFormStandardTruce(2, state.tributes.filter((tribute) => tribute.isAlive).length) &&
    livingTributes.filter(
      (tribute) => isHighBrains(tribute) && !getActiveTruceForTribute(state, tribute.id),
    ).length >= 2,
  getWeightMultiplier: ({ state, round }) => getTruceFormationPopulationMultiplier(state, round),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: (tribute, { state }) =>
        isHighBrains(tribute) && !getActiveTruceForTribute(state, tribute.id),
    },
    {
      id: "target",
      count: 1,
      isEligible: (tribute, { state }) =>
        isHighBrains(tribute) && !getActiveTruceForTribute(state, tribute.id),
    },
  ],
  resolve({ eventId, round, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");

    return {
      text:
        `${actor.snapshot.name} and ${target.snapshot.name} flee the Cornucopia along the same route. ` +
        `Without slowing down, they exchange a few practical questions about supplies, skills, and sleeping habits before agreeing that cooperation is temporarily logical.`,
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

const HIGH_BRAINS_READ_THE_ROOM: EventDefinition = {
  id: "cornucopia-high-brains-read-the-room",
  category: "survival",
  periods: ["day"],
  baseWeight: 1.5,
  tags: ["survival", "item", "resource"],
  selectionProfile: statSelectionProfile(4, ["item-requirement"]),
  cornucopiaAcquisitionPolicy: {
    preserveAuthoredItems: true,
  },
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: (tribute) => isHighBrains(tribute) && hasUsableCornucopiaPackItem(tribute),
    },
  ],
  resolve({ eventId, round, random, participantsByRole }) {
    const actor = requireSingleParticipant(participantsByRole, "tribute");
    const pronouns = getTributePronouns(actor);
    const itemId = selectCornucopiaPackItem(actor, random);

    return {
      text:
        `${actor.snapshot.name} sprints toward the Cornucopia, takes one look at the larger tributes fighting over the weapons, and decides that bravery is just poor risk assessment. ` +
        `${pronouns.Subject} quickly grabs a small bag from the edge of the Cornucopia and takes off for the woods.`,
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

export const STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS = [
  HIGH_BRAINS_SHOPPING_LIST,
  HIGH_BRAINS_PRIORITIES,
  HIGH_BRAINS_READ_THE_ROOM,
  LOW_BRAINS_OOH_SHINY,
  LOW_BRAINS_POINTY_END,
  LOW_BRAWN_DRAGGING_LOOT,
  SMARTER_NOT_HARDER,
  HIGH_BRAWN_FIRST,
  HIGH_BRAWN_MORE_THAN_YOUR_SHARE,
  HIGH_BRAWN_BAG_OF_CHIPS,
  HIGH_BRAWN_EMERGENCY_EXIT,
] satisfies readonly EventDefinition[];

export const STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES = [
  {
    definition: HIGH_BRAINS_INVENTORY_MANAGEMENT,
    minImmediateEliminations: 0,
    maxImmediateEliminations: 1,
  },
  {
    definition: LOW_BRAINS_JUST_ONE_MORE_THING,
    minImmediateEliminations: 1,
    maxImmediateEliminations: 1,
  },
  {
    definition: LOW_BRAINS_NOT_A_BOX,
    minImmediateEliminations: 1,
    maxImmediateEliminations: 1,
  },
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
  HIGH_BRAINS_THINKING_OUTSIDE_THE_BOX,
  HIGH_BRAINS_CALCULATED_LOSS,
  HIGH_BRAWN_YOINK,
] satisfies readonly EventDefinition[];

export const STAT_GATED_CORNUCOPIA_NONFATAL_TRIO_EVENTS = [
  HIGH_BRAINS_LET_THEM_FIGHT,
] satisfies readonly EventDefinition[];

export const STAT_GATED_FLEE_EVENTS = [
  HIGH_BRAINS_NOT_MY_PROBLEM,
  HIGH_BRAINS_MUTUAL_INTEREST,
  LOW_BRAINS_FOLLOW_THAT_TRIBUTE,
  RUN_FASTER,
  HIGH_BRAWN_GENTLE_GIANT_FLEE,
] satisfies readonly EventDefinition[];

export const STAT_GATED_BLOODBATH_EVENTS = [
  ...STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
  ...STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES.map(({ definition }) => definition),
  ...STAT_GATED_CORNUCOPIA_NONFATAL_PAIR_EVENTS,
  ...STAT_GATED_CORNUCOPIA_NONFATAL_TRIO_EVENTS,
  ...STAT_GATED_FLEE_EVENTS,
] satisfies readonly EventDefinition[];
