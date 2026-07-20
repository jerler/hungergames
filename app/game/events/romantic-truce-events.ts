import { resolveStatCheck } from "~/game/events/event-outcomes";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import {
  createTruceInstance,
  getActiveTruceForTribute,
  getTruceFormationPopulationMultiplier,
} from "~/game/truces/truce-engine";
import { getAverageDistrictAffinityWeight } from "~/game/truces/truce-selection";
import type { GameChange, GameTribute } from "~/game/types/game-state";

const ROMANTIC_FORMATION_WEIGHT = 0.2;

function createSurvivalChanges(tributes: readonly GameTribute[]): GameChange[] {
  return tributes.map((tribute) => ({
    type: "increment-statistic",
    tributeId: tribute.id,
    statistic: "eventsSurvived",
    amount: 1,
  }));
}

function createStatusChange(
  eventId: string,
  tribute: GameTribute,
  statusId: StatusEffectId,
  severity: 1 | 2 | 3,
  round: EventResolutionContext["round"],
): GameChange {
  return {
    type: "apply-status",
    tributeId: tribute.id,

    status: createStatusEffectInstance(eventId, tribute.id, statusId, severity, round),
  };
}

function belongsToRomanticTruce(
  state: EventResolutionContext["state"],
  tributeId: string,
): boolean {
  return getActiveTruceForTribute(state, tributeId)?.kind === "romantic";
}

const ROMANTIC_TRUCE_FORMATION_EVENT: EventDefinition = {
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
          `${protector.snapshot.name} throws themself between ` +
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

              causeLabel: "Died protecting their partner",

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
            "and is badly injured protecting them.",

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

export const ROMANTIC_TRUCE_EVENTS = [
  ROMANTIC_TRUCE_FORMATION_EVENT,
  ROMANTIC_PROTECTION_EVENT,
] satisfies readonly EventDefinition[];
