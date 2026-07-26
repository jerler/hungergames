import { describe, expect, it } from "vitest";

import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventResolutionContext } from "~/game/events/event-schema";
import type { GameTribute } from "~/game/types/game-state";

import { compileEffects } from "./compile-effects";
import { satisfySurvivalNeed } from "./survival-effects";

function createContext(tribute: GameTribute): EventResolutionContext {
  return {
    state: createAuthoringTestGame([tribute]),
    round: AUTHORING_TEST_ROUND,
    livingTributes: tribute.isAlive ? [tribute] : [],
    eventId: "test-satisfy-survival-need",
    random: () => 0.5,
    participantsByRole: {
      tribute: [tribute],
    },
  };
}

describe("survival authoring effects", () => {
  it("compiles food and water satisfaction changes", () => {
    const tribute = createAuthoringTestTribute();

    expect(
      compileEffects(
        [satisfySurvivalNeed("tribute", "food"), satisfySurvivalNeed("tribute", "water")],
        createContext(tribute),
      ),
    ).toEqual([
      {
        type: "satisfy-survival-need",
        tributeId: tribute.id,
        need: "food",
      },
      {
        type: "satisfy-survival-need",
        tributeId: tribute.id,
        need: "water",
      },
    ]);
  });

  it("rejects a dead selected participant", () => {
    const tribute = createAuthoringTestTribute();

    const deadTribute: GameTribute = {
      ...tribute,
      isAlive: false,
      death: {
        round: AUTHORING_TEST_ROUND,
        causeId: "test-death",
        causeLabel: "Test death",
        summary: `${tribute.snapshot.name} dies during test setup.`,
        killerTributeIds: [],
        resolvedEventId: "test-death-event",
      },
    };

    expect(() =>
      compileEffects([satisfySurvivalNeed("tribute", "food")], createContext(deadTribute)),
    ).toThrow(/dead tribute.*cannot satisfy.*food/i);
  });
});
