import {
  createFatalChanges,
  createItemAcquisitionAndSurvivalChanges,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { getItemLabel } from "~/game/events/event-resolution-helpers";
import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";
import {
  hasUsableCornucopiaPackItem,
  selectCornucopiaPackItem,
} from "~/game/events/catalogue/bloodbath/cornucopia-item-pool";
import {
  chooseTextVariant,
  isHighBrains,
  isLowBrawn,
  statSelectionProfile,
} from "~/game/events/catalogue/stat-gated/stat-gated-helpers";
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

export const STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS = [
  LOW_BRAWN_DRAGGING_LOOT,
  SMARTER_NOT_HARDER,
] satisfies readonly EventDefinition[];

export const STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES = [
  {
    definition: SHOOTING_FISH_IN_A_BARREL,
    minImmediateEliminations: 1,
    maxImmediateEliminations: 1,
  },
] satisfies readonly CornucopiaFatalTargetProfile[];

export const STAT_GATED_FLEE_EVENTS = [RUN_FASTER] satisfies readonly EventDefinition[];

export const STAT_GATED_BLOODBATH_EVENTS = [
  ...STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
  ...STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES.map(({ definition }) => definition),
  ...STAT_GATED_FLEE_EVENTS,
] satisfies readonly EventDefinition[];
