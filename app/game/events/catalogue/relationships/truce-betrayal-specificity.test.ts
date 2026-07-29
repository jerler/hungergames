// Phase 2 truce-betrayal specificity tests.
import { describe, expect, it } from "vitest";

import { createSeededRandom } from "~/game/engine/random";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { getEventDefinitionSpecificityMultiplier } from "~/game/events/event-specificity";
import { isEventDefinitionEligible } from "~/game/events/event-eligibility";
import { selectEventParticipants } from "~/game/events/participant-selection";
import type { EventSelectionContext } from "~/game/events/event-schema";
import type { GameTribute } from "~/game/types/game-state";

import { STANDARD_INTERACTION_EVENTS } from "./standard-interaction-events";

const DAY_ROUND = {
  day: 2,
  period: "day",
} as const;

const BETRAYAL_EVENT = STANDARD_INTERACTION_EVENTS.find((event) => event.id === "truce-betrayal-2");

if (!BETRAYAL_EVENT) {
  throw new Error("Expected the two-person truce betrayal event.");
}

function createContext(
  firstTribute: GameTribute,
  secondTribute: GameTribute,
): EventSelectionContext {
  const state = {
    ...createAuthoringTestGame([firstTribute, secondTribute]),
    currentRound: DAY_ROUND,
    truces: [
      {
        id: "specificity-test-truce",
        kind: "standard" as const,
        tributeIds: [firstTribute.id, secondTribute.id],
        createdRound: {
          day: 1,
          period: "night" as const,
        },
        expiresAfterRound: {
          day: 2,
          period: "night" as const,
        },
      },
    ],
  };

  return {
    state,
    round: DAY_ROUND,
    livingTributes: state.tributes,
  };
}

describe("truce betrayal specificity", () => {
  it("is impossible when no other truce member has an item to steal", () => {
    const firstTribute = createAuthoringTestTribute({
      id: "betrayer",
      name: "Betrayer",
    });
    const secondTribute = createAuthoringTestTribute({
      id: "partner",
      name: "Partner",
    });

    const context = createContext(firstTribute, secondTribute);

    expect(isEventDefinitionEligible(BETRAYAL_EVENT, context)).toBe(false);
  });

  it("becomes feasible when another truce member owns an item", () => {
    const firstTribute = createAuthoringTestTribute({
      id: "betrayer",
      name: "Betrayer",
    });
    const secondTribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "partner",
        name: "Partner",
      }),
      "knife",
    );

    const context = createContext(firstTribute, secondTribute);

    expect(isEventDefinitionEligible(BETRAYAL_EVENT, context)).toBe(true);

    const selection = selectEventParticipants(
      BETRAYAL_EVENT,
      context,
      createSeededRandom("truce-betrayal-participants"),
      new Set<string>(),
      new Set<string>(),
    );

    expect(selection).not.toBeNull();
    expect(selection?.participantsByRole.betrayer?.[0]?.id).toBe(firstTribute.id);
    expect(selection?.participantsByRole.partners?.[0]?.id).toBe(secondTribute.id);
  });

  it("receives the explicit truce-plus-item 3x multiplier", () => {
    expect(BETRAYAL_EVENT.selectionProfile).toEqual({
      specificityScore: 4,
      specificityReasons: ["truce-requirement", "item-requirement"],
    });

    expect(getEventDefinitionSpecificityMultiplier(BETRAYAL_EVENT)).toBe(3);
  });
});
