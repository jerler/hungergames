import { createSeededRandom } from "~/game/engine/random";
import { createSurvivalChanges } from "~/game/events/event-change-builders";
import { createEvenTruceInventoryRedistributionChanges } from "~/game/truces/truce-inventory";
import { getOversizedStandardTruces } from "~/game/truces/truce-lifecycle";
import type { GameState, ResolvedEvent, RoundReference, Truce } from "~/game/types/game-state";

function formatNameList(names: readonly string[]): string {
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ` + names[names.length - 1];
}

function getLivingMembers(state: GameState, truce: Truce) {
  return truce.tributeIds.flatMap((tributeId) => {
    const tribute = state.tributes.find(
      (candidate) => candidate.id === tributeId && candidate.isAlive,
    );

    return tribute ? [tribute] : [];
  });
}

export function createForcedStandardTruceSeparationEvents(
  state: GameState,
  round: RoundReference,
): ResolvedEvent[] {
  return getOversizedStandardTruces(state).map((truce, eventIndex) => {
    const members = getLivingMembers(state, truce);

    if (members.length < 2) {
      throw new Error(`Oversized truce "${truce.id}" has fewer than two living members.`);
    }

    const definitionId = `amicable-truce-separation-${members.length}`;
    const eventId = [round.period, round.day, eventIndex, definitionId].join("-");
    const random = createSeededRandom(
      [state.seed, "forced-oversized-truce-separation", round.day, round.period, truce.id].join(
        ":",
      ),
    );
    const redistributionChanges = createEvenTruceInventoryRedistributionChanges(
      state,
      truce,
      random,
      "forced-oversized-truce-separation",
    );
    const names = members.map((member) => member.snapshot.name);

    return {
      id: eventId,
      definitionId,
      kind: "primary",
      resolutionMode: "standard",
      round: { ...round },
      participantTributeIds: members.map((member) => member.id),
      text:
        `${formatNameList(names)} now make up too much of the remaining field ` +
        "to continue travelling together. They divide their remaining gear " +
        "and separate before the alliance paints an even larger target on them.",
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
  });
}
