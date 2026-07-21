import { shuffleItems, type RandomSource } from "~/game/engine/random";
import {
  createFatalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import {
  resolveStatCheck,
  type EventStat,
  type StatCheckDifficulty,
  type StatCheckOutcome,
} from "~/game/events/event-outcomes";
import { clampStatCheckDifficulty } from "~/game/events/event-resolution-helpers";
import {
  requireParticipants,
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { getActiveTruceForTribute } from "~/game/truces/truce-engine";
import { TRUCE_GROUP_SIZE_WEIGHTS, type TruceGroupSize } from "~/game/truces/truce-selection";
import type {
  GameState,
  GameTribute,
  TransferInventoryItemChange,
  Truce,
} from "~/game/types/game-state";

const BETRAYAL_TOTAL_WEIGHT = 1.5;

function formatNameList(names: readonly string[]): string {
  if (names.length === 0) {
    return "the other tributes";
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ` + names[names.length - 1];
}

function isStandardTruceOfSize(truce: Truce | null, size: TruceGroupSize): truce is Truce {
  return truce?.kind === "standard" && truce.tributeIds.length === size;
}

function requireSharedStandardTruce(
  state: GameState,
  members: readonly GameTribute[],
  expectedSize?: TruceGroupSize,
): Truce {
  const firstMember = members[0];

  if (!firstMember) {
    throw new Error("A truce event requires at least one participant.");
  }

  const truce = getActiveTruceForTribute(state, firstMember.id);

  if (!truce || truce.kind !== "standard") {
    throw new Error(
      `Tribute "${firstMember.id}" does not belong ` + "to an active standard truce.",
    );
  }

  if (expectedSize && truce.tributeIds.length !== expectedSize) {
    throw new Error(
      `Truce "${truce.id}" has ${truce.tributeIds.length} ` +
        `members but ${expectedSize} were expected.`,
    );
  }

  const allMembersShareTruce = members.every((member) => truce.tributeIds.includes(member.id));

  if (!allMembersShareTruce) {
    throw new Error("A truce event selected members from different truces.");
  }

  return truce;
}

function getBetrayalStat(betrayer: GameTribute): EventStat {
  return betrayer.snapshot.stats.brains >= betrayer.snapshot.stats.brawn ? "brains" : "brawn";
}

function getBetrayalDifficulty(partners: readonly GameTribute[]): StatCheckDifficulty {
  const averageResistance =
    partners.reduce(
      (total, partner) =>
        total + Math.max(partner.snapshot.stats.brains, partner.snapshot.stats.brawn),
      0,
    ) / partners.length;

  /*
   * Larger groups are harder to betray.
   *
   * One opponent:   no penalty
   * Two opponents:  +0.5
   * Three:          +1
   * Four:           +1.5
   * Five:           +2
   */
  const groupPenalty = Math.max(0, partners.length - 1) * 0.5;

  return clampStatCheckDifficulty(averageResistance + groupPenalty);
}

function resolveBetrayalCheck(
  betrayer: GameTribute,
  partners: readonly GameTribute[],
  random: RandomSource,
): StatCheckOutcome {
  return resolveStatCheck({
    stats: betrayer.snapshot.stats,

    stat: getBetrayalStat(betrayer),

    difficulty: getBetrayalDifficulty(partners),

    random,
  });
}

function selectLeadDefender(partners: readonly GameTribute[]): GameTribute {
  const orderedPartners = [...partners].sort(
    (firstPartner, secondPartner) =>
      secondPartner.snapshot.stats.brawn - firstPartner.snapshot.stats.brawn ||
      secondPartner.snapshot.stats.brains - firstPartner.snapshot.stats.brains ||
      firstPartner.id.localeCompare(secondPartner.id),
  );

  const defender = orderedPartners[0];

  if (!defender) {
    throw new Error("A betrayal requires at least one defending partner.");
  }

  return defender;
}

function createBetrayalTheftChanges(
  partners: readonly GameTribute[],
  betrayer: GameTribute,
  random: RandomSource,
  stealAll: boolean,
): TransferInventoryItemChange[] {
  return partners.flatMap((partner) => {
    const selectedItems = stealAll
      ? partner.inventory
      : shuffleItems(partner.inventory, random).slice(0, 1);

    return selectedItems.map((item) => ({
      type: "transfer-item",
      itemInstanceId: item.id,

      fromTributeId: partner.id,

      toTributeId: betrayer.id,

      reason: "truce-betrayal",
    }));
  });
}

function describeTheft(itemCount: number): string {
  if (itemCount === 0) {
    return "finds nothing worth taking";
  }

  if (itemCount === 1) {
    return "steals a piece of their shared gear";
  }

  return `steals ${itemCount} pieces of their shared gear`;
}

function createBetrayalEvent(groupSize: TruceGroupSize, groupSizeWeight: number): EventDefinition {
  return {
    id: `truce-betrayal-${groupSize}`,

    category: "hazard",

    tags: ["hazard", "truce", "combat", "item", "status"],

    periods: ["day", "night"],

    baseWeight: BETRAYAL_TOTAL_WEIGHT * (groupSizeWeight / 100),

    roles: [
      {
        id: "betrayer",
        count: 1,

        isEligible: (tribute, { state }) =>
          isStandardTruceOfSize(getActiveTruceForTribute(state, tribute.id), groupSize),
      },
      {
        id: "partners",
        count: groupSize - 1,

        isEligible: (tribute, { state, participantsByRole }) => {
          const betrayer = participantsByRole.betrayer?.[0];

          if (!betrayer) {
            return false;
          }

          const truce = getActiveTruceForTribute(state, betrayer.id);

          return isStandardTruceOfSize(truce, groupSize) && truce.tributeIds.includes(tribute.id);
        },
      },
    ],

    isEligible: ({ state }) =>
      state.truces.some((truce) => isStandardTruceOfSize(truce, groupSize)),

    resolve({ state, eventId, round, random, participantsByRole }): EventResolution {
      const betrayer = requireSingleParticipant(participantsByRole, "betrayer");

      const partners = requireParticipants(participantsByRole, "partners");

      if (partners.length !== groupSize - 1) {
        throw new Error(
          `Truce betrayal expected ${groupSize - 1} ` + `partners but received ${partners.length}.`,
        );
      }

      const truce = requireSharedStandardTruce(state, [betrayer, ...partners], groupSize);

      const defender = selectLeadDefender(partners);

      const partnerNames = formatNameList(partners.map((partner) => partner.snapshot.name));

      const outcome = resolveBetrayalCheck(betrayer, partners, random);

      switch (outcome) {
        case "critical-failure": {
          const text =
            `${betrayer.snapshot.name} tries to betray ` +
            `${partnerNames}, but ${defender.snapshot.name} ` +
            "sees the attack coming and kills the would-be traitor.";

          return {
            text,

            /*
             * The explicit break prevents
             * 4C-2 from generating a second,
             * accidental-break aftermath.
             */
            changes: [
              ...createFatalChanges(
                betrayer,
                "failed-truce-betrayal",
                "Killed during a failed betrayal",
                text,
                defender,
              ),

              {
                type: "break-truce",
                truceId: truce.id,
                reason: "betrayal",
              },

              ...createSurvivalChanges(partners),
            ],
          };
        }

        case "failure": {
          const text =
            `${betrayer.snapshot.name} turns against ` +
            `${partnerNames}, but the others fight back. ` +
            `${betrayer.snapshot.name} escapes injured, ` +
            "and the truce collapses.";

          return {
            text,

            changes: [
              createStatusChange(eventId, betrayer, "injured", 2, round),

              {
                type: "break-truce",
                truceId: truce.id,
                reason: "betrayal",
              },

              ...createSurvivalChanges(partners),
            ],
          };
        }

        case "success": {
          const theftChanges = createBetrayalTheftChanges(partners, betrayer, random, false);

          const text =
            `${betrayer.snapshot.name} betrays ${partnerNames}, ` +
            `${describeTheft(theftChanges.length)}, ` +
            "and disappears into the arena before they can respond.";

          return {
            text,

            changes: [
              ...theftChanges,

              createStatusChange(eventId, betrayer, "hunted", 1, round),

              {
                type: "break-truce",
                truceId: truce.id,
                reason: "betrayal",
              },

              ...createSurvivalChanges([betrayer]),
            ],
          };
        }

        case "exceptional-success": {
          const theftChanges = createBetrayalTheftChanges(partners, betrayer, random, true);

          const text =
            `${betrayer.snapshot.name} launches a devastating ` +
            `betrayal against ${partnerNames}, kills ` +
            `${defender.snapshot.name}, takes all the gear ` +
            "they can find, and flees into the arena.";

          return {
            text,

            /*
             * Transfers must happen before
             * the defender dies because dead
             * tributes cannot initiate item
             * transfers.
             */
            changes: [
              ...theftChanges,

              ...createFatalChanges(
                defender,
                "successful-truce-betrayal",
                "Killed by a truce partner",
                text,
                betrayer,
              ),

              createStatusChange(eventId, betrayer, "inspired", 1, round),

              {
                type: "break-truce",
                truceId: truce.id,
                reason: "betrayal",
              },

              ...createSurvivalChanges([betrayer]),
            ],
          };
        }
      }
    },
  };
}

const STANDARD_BETRAYAL_EVENTS = TRUCE_GROUP_SIZE_WEIGHTS.map(({ size, weight }) =>
  createBetrayalEvent(size, weight),
);

const PROTECTS_TRUCE_PARTNER_EVENT: EventDefinition = {
  id: "protects-truce-partner",
  category: "hazard",

  tags: ["hazard", "truce", "cooperative", "status"],

  periods: ["day", "night"],

  baseWeight: 2,

  roles: [
    {
      id: "protector",
      count: 1,

      isEligible: (tribute, { state }) => {
        const truce = getActiveTruceForTribute(state, tribute.id);

        return truce?.kind === "standard" && truce.tributeIds.length >= 2;
      },

      getWeight: (tribute) => tribute.snapshot.stats.brawn,
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

        return truce?.kind === "standard" && truce.tributeIds.includes(tribute.id);
      },

      /*
       * More vulnerable partners are
       * slightly more likely to need help.
       */
      getWeight: (tribute) => Math.max(0.25, 6 - tribute.snapshot.stats.brawn),
    },
  ],

  isEligible: ({ state }) =>
    state.truces.some((truce) => truce.kind === "standard" && truce.tributeIds.length >= 2),

  resolve({ state, eventId, round, random, participantsByRole }): EventResolution {
    const protector = requireSingleParticipant(participantsByRole, "protector");

    const partner = requireSingleParticipant(participantsByRole, "partner");

    requireSharedStandardTruce(state, [protector, partner]);

    const outcome = resolveStatCheck({
      stats: protector.snapshot.stats,

      stat: "brawn",
      difficulty: 3,
      random,
    });

    switch (outcome) {
      case "critical-failure": {
        const text =
          `${protector.snapshot.name} throws themself ` +
          `between ${partner.snapshot.name} and an arena threat. ` +
          `${partner.snapshot.name} survives, but ` +
          `${protector.snapshot.name} is killed.`;

        return {
          text,

          /*
           * There is no explicit break here.
           * 4C-2 will create the visible
           * accidental-dissolution aftermath.
           */
          changes: [
            ...createFatalChanges(
              protector,
              "protecting-truce-partner",
              "Died protecting a truce partner",
              text,
            ),

            ...createSurvivalChanges([partner]),
          ],
        };
      }

      case "failure":
        return {
          text:
            `${protector.snapshot.name} shields ` +
            `${partner.snapshot.name} from an arena threat ` +
            "but is badly injured in the process.",

          changes: [
            createStatusChange(eventId, protector, "injured", 2, round),

            ...createSurvivalChanges([partner]),
          ],
        };

      case "success":
        return {
          text:
            `${protector.snapshot.name} pulls ` +
            `${partner.snapshot.name} out of danger. ` +
            "Both escape before the threat can strike again.",

          changes: [...createSurvivalChanges([protector, partner])],
        };

      case "exceptional-success":
        return {
          text:
            `${protector.snapshot.name} intercepts the danger ` +
            `without hesitation and leads ${partner.snapshot.name} ` +
            "to safety. Their successful escape strengthens the truce.",

          changes: [
            createStatusChange(eventId, protector, "inspired", 1, round),

            createStatusChange(eventId, partner, "inspired", 1, round),

            ...createSurvivalChanges([protector, partner]),
          ],
        };
    }
  },
};

export const STANDARD_INTERACTION_EVENTS = [
  /* Day and Night */

  ...STANDARD_BETRAYAL_EVENTS,
  PROTECTS_TRUCE_PARTNER_EVENT,
] satisfies readonly EventDefinition[];
