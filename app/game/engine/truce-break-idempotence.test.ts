import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createTruceInstance, STANDARD_TRUCE_EXPIRY_ROUND } from "~/game/truces/truce-engine";
import type { GameState, ResolvedEvent, RoundReference } from "~/game/types/game-state";

function createBreakEvent({
  id,
  truceId,
  round = AUTHORING_TEST_ROUND,
}: {
  id: string;
  truceId: string;
  round?: RoundReference;
}): ResolvedEvent {
  return {
    id,
    definitionId: id,
    kind: "primary",
    resolutionMode: "standard",
    round,
    participantTributeIds: ["tribute-1", "tribute-2"],
    text: "The truce ends.",
    changes: [
      {
        type: "break-truce",
        truceId,
        reason: "amicable",
      },
    ],
  };
}

function createStateWithTruce(): {
  state: GameState;
  truceId: string;
} {
  const first = createAuthoringTestTribute({
    id: "tribute-1",
    name: "First",
  });
  const second = createAuthoringTestTribute({
    id: "tribute-2",
    name: "Second",
  });
  const state = createAuthoringTestGame([first, second]);
  const truce = createTruceInstance(
    "test-truce-source",
    [first.id, second.id],
    AUTHORING_TEST_ROUND,
    STANDARD_TRUCE_EXPIRY_ROUND,
  );

  return {
    state: {
      ...state,
      truces: [truce],
    },
    truceId: truce.id,
  };
}

describe("same-round truce-break idempotence", () => {
  it("allows a later planned event to repeat an already-applied same-round break", () => {
    const { state, truceId } = createStateWithTruce();
    const firstBreak = createBreakEvent({
      id: "first-break",
      truceId,
    });
    const secondBreak = createBreakEvent({
      id: "second-break",
      truceId,
    });

    const afterFirstBreak = applyResolvedEvent(state, firstBreak);
    const afterSecondBreak = applyResolvedEvent(afterFirstBreak, secondBreak);

    expect(afterSecondBreak.truces).toEqual([]);
    expect(afterSecondBreak.eventHistory.map((event) => event.id)).toEqual([
      "first-break",
      "second-break",
    ]);
  });

  it("still rejects a missing truce with no same-round breakup history", () => {
    const state = createAuthoringTestGame([
      createAuthoringTestTribute({
        id: "tribute-1",
      }),
      createAuthoringTestTribute({
        id: "tribute-2",
      }),
    ]);
    const event = createBreakEvent({
      id: "invalid-break",
      truceId: "never-existed:truce",
    });

    expect(() => applyResolvedEvent(state, event)).toThrow(
      /Cannot break missing truce "never-existed:truce".*primary event "invalid-break".*amicable/i,
    );
  });

  it("does not treat a breakup from an earlier round as a same-round duplicate", () => {
    const { state, truceId } = createStateWithTruce();
    const earlierRound = {
      day: 1,
      period: "night",
    } as const satisfies RoundReference;
    const previousBreak = createBreakEvent({
      id: "previous-round-break",
      truceId,
      round: earlierRound,
    });
    const afterPreviousBreak = applyResolvedEvent(
      {
        ...state,
        currentRound: earlierRound,
      },
      previousBreak,
    );
    const currentBreak = createBreakEvent({
      id: "current-round-break",
      truceId,
    });

    expect(() =>
      applyResolvedEvent(
        {
          ...afterPreviousBreak,
          currentRound: AUTHORING_TEST_ROUND,
        },
        currentBreak,
      ),
    ).toThrow(/Cannot break missing truce.*current-round-break/i);
  });
});
