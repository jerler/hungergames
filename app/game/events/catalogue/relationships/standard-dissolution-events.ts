import {
  requireParticipants,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { createSurvivalChanges } from "~/game/events/event-change-builders";
import { getActiveTruceForTribute } from "~/game/truces/truce-engine";
import { createEvenTruceInventoryRedistributionChanges } from "~/game/truces/truce-inventory";
import { TRUCE_GROUP_SIZE_WEIGHTS, type TruceGroupSize } from "~/game/truces/truce-selection";
import type { Truce } from "~/game/types/game-state";

const AMICABLE_SEPARATION_TOTAL_WEIGHT = 2;

function formatNameList(names: readonly string[]): string {
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ` + names[names.length - 1];
}

function isStandardTruceOfSize(truce: Truce | null, size: TruceGroupSize): truce is Truce {
  return truce?.kind === "standard" && truce.tributeIds.length === size;
}

function createAmicableSeparationEvent(size: TruceGroupSize, sizeWeight: number): EventDefinition {
  return {
    id: `amicable-truce-separation-${size}`,

    category: "survival",

    tags: ["survival", "truce", "cooperative", "item"],

    periods: ["day", "night"],

    baseWeight: AMICABLE_SEPARATION_TOTAL_WEIGHT * (sizeWeight / 100),

    roles: [
      {
        id: "members",
        count: size,

        isEligible: (tribute, { state, participantsByRole }) => {
          const truce = getActiveTruceForTribute(state, tribute.id);

          if (!isStandardTruceOfSize(truce, size)) {
            return false;
          }

          const selectedMembers = participantsByRole.members ?? [];

          if (selectedMembers.length === 0) {
            return true;
          }

          return selectedMembers.every((selectedMember) =>
            truce.tributeIds.includes(selectedMember.id),
          );
        },
      },
    ],

    isEligible: ({ state }) => state.truces.some((truce) => isStandardTruceOfSize(truce, size)),

    resolve({ state, random, participantsByRole }): EventResolution {
      const members = requireParticipants(participantsByRole, "members");

      if (members.length !== size) {
        throw new Error(
          `Amicable separation expected ${size} ` + `members but received ${members.length}.`,
        );
      }

      const truce = getActiveTruceForTribute(state, members[0].id);

      if (!isStandardTruceOfSize(truce, size)) {
        throw new Error("Amicable separation could not resolve " + "its active standard truce.");
      }

      const hasEveryMember = members.every((member) => truce.tributeIds.includes(member.id));

      if (!hasEveryMember) {
        throw new Error(`Amicable separation selected tributes ` + `from different truces.`);
      }

      const redistributionChanges = createEvenTruceInventoryRedistributionChanges(
        state,
        truce,
        random,
        "amicable-truce-separation",
      );

      const names = members.map((member) => member.snapshot.name);

      return {
        text:
          `${formatNameList(names)} decide ` +
          `their temporary partnership has run ` +
          `its course. They divide their remaining ` +
          `gear evenly and part ways peacefully.`,

        changes: [
          ...redistributionChanges,

          {
            type: "break-truce",
            truceId: truce.id,
            reason: "amicable",
          },

          ...createSurvivalChanges(members),
        ],
      };
    },
  };
}

export const STANDARD_DISSOLUTION_EVENTS = [
  /* Day and Night */

  ...TRUCE_GROUP_SIZE_WEIGHTS.map(({ size, weight }) =>
    createAmicableSeparationEvent(size, weight),
  ),
] satisfies readonly EventDefinition[];
