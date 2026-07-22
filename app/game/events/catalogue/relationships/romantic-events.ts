import { resolveStatCheck } from "~/game/events/event-outcomes";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import { createStatusChange, createSurvivalChanges } from "~/game/events/event-change-builders";
import {
  createTruceInstance,
  getActiveTruceForTribute,
  getTruceFormationPopulationMultiplier,
} from "~/game/truces/truce-engine";
import { getAverageDistrictAffinityWeight } from "~/game/truces/truce-selection";
import type { GameState } from "~/game/types/game-state";
import { createJointVictoryOutcome } from "~/game/victory/victory-outcome";
import { getTributePronouns } from "~/game/tributes/pronouns";

const ROMANTIC_FORMATION_WEIGHT = 0.2;

function belongsToRomanticTruce(
  state: EventResolutionContext["state"],
  tributeId: string,
): boolean {
  return getActiveTruceForTribute(state, tributeId)?.kind === "romantic";
}

export function isPoisonousBerriesFinaleEligible(state: GameState): boolean {
  const livingTributes = state.tributes.filter((tribute) => tribute.isAlive);

  if (livingTributes.length !== 2) {
    return false;
  }

  const [firstTribute, secondTribute] = livingTributes;

  if (!firstTribute || !secondTribute) {
    return false;
  }

  const truce = getActiveTruceForTribute(state, firstTribute.id);

  return (
    truce?.kind === "romantic" &&
    truce.tributeIds.length === 2 &&
    truce.tributeIds.includes(secondTribute.id)
  );
}

const ROMANTIC_FORMATION_EVENT: EventDefinition = {
  id: "romantic-truce-formation",
  category: "survival",

  tags: ["survival", "truce", "cooperative", "romantic"],

  periods: ["day", "night"],

  /*
   * Standard formation contributes about
   * seven points of weight per period.
   * At 0.2, romantic formation represents
   * only a small share of new truces.
   */
  baseWeight: ROMANTIC_FORMATION_WEIGHT,

  roles: [
    {
      id: "tributes",
      count: 2,

      isEligible: (tribute, { state }) => !getActiveTruceForTribute(state, tribute.id),

      getWeight: (tribute, { participantsByRole }) =>
        getAverageDistrictAffinityWeight(tribute, participantsByRole.tributes ?? []),
    },
  ],

  isEligible: ({ state, livingTributes }) => {
    /*
     * Do not allow a last-minute romance
     * to form when only the finalists remain.
     */
    if (livingTributes.length <= 3) {
      return false;
    }

    const availableTributes = livingTributes.filter(
      (tribute) => !getActiveTruceForTribute(state, tribute.id),
    );

    return availableTributes.length >= 2;
  },

  getWeightMultiplier: ({ state }) => getTruceFormationPopulationMultiplier(state),

  resolve({ eventId, round, participantsByRole }): EventResolution {
    const [firstTribute, secondTribute] = requireParticipants(participantsByRole, "tributes");

    if (!firstTribute || !secondTribute) {
      throw new Error("Romantic formation requires exactly two tributes.");
    }

    const truce = createTruceInstance(
      eventId,
      [firstTribute.id, secondTribute.id],
      round,
      null,
      "romantic",
    );

    return {
      text:
        `${firstTribute.snapshot.name} and ` +
        `${secondTribute.snapshot.name} find comfort in one another ` +
        "and promise to remain together, no matter what the arena demands.",

      changes: [
        {
          type: "form-truce",
          truce,
        },

        createStatusChange(eventId, firstTribute, "inspired", 1, round),
        createStatusChange(eventId, secondTribute, "inspired", 1, round),

        ...createSurvivalChanges([firstTribute, secondTribute]),
      ],
    };
  },
};

const ROMANTIC_PROTECTION_EVENT: EventDefinition = {
  id: "romantic-partner-protection",
  category: "hazard",

  tags: ["hazard", "truce", "cooperative", "romantic", "status"],

  periods: ["day", "night"],
  baseWeight: 2.5,

  roles: [
    {
      id: "protector",
      count: 1,

      isEligible: (tribute, { state }) => belongsToRomanticTruce(state, tribute.id),

      getWeight: (tribute) => Math.max(tribute.snapshot.stats.brawn, tribute.snapshot.stats.brains),
    },
    {
      id: "partner",
      count: 1,

      isEligible: (tribute, { state, participantsByRole }) => {
        const protector = participantsByRole.protector?.[0];

        if (!protector) {
          return false;
        }

        const truce = getActiveTruceForTribute(state, protector.id);

        return truce?.kind === "romantic" && truce.tributeIds.includes(tribute.id);
      },
    },
  ],

  isEligible: ({ state }) => state.truces.some((truce) => truce.kind === "romantic"),

  resolve({ state, eventId, round, random, participantsByRole }): EventResolution {
    const protector = requireSingleParticipant(participantsByRole, "protector");
    const partner = requireSingleParticipant(participantsByRole, "partner");
    const protectorPronouns = getTributePronouns(protector);
    const partnerPronouns = getTributePronouns(partner);
    const truce = getActiveTruceForTribute(state, protector.id);

    if (truce?.kind !== "romantic" || !truce.tributeIds.includes(partner.id)) {
      throw new Error("Romantic protection selected tributes who are not romantic partners.");
    }

    const protectiveStat =
      protector.snapshot.stats.brawn >= protector.snapshot.stats.brains ? "brawn" : "brains";

    const outcome = resolveStatCheck({
      stats: protector.snapshot.stats,
      stat: protectiveStat,
      difficulty: 3,
      random,
    });

    switch (outcome) {
      case "critical-failure": {
        const text =
          `${protector.snapshot.name} throws ` +
          `${protectorPronouns.reflexive} between ` +
          `${partner.snapshot.name} and an arena threat. ` +
          `${partner.snapshot.name} survives, but ` +
          `${protector.snapshot.name} is killed.`;

        return {
          text,

          /*
           * Do not break the truce explicitly.
           * The accidental-dissolution engine
           * will create the emotional aftermath.
           */
          changes: [
            {
              type: "eliminate-tribute",
              tributeId: protector.id,
              causeId: "protecting-romantic-partner",
              causeLabel: `Died protecting ` + `${protectorPronouns.possessiveAdjective} partner`,
              summary: text,
              killerTributeIds: [],
            },

            ...createSurvivalChanges([partner]),
          ],
        };
      }

      case "failure":
        return {
          text:
            `${protector.snapshot.name} shields ` +
            `${partner.snapshot.name} from an arena threat ` +
            `and is badly injured protecting ${partnerPronouns.object}.`,

          changes: [
            createStatusChange(eventId, protector, "injured", 2, round),
            createStatusChange(eventId, partner, "inspired", 1, round),

            ...createSurvivalChanges([partner]),
          ],
        };

      case "success":
        return {
          text:
            `${protector.snapshot.name} reaches ` +
            `${partner.snapshot.name} in time, and the pair escape together.`,

          changes: createSurvivalChanges([protector, partner]),
        };

      case "exceptional-success":
        return {
          text:
            `${protector.snapshot.name} refuses to abandon ` +
            `${partner.snapshot.name}. Together, they overcome the threat ` +
            "and emerge more determined than ever to survive.",

          changes: [
            createStatusChange(eventId, protector, "inspired", 2, round),
            createStatusChange(eventId, partner, "inspired", 2, round),

            ...createSurvivalChanges([protector, partner]),
          ],
        };
    }
  },
};

export const POISONOUS_BERRIES_JOINT_VICTORY_EVENT: EventDefinition = {
  id: "poisonous-berries-joint-victory",
  category: "survival",

  tags: ["survival", "truce", "cooperative", "romantic", "victory"],

  periods: ["day", "night"],

  /*
   * The sequencer forces this event when
   * eligible, so its ordinary weight is
   * not used to determine the finale.
   */
  baseWeight: 1,

  roles: [
    {
      id: "partners",
      count: 2,

      isEligible: (tribute, { state }) => {
        if (!isPoisonousBerriesFinaleEligible(state)) {
          return false;
        }

        return getActiveTruceForTribute(state, tribute.id)?.kind === "romantic";
      },
    },
  ],

  isEligible: ({ state }) => isPoisonousBerriesFinaleEligible(state),

  resolve({ state, eventId, participantsByRole }): EventResolution {
    const partners = requireParticipants(participantsByRole, "partners");

    if (partners.length !== 2) {
      throw new Error("The poisonous-berries finale requires exactly two partners.");
    }

    const [firstPartner, secondPartner] = partners;

    if (!firstPartner || !secondPartner) {
      throw new Error("The poisonous-berries finale could not resolve both partners.");
    }

    const truce = getActiveTruceForTribute(state, firstPartner.id);

    if (truce?.kind !== "romantic" || !truce.tributeIds.includes(secondPartner.id)) {
      throw new Error("The poisonous-berries finale requires an active romantic pair.");
    }

    const text =
      `${firstPartner.snapshot.name} and ` +
      `${secondPartner.snapshot.name} refuse to turn on one another. ` +
      "They raise poisonous berries to their lips, threatening to leave " +
      "the Capitol without a victor. At the final moment, the Games are stopped " +
      "and both are declared victorious.";

    return {
      text,

      changes: [
        {
          type: "declare-victory",

          outcome: createJointVictoryOutcome(firstPartner.id, secondPartner.id, eventId),
        },

        ...createSurvivalChanges(partners),
      ],
    };
  },
};

export const ROMANTIC_EVENTS = [
  /* Day and Night */

  ROMANTIC_FORMATION_EVENT,
  ROMANTIC_PROTECTION_EVENT,
  POISONOUS_BERRIES_JOINT_VICTORY_EVENT,
] satisfies readonly EventDefinition[];
