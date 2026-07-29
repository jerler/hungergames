import { getEffectiveStats } from "~/game/engine/effective-stats";
import { getNextRound } from "~/game/engine/rounds";
import { resolveScoreCheck, type StatCheckOutcome } from "~/game/events/event-outcomes";
import {
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { clampStatCheckDifficulty, getItemLabel } from "~/game/events/event-resolution-helpers";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import {
  selectCornucopiaContestedDirectWeapon,
  selectCornucopiaPackItem,
} from "~/game/events/catalogue/bloodbath/cornucopia-item-pool";
import {
  ADDITIONAL_CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
  ADDITIONAL_CORNUCOPIA_NONFATAL_TRIO_EVENTS,
} from "~/game/events/catalogue/bloodbath/cornucopia-group-variety-events";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameChange, GameTribute } from "~/game/types/game-state";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { RandomSource } from "~/game/engine/random";

function resolveOpposedBrawnCheck(
  actor: GameTribute,
  target: GameTribute,
  random: RandomSource,
): StatCheckOutcome {
  const actorStats = getEffectiveStats(actor);
  const targetStats = getEffectiveStats(target);

  const actorScore = actorStats.brawn + (actorStats.luck - 3) * 0.25;
  const targetDifficulty = clampStatCheckDifficulty(
    targetStats.brawn + (targetStats.luck - 3) * 0.25,
  );

  return resolveScoreCheck({
    score: actorScore,
    difficulty: targetDifficulty,
    random,
  });
}

function createFoodSatisfactionChange(tribute: GameTribute): GameChange {
  return {
    type: "satisfy-survival-need",
    tributeId: tribute.id,
    need: "food",
  };
}

function createHostilePairRoles(): EventDefinition["roles"] {
  return [
    {
      id: "actor",
      count: 1,
      opposesRoleIds: ["target"],
    },
    {
      id: "target",
      count: 1,
      targeting: "hostile",
      opposesRoleIds: ["actor"],
    },
  ];
}

const SUPPLY_BAG_CONTEST_EVENT: EventDefinition = {
  id: "cornucopia-nonfatal-supply-bag-contest",
  category: "hazard",
  tags: ["hazard", "combat", "item", "resource"],
  periods: ["day"],
  baseWeight: 5,
  roles: createHostilePairRoles(),
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const outcome = resolveOpposedBrawnCheck(actor, target, random);

    switch (outcome) {
      case "critical-failure": {
        const itemId = selectCornucopiaPackItem(target, random);

        return {
          text:
            `${actor.snapshot.name} and ${target.snapshot.name} both run for the same ` +
            `supply bag. ${actor.snapshot.name} refuses to let go until ` +
            `${target.snapshot.name} kicks ${actorPronouns.object} in the stomach and ` +
            `sends ${actorPronouns.object} sprawling. ${actor.snapshot.name} retreats ` +
            "empty-handed.",
          changes: [
            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              target,
              [itemId],
              round,
              "cornucopia",
            ),
            createStatusChange(eventId, actor, "injured", 2, round),
            ...createSurvivalChanges([actor]),
          ],
        };
      }

      case "failure": {
        const itemId = selectCornucopiaPackItem(target, random);

        return {
          text:
            `${actor.snapshot.name} and ${target.snapshot.name} wrench a supply bag ` +
            `back and forth until ${target.snapshot.name} screams, banshee-style, ` +
            `causing ${actor.snapshot.name} to piss ${actorPronouns.reflexive} and flee ` +
            "empty-handed.",
          changes: [
            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              target,
              [itemId],
              round,
              "cornucopia",
            ),
            ...createSurvivalChanges([actor]),
          ],
        };
      }

      case "success": {
        const itemId = selectCornucopiaPackItem(actor, random);

        return {
          text:
            `${actor.snapshot.name} runs up on ${target.snapshot.name}, pantses ` +
            `${target.snapshot.name}, and escapes with the supply bag in the confusion.`,
          changes: [
            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              actor,
              [itemId],
              round,
              "cornucopia",
            ),
            ...createSurvivalChanges([target]),
          ],
        };
      }

      case "exceptional-success": {
        const itemId = selectCornucopiaPackItem(actor, random);
        return {
          text:
            `${actor.snapshot.name} and ${target.snapshot.name} run for the same supply ` +
            `bag. ${target.snapshot.name} gets there first, but ${actor.snapshot.name} ` +
            `wraps ${actorPronouns.possessiveAdjective} arms around ` +
            `${target.snapshot.name}'s waist, suplexes ${targetPronouns.object}, and steals ` +
            "the bag, " +
            `retreating with ${getItemLabel(itemId)} inside.`,
          changes: [
            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              actor,
              [itemId],
              round,
              "cornucopia",
            ),
            createStatusChange(eventId, target, "injured", 2, round),
            ...createSurvivalChanges([target]),
          ],
        };
      }
    }
  },
};

const WEAPON_TUG_OF_WAR_EVENT: EventDefinition = {
  id: "cornucopia-nonfatal-weapon-tug-of-war",
  category: "hazard",
  tags: ["hazard", "combat", "weapon", "item"],
  periods: ["day"],
  baseWeight: 5,
  roles: createHostilePairRoles(),
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetPronouns = getTributePronouns(target);
    const outcome = resolveOpposedBrawnCheck(actor, target, random);

    switch (outcome) {
      case "critical-failure": {
        const itemId = selectCornucopiaContestedDirectWeapon(target, random);
        const weaponLabel = getItemLabel(itemId);

        return {
          text:
            `${actor.snapshot.name} grabs for the ${weaponLabel}, but ` +
            `${target.snapshot.name} leaps onto ${actorPronouns.possessiveAdjective} back ` +
            `and tries to bite ${actorPronouns.possessiveAdjective} ear off. In the pain, ` +
            `${target.snapshot.name} wrenches the ${weaponLabel} out of reach.`,
          changes: [
            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              target,
              [itemId],
              round,
              "cornucopia",
            ),
            createStatusChange(eventId, actor, "injured", 2, round),
            ...createSurvivalChanges([actor]),
          ],
        };
      }

      case "failure": {
        const itemId = selectCornucopiaContestedDirectWeapon(target, random);
        const weaponLabel = getItemLabel(itemId);

        return {
          text:
            `${actor.snapshot.name} catches hold of the ${weaponLabel}, but ` +
            `${target.snapshot.name} refuses to release it. ${actor.snapshot.name} gets ` +
            "scared and gives up before the struggle turns fatal.",
          changes: [
            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              target,
              [itemId],
              round,
              "cornucopia",
            ),
            ...createSurvivalChanges([actor]),
          ],
        };
      }

      case "success": {
        const itemId = selectCornucopiaContestedDirectWeapon(actor, random);
        const weaponLabel = getItemLabel(itemId);

        return {
          text:
            `${actor.snapshot.name} spots ${target.snapshot.name} holding a deadly-looking ` +
            `${weaponLabel}. ${actor.snapshot.name} tackles ${target.snapshot.name} and ` +
            `grabs the ${weaponLabel} before ${targetPronouns.subject} can take it back.`,
          changes: [
            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              actor,
              [itemId],
              round,
              "cornucopia",
            ),
            ...createSurvivalChanges([target]),
          ],
        };
      }

      case "exceptional-success": {
        const itemId = selectCornucopiaContestedDirectWeapon(actor, random);
        const weaponLabel = getItemLabel(itemId);

        return {
          text:
            `${actor.snapshot.name} sprints toward the Cornucopia hoping to find a ` +
            `${weaponLabel}, only to see ${target.snapshot.name} already holding one. ` +
            `${actor.snapshot.name} charges forward, grabs the ${weaponLabel}, and spins ` +
            `${target.snapshot.name} around, sending ${targetPronouns.object} flying ` +
            "empty-handed into the distant woods.",
          changes: [
            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              actor,
              [itemId],
              round,
              "cornucopia",
            ),
            ...createSurvivalChanges([target]),
          ],
        };
      }
    }
  },
};

const BREADSTICK_CONTEST_EVENT: EventDefinition = {
  id: "cornucopia-nonfatal-breadstick-contest",
  category: "hazard",
  tags: ["hazard", "combat", "resource"],
  periods: ["day"],
  baseWeight: 3.5,
  roles: createHostilePairRoles(),
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const outcome = resolveOpposedBrawnCheck(actor, target, random);

    switch (outcome) {
      case "critical-failure":
        return {
          text:
            `${actor.snapshot.name} lunges for a box of East Side Mario's breadsticks, ` +
            `but ${target.snapshot.name} drives ${actorPronouns.object} backward and ` +
            "escapes with it. Mamma mia.",
          changes: [
            createFoodSatisfactionChange(target),
            createStatusChange(eventId, actor, "injured", 2, round),
            ...createSurvivalChanges([actor, target]),
          ],
        };

      case "failure":
        return {
          text:
            `${actor.snapshot.name} and ${target.snapshot.name} grapple over a box of ` +
            `East Side Mario's breadsticks until ${actor.snapshot.name} decides ` +
            `${actorPronouns.subject} ${actorPronouns.bePresent} too gluten-sensitive ` +
            "anyway and retreats.",
          changes: [
            createFoodSatisfactionChange(target),
            ...createSurvivalChanges([actor, target]),
          ],
        };

      case "success":
        return {
          text:
            `${actor.snapshot.name} breaks ${target.snapshot.name}'s nose over a box of ` +
            "East Side Mario's breadsticks and escapes with the food.",
          changes: [
            createFoodSatisfactionChange(actor),
            createStatusChange(eventId, target, "injured", 2, round),
            ...createSurvivalChanges([actor, target]),
          ],
        };

      case "exceptional-success":
        return {
          text:
            `${actor.snapshot.name} uses a metal chair to flatten ` +
            `${target.snapshot.name} to the ground, steals the box of East Side Mario's ` +
            "breadsticks, and eats while retreating from the Cornucopia.",
          changes: [
            createFoodSatisfactionChange(actor),
            createStatusChange(eventId, actor, "well-fed", 1, round),
            createStatusChange(eventId, target, "injured", 2, round),
            ...createSurvivalChanges([actor, target]),
          ],
        };
    }
  },
};

const SCARE_AWAY_EVENT: EventDefinition = {
  id: "cornucopia-nonfatal-scare-away",
  category: "hazard",
  tags: ["hazard", "combat", "resource"],
  periods: ["day"],
  baseWeight: 4,
  roles: createHostilePairRoles(),
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const outcome = resolveOpposedBrawnCheck(actor, target, random);

    switch (outcome) {
      case "critical-failure":
        return {
          text:
            `${actor.snapshot.name} tries to intimidate ${target.snapshot.name}, who ` +
            "steps closer and asks whether that was supposed to be frightening.",
          changes: createSurvivalChanges([actor, target]),
        };

      case "failure":
        return {
          text:
            `${actor.snapshot.name} and ${target.snapshot.name} both run for the same ` +
            `supply box. ${actor.snapshot.name} tries to threaten ` +
            `${target.snapshot.name} into leaving, but neither tribute moves. They stare ` +
            "at each other while the supplies are pilfered around them.",
          changes: createSurvivalChanges([actor, target]),
        };

      case "success":
        return {
          text:
            `${actor.snapshot.name} Naruto-runs directly at ${target.snapshot.name} while ` +
            `screaming, banshee-style. ${target.snapshot.name} abandons the Cornucopia ` +
            "and runs.",
          changes: createSurvivalChanges([actor, target]),
        };

      case "exceptional-success": {
        const itemId = selectCornucopiaPackItem(actor, random);

        return {
          text:
            `${actor.snapshot.name} Naruto-runs directly at ${target.snapshot.name} while ` +
            `screaming, banshee-style. ${target.snapshot.name} drops the supplies and ` +
            "runs into the woods.",
          changes: [
            ...createItemAcquisitionAndSurvivalChanges(
              eventId,
              actor,
              [itemId],
              round,
              "cornucopia",
            ),
            ...createSurvivalChanges([target]),
          ],
        };
      }
    }
  },
};

const SPLIT_FISHING_SUPPLIES_EVENT: EventDefinition = {
  id: "cornucopia-nonfatal-split-fishing-supplies",
  category: "survival",
  tags: ["survival", "item", "resource", "cooperative"],
  periods: ["day"],
  baseWeight: 2.5,
  roles: [
    {
      id: "actor",
      count: 1,
    },
    {
      id: "target",
      count: 1,
    },
  ],
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const actor = requireSingleParticipant(participantsByRole, "actor");
    const target = requireSingleParticipant(participantsByRole, "target");
    const actorPronouns = getTributePronouns(actor);
    const targetItemId = selectCornucopiaPackItem(target, random);

    return {
      text:
        `${actor.snapshot.name} remembers long summer days spent fishing with ` +
        `${actorPronouns.possessiveAdjective} papa and reaches for the fishing gear. At ` +
        `the same time, ${target.snapshot.name} tears free the supply pack beneath it, ` +
        "sending both prizes flying. Each tribute grabs one and runs.",
      changes: [
        ...createItemAcquisitionAndSurvivalChanges(
          eventId,
          actor,
          ["fishing-gear"],
          round,
          "cornucopia",
        ),
        ...createItemAcquisitionAndSurvivalChanges(
          eventId,
          target,
          [targetItemId],
          round,
          "cornucopia",
        ),
      ],
    };
  },
};

const THREE_PERSON_SUPPLY_TEAM_EVENT: EventDefinition = {
  id: "cornucopia-nonfatal-three-person-supply-team",
  category: "survival",
  tags: ["survival", "item", "resource", "truce", "cooperative"],
  periods: ["day"],
  baseWeight: 4,
  roles: [
    {
      id: "tributes",
      count: 3,
    },
  ],
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const tributes = requireParticipants(participantsByRole, "tributes");

    if (tributes.length !== 3) {
      throw new Error("Three-person supply team requires exactly three tributes.");
    }

    const [actor, ally, target] = tributes;

    if (!actor || !ally || !target) {
      throw new Error("Three-person supply team lost a participant.");
    }

    const truce = createTruceInstance(
      eventId,
      tributes.map((tribute) => tribute.id),
      round,
      getNextRound(round),
    );

    return {
      text:
        `${actor.snapshot.name}, ${ally.snapshot.name}, and ${target.snapshot.name} all ` +
        `reach for the same backpack. ${actor.snapshot.name} tells a quick joke to break ` +
        "the tension, and they stock up on supplies before fleeing together.",
      changes: [
        {
          type: "form-truce",
          truce,
        },
        ...tributes.flatMap((tribute) =>
          createItemAcquisitionAndSurvivalChanges(
            eventId,
            tribute,
            [selectCornucopiaPackItem(tribute, random)],
            round,
            "cornucopia",
          ),
        ),
      ],
    };
  },
};

const FOUR_PERSON_SHARED_HAUL_EVENT: EventDefinition = {
  id: "cornucopia-nonfatal-four-person-shared-haul",
  category: "survival",
  tags: ["survival", "item", "resource", "truce", "cooperative"],
  periods: ["day"],
  baseWeight: 3,
  roles: [
    {
      id: "tributes",
      count: 4,
    },
  ],
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const tributes = requireParticipants(participantsByRole, "tributes");

    if (tributes.length !== 4) {
      throw new Error("Shared Cornucopia haul requires exactly four tributes.");
    }

    const [actor, ally, target, bystander] = tributes;

    if (!actor || !ally || !target || !bystander) {
      throw new Error("Shared Cornucopia haul lost a participant.");
    }

    const truce = createTruceInstance(
      eventId,
      tributes.map((tribute) => tribute.id),
      round,
      getNextRound(round),
    );

    return {
      text:
        `${actor.snapshot.name}, ${ally.snapshot.name}, ${target.snapshot.name}, and ` +
        `${bystander.snapshot.name} all try hiding inside the Cornucopia. They find one ` +
        "another swimming through the boxes, split the useful supplies as evenly as " +
        "possible, and run before the other tributes find them.",
      changes: [
        {
          type: "form-truce",
          truce,
        },
        ...tributes.flatMap((tribute) =>
          createItemAcquisitionAndSurvivalChanges(
            eventId,
            tribute,
            [selectCornucopiaPackItem(tribute, random)],
            round,
            "cornucopia",
          ),
        ),
      ],
    };
  },
};

export const CORNUCOPIA_NONFATAL_PAIR_EVENTS = [
  SUPPLY_BAG_CONTEST_EVENT,
  WEAPON_TUG_OF_WAR_EVENT,
  BREADSTICK_CONTEST_EVENT,
  SCARE_AWAY_EVENT,
  SPLIT_FISHING_SUPPLIES_EVENT,
] satisfies readonly EventDefinition[];

export const CORNUCOPIA_NONFATAL_TRIO_EVENTS = [
  THREE_PERSON_SUPPLY_TEAM_EVENT,
  ...ADDITIONAL_CORNUCOPIA_NONFATAL_TRIO_EVENTS,
] satisfies readonly EventDefinition[];

export const CORNUCOPIA_NONFATAL_QUARTET_EVENTS = [
  FOUR_PERSON_SHARED_HAUL_EVENT,
  ...ADDITIONAL_CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
] satisfies readonly EventDefinition[];

export const CORNUCOPIA_NONFATAL_INTERACTION_EVENTS = [
  ...CORNUCOPIA_NONFATAL_PAIR_EVENTS,
  ...CORNUCOPIA_NONFATAL_TRIO_EVENTS,
  ...CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
] as const;
