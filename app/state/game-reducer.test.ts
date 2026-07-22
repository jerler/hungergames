import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { createSeededRandom } from "~/game/engine/random";
import { selectLivingTributes } from "~/game/selectors/game-selectors";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState } from "~/game/types/game-state";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { createTruceInstance } from "~/game/truces/truce-engine";
import { createJointVictoryOutcome } from "~/game/victory/victory-outcome";

import { gameReducer } from "./game-reducer";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;
const NIGHT_ONE = {
  day: 1,
  period: "night",
} as const;

function createTestGame(seed = "complete-game-seed"): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, createSeededRandom(`${seed}:reaping`)),
    "random",
    {
      createId: () => {
        nextId += 1;
        return `id-${nextId}`;
      },

      now: "2026-07-18T12:00:00.000Z",
      seed,
    },
  );
}

function completeGame(initialState: GameState): GameState {
  let state: GameState | null = initialState;

  for (let roundIndex = 0; roundIndex < 80; roundIndex += 1) {
    state = gameReducer(state, {
      type: "round/began",
      now: `2026-07-18T12:${String(roundIndex % 60).padStart(2, "0")}:00.000Z`,
    });

    state = gameReducer(state, {
      type: "round/revealed",
      now: `2026-07-18T12:${String(roundIndex % 60).padStart(2, "0")}:30.000Z`,
    });

    if (!state) {
      throw new Error("The Game unexpectedly disappeared.");
    }

    assertGameStateInvariants(state);

    if (state.phase === "victory") {
      return state;
    }
  }

  throw new Error("The Game did not produce a victor within 80 rounds.");
}

function createOneSurvivorState(): GameState {
  let state = createTestGame("sole-victory-test");

  const soleSurvivor = state.tributes[0];

  if (!soleSurvivor) {
    throw new Error("The test Game contains no tributes.");
  }

  for (const [index, tribute] of state.tributes.entries()) {
    if (tribute.id === soleSurvivor.id) {
      continue;
    }

    const eventId = `sole-victory-setup-${index}`;

    const summary = `${tribute.snapshot.name} was eliminated during test setup.`;

    state = applyResolvedEvent(state, {
      id: eventId,

      definitionId: "test-elimination",

      resolutionMode: "standard",

      round: DAY_ONE,

      participantTributeIds: [tribute.id],

      text: summary,

      changes: [
        {
          type: "eliminate-tribute",

          tributeId: tribute.id,

          causeId: "test-elimination",

          causeLabel: "Test elimination",

          summary,

          killerTributeIds: [],
        },
      ],
    });
  }

  return {
    ...state,

    phase: "round-complete",

    currentRound: DAY_ONE,

    truces: [],

    roundEvents: [],

    revealedEventCount: 0,

    victoryOutcome: null,
  };
}

describe("gameReducer", () => {
  it("reveals and records resolved events", () => {
    const initialState = createTestGame();

    const roundState = gameReducer(initialState, {
      type: "round/began",
      now: "2026-07-18T13:00:00.000Z",
    });

    expect(roundState?.phase).toBe("round-events");

    const revealedState = gameReducer(roundState, {
      type: "round/revealed",
      now: "2026-07-18T13:01:00.000Z",
    });

    expect(revealedState?.eventHistory.length).toBeGreaterThan(0);
  });

  it("runs deterministically until a victory outcome is reached", () => {
    const firstResult = completeGame(createTestGame());

    const secondResult = completeGame(createTestGame());

    expect(firstResult.phase).toBe("victory");

    expect(firstResult.victoryOutcome).not.toBeNull();

    if (!firstResult.victoryOutcome) {
      throw new Error("The completed Game has no victory outcome.");
    }

    const livingTributes = selectLivingTributes(firstResult);

    expect([1, 2]).toContain(livingTributes.length);

    expect(livingTributes).toHaveLength(firstResult.victoryOutcome.victorTributeIds.length);

    expect(new Set(firstResult.victoryOutcome.victorTributeIds)).toEqual(
      new Set(livingTributes.map((tribute) => tribute.id)),
    );

    expect(firstResult.eventHistory).toEqual(secondResult.eventHistory);

    expect(firstResult.victoryOutcome).toEqual(secondResult.victoryOutcome);
  });

  it("creates a sole victory when one tribute remains", () => {
    const state = createOneSurvivorState();

    const soleSurvivor = selectLivingTributes(state)[0];

    if (!soleSurvivor) {
      throw new Error("The sole-victory state has no living tribute.");
    }

    const nextState = gameReducer(
      state,

      {
        type: "round/began",

        now: "2026-07-20T12:00:00.000Z",
      },
    );

    if (!nextState) {
      throw new Error("The Game unexpectedly disappeared.");
    }

    expect(nextState.phase).toBe("victory");

    expect(nextState.victoryOutcome).toEqual({
      kind: "sole",

      victorTributeIds: [soleSurvivor.id],

      sourceEventId: null,
    });

    expect(selectLivingTributes(nextState)).toEqual([soleSurvivor]);

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("never eliminates a tribute twice", () => {
    const result = completeGame(createTestGame());

    const eliminatedTributeIds = result.eventHistory.flatMap((event) =>
      event.changes
        .filter((change) => change.type === "eliminate-tribute")
        .map((change) => change.tributeId),
    );

    expect(new Set(eliminatedTributeIds).size).toBe(eliminatedTributeIds.length);
  });

  it("does not advance fatal statuses after an explicit victory declaration", () => {
    let state = createTestGame("explicit-victory-status-test");

    const firstFinalist = state.tributes[0];
    const secondFinalist = state.tributes[1];

    if (!firstFinalist || !secondFinalist) {
      throw new Error("The victory test requires two finalists.");
    }

    /*
     * Eliminate everyone except the intended
     * romantic finalists.
     */
    for (const [index, tribute] of state.tributes.entries()) {
      if (tribute.id === firstFinalist.id || tribute.id === secondFinalist.id) {
        continue;
      }

      const eventId = `joint-victory-elimination-${index}`;

      const summary = `${tribute.snapshot.name} was ` + "eliminated during test setup.";

      state = applyResolvedEvent(state, {
        id: eventId,
        definitionId: "joint-victory-test-elimination",

        resolutionMode: "standard",
        round: DAY_ONE,

        participantTributeIds: [tribute.id],

        text: summary,

        changes: [
          {
            type: "eliminate-tribute",

            tributeId: tribute.id,

            causeId: "joint-victory-test-elimination",

            causeLabel: "Test elimination",

            summary,

            killerTributeIds: [],
          },
        ],
      });
    }

    const romanticTruce = createTruceInstance(
      "joint-victory-test-truce",
      [firstFinalist.id, secondFinalist.id],
      DAY_ONE,
      null,
      "romantic",
    );

    /*
     * This status would expire and kill the
     * first finalist when Night 1 completes.
     */
    const fatalStatus = createStatusEffectInstance(
      "joint-victory-fatal-status",
      firstFinalist.id,
      "poisoned",
      1,
      DAY_ONE,
      1,
    );

    state = applyResolvedEvent(state, {
      id: "joint-victory-test-setup",
      definitionId: "joint-victory-test-setup",

      resolutionMode: "standard",
      round: DAY_ONE,

      participantTributeIds: [firstFinalist.id, secondFinalist.id],

      text: "The two finalists form a romantic truce.",

      changes: [
        {
          type: "form-truce",
          truce: romanticTruce,
        },
        {
          type: "apply-status",

          tributeId: firstFinalist.id,
          status: fatalStatus,
        },
      ],
    });

    const victoryEvent = {
      id: "joint-victory-test-event",

      definitionId: "poisonous-berries-joint-victory",

      resolutionMode: "standard" as const,
      round: NIGHT_ONE,

      participantTributeIds: [firstFinalist.id, secondFinalist.id],

      text: "The Games are stopped and both finalists are declared victorious.",

      changes: [
        {
          type: "declare-victory" as const,

          outcome: createJointVictoryOutcome(
            firstFinalist.id,
            secondFinalist.id,
            "joint-victory-test-event",
          ),
        },
      ],
    };

    const roundState: GameState = {
      ...state,

      phase: "round-events",
      currentRound: NIGHT_ONE,

      roundEvents: [victoryEvent],
      revealedEventCount: 0,

      victoryOutcome: null,
    };

    const completedState = gameReducer(roundState, {
      type: "round/revealed",
      now: "2026-07-21T19:00:00.000Z",
    });

    if (!completedState) {
      throw new Error("The joint-victory test lost its GameState.");
    }

    const livingTributeIds = selectLivingTributes(completedState).map((tribute) => tribute.id);

    expect(completedState.phase).toBe("victory");

    expect(new Set(livingTributeIds)).toEqual(new Set([firstFinalist.id, secondFinalist.id]));

    expect(completedState.victoryOutcome?.victorTributeIds).toEqual([
      firstFinalist.id,
      secondFinalist.id,
    ]);

    /*
     * The Games ended before the status
     * could advance and eliminate a victor.
     */
    expect(
      completedState.tributes.find((tribute) => tribute.id === firstFinalist.id)?.statuses,
    ).toContainEqual(fatalStatus);

    expect(() => assertGameStateInvariants(completedState)).not.toThrow();
  });
});
