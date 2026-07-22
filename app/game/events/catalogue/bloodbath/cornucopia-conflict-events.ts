import { selectRandomItem, selectWeightedItem, type RandomSource } from "~/game/engine/random";
import { getCombatScore } from "~/game/engine/stat-formulas";
import {
  createFatalChanges,
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { GameTribute } from "~/game/types/game-state";
import { getTributePronouns } from "~/game/tributes/pronouns";

const CONTESTED_WEAPON_ITEM_IDS = [
  "knife",
  "slingshot",
  "spear",
  "axe",
  "bow",
] satisfies readonly ItemDefinitionId[];

const CONTESTED_PACK_ITEM_IDS = [
  "medicine",
  "blanket",
  "matches",
  "rope",
  "map",
  "camouflage-net",
  "fishing-gear",
  "trap-kit",
  "shield",
] satisfies readonly ItemDefinitionId[];

type PairConflictOutcome = "attacker-dies" | "both-retreat" | "attacker-wins" | "defender-dies";

const PAIR_CONFLICT_OUTCOMES = [
  "attacker-dies",
  "both-retreat",
  "attacker-wins",
  "defender-dies",
] satisfies readonly PairConflictOutcome[];

type GroupConflictOutcome =
  "mutual-destruction" | "sole-survivor" | "single-casualty" | "all-retreat";

const GROUP_CONFLICT_OUTCOMES = [
  "mutual-destruction",
  "sole-survivor",
  "single-casualty",
  "all-retreat",
] satisfies readonly GroupConflictOutcome[];

const GROUP_CONFLICT_OUTCOME_WEIGHTS = {
  /*
   * These weights intentionally make central Bloodbath
   * clashes much more lethal than ordinary events.
   *
   * The sequencer reduces exposure to these events after
   * approaching its soft fatality target.
   */
  "mutual-destruction": 2,
  "sole-survivor": 7.5,
  "single-casualty": 0.4,
  "all-retreat": 0.1,
} satisfies Record<GroupConflictOutcome, number>;

interface ConflictDefinitionOptions {
  id: string;
  baseWeight: number;
  itemIds: readonly ItemDefinitionId[];
  resourceDescription: string;
}

function getContestWeight(tribute: GameTribute): number {
  const combatScore = getCombatScore(tribute);

  /*
   * Squaring the score makes strong combatants clearly
   * advantaged without ever assigning a zero weight to
   * weaker tributes.
   */
  return Math.max(0.25, combatScore * combatScore);
}

function getVulnerabilityWeight(tribute: GameTribute): number {
  return 1 / getContestWeight(tribute);
}

function selectContestWinner(tributes: readonly GameTribute[], random: RandomSource): GameTribute {
  return selectWeightedItem(tributes, getContestWeight, random);
}

function selectVulnerableTribute(
  tributes: readonly GameTribute[],
  random: RandomSource,
): GameTribute {
  return selectWeightedItem(tributes, getVulnerabilityWeight, random);
}

function resolvePairConflictOutcome(
  attacker: GameTribute,
  defender: GameTribute,
  random: RandomSource,
): PairConflictOutcome {
  const attackerWeight = getContestWeight(attacker);

  const defenderWeight = getContestWeight(defender);

  const totalWeight = attackerWeight + defenderWeight;

  const attackerShare = attackerWeight / totalWeight;

  const defenderShare = defenderWeight / totalWeight;

  return selectWeightedItem(
    PAIR_CONFLICT_OUTCOMES,

    (outcome) => {
      switch (outcome) {
        case "attacker-dies":
          return defenderShare * 8;

        case "both-retreat":
          return 0.6;

        case "attacker-wins":
          return attackerShare * 0.8;

        case "defender-dies":
          return attackerShare * 8;
      }
    },

    random,
  );
}

function resolveGroupConflictOutcome(random: RandomSource): GroupConflictOutcome {
  return selectWeightedItem(
    GROUP_CONFLICT_OUTCOMES,

    (outcome) => GROUP_CONFLICT_OUTCOME_WEIGHTS[outcome],

    random,
  );
}

function createPairConflictEvent({
  id,
  baseWeight,
  itemIds,
  resourceDescription,
}: ConflictDefinitionOptions): EventDefinition {
  return {
    id,
    category: "fatal",

    tags: ["fatal", "combat", "item", "resource"],

    periods: ["day"],
    baseWeight,

    roles: [
      {
        id: "attacker",
        count: 1,
        opposesRoleIds: ["defender"],
      },
      {
        id: "defender",
        count: 1,
        opposesRoleIds: ["attacker"],
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const attacker = requireSingleParticipant(participantsByRole, "attacker");
      const attackerPronouns = getTributePronouns(attacker);

      const defender = requireSingleParticipant(participantsByRole, "defender");

      const outcome = resolvePairConflictOutcome(attacker, defender, random);

      switch (outcome) {
        case "attacker-dies": {
          const itemId = selectRandomItem(itemIds, random);

          const text =
            `${attacker.snapshot.name} attacks ` +
            `${defender.snapshot.name} over ` +
            `${resourceDescription}, but ` +
            `${defender.snapshot.name} turns the attack ` +
            `against ${attackerPronouns.object} and kills ${attackerPronouns.object}.`;

          return {
            text,

            changes: [
              ...createFatalChanges(attacker, id, "Killed at the Cornucopia", text, defender),

              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                defender,
                [itemId],
                round,
                "cornucopia",
              ),
            ],
          };
        }

        case "both-retreat":
          return {
            text:
              `${attacker.snapshot.name} and ` +
              `${defender.snapshot.name} clash over ` +
              `${resourceDescription}, but both are ` +
              "injured in the struggle and retreat without it.",

            changes: [
              createStatusChange(eventId, attacker, "injured", 1, round),

              createStatusChange(eventId, defender, "injured", 1, round),

              ...createSurvivalChanges([attacker, defender]),
            ],
          };

        case "attacker-wins": {
          const itemId = selectRandomItem(itemIds, random);

          return {
            text:
              `${attacker.snapshot.name} drives ` +
              `${defender.snapshot.name} away from ` +
              `${resourceDescription} and escapes with it.`,

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                attacker,
                [itemId],
                round,
                "cornucopia",
              ),

              createStatusChange(eventId, defender, "exhausted", 1, round),

              ...createSurvivalChanges([defender]),
            ],
          };
        }

        case "defender-dies": {
          const itemId = selectRandomItem(itemIds, random);

          const text =
            `${attacker.snapshot.name} kills ` +
            `${defender.snapshot.name} in a fight over ` +
            `${resourceDescription} and claims it.`;

          return {
            text,

            changes: [
              ...createFatalChanges(defender, id, "Killed at the Cornucopia", text, attacker),

              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                attacker,
                [itemId],
                round,
                "cornucopia",
              ),
            ],
          };
        }
      }
    },
  };
}

function createGroupConflictEvent({
  id,
  baseWeight,
  itemIds,
  resourceDescription,
}: ConflictDefinitionOptions): EventDefinition {
  return {
    id,
    category: "fatal",

    tags: ["fatal", "combat", "item", "resource"],

    periods: ["day"],
    baseWeight,

    roles: [
      {
        id: "contenders",
        count: 3,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const contenders = requireParticipants(participantsByRole, "contenders");

      if (contenders.length !== 3) {
        throw new Error(`Event "${id}" requires exactly three contenders.`);
      }

      const outcome = resolveGroupConflictOutcome(random);

      switch (outcome) {
        case "mutual-destruction": {
          const names = contenders.map((tribute) => tribute.snapshot.name).join(", ");

          const text =
            `${names} become trapped in a frenzied ` +
            `struggle over ${resourceDescription}. ` +
            "By the time the fighting stops, all three are dead.";

          return {
            text,

            /*
             * The fiction describes an indistinguishable mutual
             * melee, so no single tribute receives kill credit.
             */
            changes: contenders.flatMap((tribute) =>
              createFatalChanges(tribute, id, "Killed in a mutual Cornucopia melee", text),
            ),
          };
        }

        case "sole-survivor": {
          const winner = selectContestWinner(contenders, random);

          const victims = contenders.filter((tribute) => tribute.id !== winner.id);

          const itemId = selectRandomItem(itemIds, random);

          const text =
            `${winner.snapshot.name} survives a brutal ` +
            `three-way fight over ${resourceDescription}, ` +
            `killing ${victims[0].snapshot.name} and ` +
            `${victims[1].snapshot.name} before escaping.`;

          return {
            text,

            changes: [
              ...victims.flatMap((victim) =>
                createFatalChanges(victim, id, "Killed at the Cornucopia", text, winner),
              ),

              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                winner,
                [itemId],
                round,
                "cornucopia",
              ),
            ],
          };
        }

        case "single-casualty": {
          const winner = selectContestWinner(contenders, random);

          const otherContenders = contenders.filter((tribute) => tribute.id !== winner.id);

          const victim = selectVulnerableTribute(otherContenders, random);

          const escapee = otherContenders.find((tribute) => tribute.id !== victim.id);

          if (!escapee) {
            throw new Error(`Event "${id}" could not resolve its escaping contender.`);
          }

          const itemId = selectRandomItem(itemIds, random);

          const escapeStatus = random() < 0.5 ? "injured" : "exhausted";

          const text =
            `${winner.snapshot.name} kills ` +
            `${victim.snapshot.name} over ` +
            `${resourceDescription}. ` +
            `${escapee.snapshot.name} escapes ` +
            `${escapeStatus}, while ` +
            `${winner.snapshot.name} claims the supplies.`;

          return {
            text,

            changes: [
              ...createFatalChanges(victim, id, "Killed at the Cornucopia", text, winner),

              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                winner,
                [itemId],
                round,
                "cornucopia",
              ),

              createStatusChange(eventId, escapee, escapeStatus, 1, round),

              ...createSurvivalChanges([escapee]),
            ],
          };
        }

        case "all-retreat":
          return {
            text:
              `${contenders[0].snapshot.name}, ` +
              `${contenders[1].snapshot.name}, and ` +
              `${contenders[2].snapshot.name} collide at ` +
              `the entrance while fighting over ` +
              `${resourceDescription}. All three retreat ` +
              "empty-handed before the struggle becomes fatal.",

            changes: [
              ...contenders.map((tribute) =>
                createStatusChange(eventId, tribute, "exhausted", 1, round),
              ),

              ...createSurvivalChanges(contenders),
            ],
          };
      }
    },
  };
}

export const CORNUCOPIA_PAIR_CONFLICT_EVENTS = [
  createPairConflictEvent({
    id: "cornucopia-contested-weapon",
    baseWeight: 6,
    itemIds: CONTESTED_WEAPON_ITEM_IDS,
    resourceDescription: "the same weapon",
  }),

  createPairConflictEvent({
    id: "cornucopia-pack-ambush",
    baseWeight: 5,
    itemIds: CONTESTED_PACK_ITEM_IDS,
    resourceDescription: "an unopened supply pack",
  }),
] satisfies readonly EventDefinition[];

export const CORNUCOPIA_GROUP_CONFLICT_EVENTS = [
  createGroupConflictEvent({
    id: "cornucopia-three-way-weapon-melee",
    baseWeight: 7,
    itemIds: CONTESTED_WEAPON_ITEM_IDS,
    resourceDescription: "a pile of weapons",
  }),

  createGroupConflictEvent({
    id: "cornucopia-entrance-collision",
    baseWeight: 6,
    itemIds: CONTESTED_PACK_ITEM_IDS,
    resourceDescription: "a collection of supply packs",
  }),
] satisfies readonly EventDefinition[];

export const CORNUCOPIA_CONFLICT_EVENTS = [
  ...CORNUCOPIA_PAIR_CONFLICT_EVENTS,
  ...CORNUCOPIA_GROUP_CONFLICT_EVENTS,
] as const;
